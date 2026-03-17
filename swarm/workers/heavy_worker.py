"""
Heavy worker: launches Claude Code CLI as a subprocess for complex tasks.

Supports git worktree isolation: when a task has use_worktree=True in input_data
(or is part of a team), the worker creates an isolated worktree so multiple
agents can work on the same repo simultaneously without conflicts.
"""

import json
import logging
import os
import re
import subprocess
import time
from typing import Any

from swarm.auto_merge import AutoMerger
from swarm.config import AUTO_MERGE_ENABLED, CLAUDE_CLI_PATH, HEAVY_WORKER_TASK_TIMEOUT_SECONDS, PROJECTS
from swarm.worktree import create_worktree, commit_worktree_changes, cleanup_worktree
from swarm.workers.base import BaseWorker

logger = logging.getLogger("swarm.worker.heavy")


class HeavyWorker(BaseWorker):
    """Worker that invokes Claude Code CLI for full codebase operations."""

    def __init__(self, worker_type: str = "heavy"):
        super().__init__(worker_type=worker_type, tier="heavy")

    def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """Execute a task by running Claude Code CLI.

        If use_worktree is True in input_data, creates an isolated git worktree
        so this agent doesn't conflict with others working on the same repo.

        Args:
            task: Task row from Supabase. input_data should contain:
                - prompt: The prompt to send to Claude Code
                - project (optional): Project key for working directory
                - use_worktree (optional): If True, use worktree isolation
                - team_id (optional): Team this task belongs to

        Returns:
            Output data with stdout, duration, and exit code
        """
        input_data = task.get("input_data", {})
        if isinstance(input_data, str):
            input_data = json.loads(input_data)

        prompt = input_data.get("prompt", "")
        if not prompt:
            raise ValueError("Task input_data must contain a 'prompt' field")

        # Validate task ID format (defensive — prevents shell injection via crafted IDs)
        if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', task["id"]):
            raise ValueError(f"Invalid task ID format: {task['id'][:40]}")

        # Resolve working directory
        project_key = task.get("project", "")
        project_config = PROJECTS.get(project_key, {})
        project_dir = project_config.get("dir", None)
        cwd = project_dir
        if not cwd:
            cwd = input_data.get("cwd", "C:/Users/Kruz/Desktop/Projects")

        # Worktree isolation: create isolated workspace if requested
        use_worktree = input_data.get("use_worktree", False)
        worktree_path = None

        if use_worktree and project_dir:
            worktree_path = create_worktree(project_dir, task["id"])
            if worktree_path:
                cwd = worktree_path
                logger.info("Using worktree at %s for task %s", worktree_path, task["id"][:8])
            else:
                logger.warning("Worktree creation failed, falling back to project dir")

        logger.info(
            "Launching Claude Code for task %s in %s: %s",
            task["id"][:8],
            cwd,
            task["title"],
        )

        start_time = time.time()
        worktree_committed = False  # Guard against double commit in finally

        # Write prompt to temp file to avoid Windows cmd.exe argument mangling
        import tempfile
        prompt_file = os.path.join(
            tempfile.gettempdir(), f"swarm-prompt-heavy-{task['id']}.txt"
        )
        with open(prompt_file, "w", encoding="utf-8") as pf:
            pf.write(prompt)

        # Pipe prompt via temp file — raw CLI args get mangled on Windows
        shell_cmd = (
            f'type "{prompt_file}" | "{CLAUDE_CLI_PATH}" '
            f'--output-format text -p - --dangerously-skip-permissions'
        )

        try:
            # Hide cmd.exe windows on Windows
            startupinfo = None
            if os.name == "nt":
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = subprocess.SW_HIDE

            result = subprocess.run(
                shell_cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=HEAVY_WORKER_TASK_TIMEOUT_SECONDS,
                shell=True,
                encoding="utf-8",
                errors="replace",
                startupinfo=startupinfo,
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
                error_detail = stderr[:500] or f"Exit code {result.returncode}"
                logger.error(
                    "Claude Code exited %d for task %s (%.0fs): %s",
                    result.returncode,
                    task["id"][:8],
                    duration_seconds,
                    error_detail[:200],
                )
                raise RuntimeError(
                    f"Claude Code failed (exit {result.returncode}): {error_detail}"
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

            # Worktree: commit changes and record branch info
            if worktree_path:
                commit_sha = commit_worktree_changes(
                    worktree_path,
                    task["id"],
                    task.get("title", "agent task"),
                    worker_name=self.worker_type,
                )
                worktree_committed = True
                output_data["worktree"] = {
                    "path": worktree_path,
                    "branch": f"agent/{task['id'][:8]}",
                    "commit_sha": commit_sha,
                    "isolated": True,
                }

            # Auto-merge: check if Claude Code opened a PR
            if AUTO_MERGE_ENABLED and result.returncode == 0:
                output_data = self._try_auto_merge(task, stdout, output_data)

            return output_data

        except subprocess.TimeoutExpired:
            duration_seconds = round(time.time() - start_time, 1)
            self.budget_manager.record_spend(minutes=round(duration_seconds / 60, 2))
            raise TimeoutError(
                f"Claude Code timed out after {HEAVY_WORKER_TASK_TIMEOUT_SECONDS}s"
            )
        finally:
            # Clean up temp prompt file
            try:
                if prompt_file and os.path.exists(prompt_file):
                    os.remove(prompt_file)
            except Exception:
                pass
            # Commit any partial worktree changes before cleanup (only on failure path)
            if worktree_path and not worktree_committed:
                try:
                    commit_worktree_changes(
                        worktree_path,
                        task["id"],
                        task.get("title", "agent task"),
                        worker_name=self.worker_type,
                    )
                except Exception as e:
                    logger.warning("Worktree commit in finally failed: %s", e)
            # Clean up worktree (branch preserved for review/merge)
            if worktree_path and project_dir:
                try:
                    cleanup_worktree(project_dir, worktree_path, task["id"], delete_branch=False)
                except Exception as e:
                    logger.warning("Worktree cleanup failed: %s", e)

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
