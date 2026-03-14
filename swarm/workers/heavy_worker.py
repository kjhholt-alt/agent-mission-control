"""
Heavy worker: launches Claude Code CLI as a subprocess for complex tasks.
"""

import json
import logging
import subprocess
import time
from typing import Any

from swarm.auto_merge import AutoMerger
from swarm.config import AUTO_MERGE_ENABLED, CLAUDE_CLI_PATH, HEAVY_WORKER_TASK_TIMEOUT_SECONDS, PROJECTS
from swarm.workers.base import BaseWorker

logger = logging.getLogger("swarm.worker.heavy")


class HeavyWorker(BaseWorker):
    """Worker that invokes Claude Code CLI for full codebase operations."""

    def __init__(self, worker_type: str = "heavy"):
        super().__init__(worker_type=worker_type, tier="heavy")

    def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """Execute a task by running Claude Code CLI.

        Args:
            task: Task row from Supabase. input_data should contain:
                - prompt: The prompt to send to Claude Code
                - project (optional): Project key for working directory

        Returns:
            Output data with stdout, duration, and exit code
        """
        input_data = task.get("input_data", {})
        if isinstance(input_data, str):
            input_data = json.loads(input_data)

        prompt = input_data.get("prompt", "")
        if not prompt:
            raise ValueError("Task input_data must contain a 'prompt' field")

        # Resolve working directory
        project_key = task.get("project", "")
        project_config = PROJECTS.get(project_key, {})
        cwd = project_config.get("dir", None)
        if not cwd:
            cwd = input_data.get("cwd", "C:/Users/Kruz/Desktop/Projects")

        logger.info(
            "Launching Claude Code for task %s in %s: %s",
            task["id"][:8],
            cwd,
            task["title"],
        )

        start_time = time.time()

        # Build command
        cmd = [
            CLAUDE_CLI_PATH,
            "-p",
            prompt,
            "--dangerously-skip-permissions",
        ]

        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=HEAVY_WORKER_TASK_TIMEOUT_SECONDS,
                shell=True,
            )

            duration_seconds = round(time.time() - start_time, 1)
            duration_minutes = round(duration_seconds / 60, 2)

            # Record Claude Code time usage
            self.budget_manager.record_spend(minutes=duration_minutes)

            stdout = result.stdout or ""
            stderr = result.stderr or ""

            # Truncate large outputs (keep last 10K chars)
            max_output = 10000
            if len(stdout) > max_output:
                stdout = f"[...truncated {len(stdout) - max_output} chars...]\n" + stdout[-max_output:]
            if len(stderr) > max_output:
                stderr = f"[...truncated {len(stderr) - max_output} chars...]\n" + stderr[-max_output:]

            if result.returncode != 0:
                logger.warning(
                    "Claude Code exited %d for task %s (%.0fs)",
                    result.returncode,
                    task["id"][:8],
                    duration_seconds,
                )

            logger.info(
                "Task %s completed in %.1fs (%.1f min)",
                task["id"][:8],
                duration_seconds,
                duration_minutes,
            )

            output_data = {
                "response": stdout,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": result.returncode,
                "duration_seconds": duration_seconds,
                "duration_minutes": duration_minutes,
                "cwd": cwd,
            }

            # Auto-merge: check if Claude Code opened a PR
            if AUTO_MERGE_ENABLED and result.returncode == 0:
                output_data = self._try_auto_merge(task, stdout, output_data)

            return output_data

        except subprocess.TimeoutExpired as exc:
            duration_seconds = round(time.time() - start_time, 1)
            self.budget_manager.record_spend(minutes=round(duration_seconds / 60, 2))
            raise TimeoutError(
                f"Claude Code timed out after {HEAVY_WORKER_TASK_TIMEOUT_SECONDS}s"
            )

    def _try_auto_merge(
        self, task: dict[str, Any], stdout: str, output_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Attempt to auto-merge a PR if one was created by Claude Code.

        Parses the PR number from stdout, checks safety rules, and either
        merges or flags for review.
        """
        merger = AutoMerger()

        pr_number = merger.parse_pr_number(stdout)
        if pr_number is None:
            logger.debug("No PR detected in output — skipping auto-merge")
            return output_data

        repo = merger.parse_repo_from_output(stdout)
        if not repo:
            # Fall back to project's GitHub repo if we can't parse it
            project_key = task.get("project", "")
            project_config = PROJECTS.get(project_key, {})
            repo = project_config.get("github_repo", "")
        if not repo:
            logger.warning("Could not determine repo for PR #%d", pr_number)
            output_data["auto_merge"] = {
                "pr_number": pr_number,
                "action": "skipped",
                "reason": "Could not determine repository",
            }
            return output_data

        # Fetch PR metadata
        pr_info = merger.get_pr_info(repo, pr_number)

        # Decide
        should_merge, reason = merger.should_auto_merge(task, pr_info)

        if should_merge:
            merged = merger.merge_pr(repo, pr_number)
            action = "merged" if merged else "merge_failed"
            logger.info("PR #%d auto-merged: %s", pr_number, reason)
        else:
            merger.flag_for_review(repo, pr_number, reason)
            action = "flagged_for_review"
            logger.info("PR #%d flagged for review: %s", pr_number, reason)

        output_data["auto_merge"] = {
            "pr_number": pr_number,
            "repo": repo,
            "action": action,
            "reason": reason,
        }
        return output_data
