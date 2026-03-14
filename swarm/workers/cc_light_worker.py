"""
CC Light worker: uses Claude Code CLI for strategic thinking tasks (eval, plan, review).

Free on Max plan, uses Opus instead of Haiku API — much smarter for strategic work.
Shorter timeout than heavy worker since these are thinking tasks, not code-writing tasks.
"""

import json
import logging
import os
import subprocess
import time
from typing import Any

from swarm.config import BLOCKED_PROJECTS, CLAUDE_CLI_PATH, PROJECTS
from swarm.context import gather_project_context
from swarm.workers.base import BaseWorker

logger = logging.getLogger("swarm.worker.cc_light")

# 5 minute timeout for thinking tasks (vs 30 min for heavy code-writing tasks)
CC_LIGHT_TASK_TIMEOUT_SECONDS = 300


class CCLightWorker(BaseWorker):
    """Uses Claude Code CLI for strategic tasks. Free on Max plan, smarter than Haiku."""

    def __init__(self, worker_type: str = "inspector"):
        super().__init__(worker_type=worker_type, tier="cc_light")

    def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """Execute a strategic thinking task via Claude Code CLI.

        Args:
            task: Task row from Supabase. input_data should contain:
                - prompt: The prompt to send to Claude Code
                - project (optional): Project key for working directory and context

        Returns:
            Output data with stdout, duration, and exit code
        """
        input_data = task.get("input_data", {})
        if isinstance(input_data, str):
            input_data = json.loads(input_data)

        prompt = input_data.get("prompt", "")
        if not prompt:
            raise ValueError("Task input_data must contain a 'prompt' field")

        # Resolve project and inject context
        project_key = task.get("project", "")
        project_config = PROJECTS.get(project_key, {})
        cwd = project_config.get("dir", None)
        if not cwd:
            cwd = input_data.get("cwd", "C:/Users/Kruz/Desktop/Projects")

        # Add project context if available (skip blocked projects)
        if project_key and project_key in PROJECTS and project_key not in BLOCKED_PROJECTS:
            try:
                context = gather_project_context(
                    PROJECTS[project_key].get("dir", ""), project_key=project_key
                )
                if context:
                    prompt = f"{context}\n\n{prompt}"
            except Exception as e:
                logger.warning("Context gathering failed for %s: %s, continuing without context", project_key, e)

        logger.info(
            "Launching Claude Code (cc_light) for task %s in %s: %s",
            task["id"][:8],
            cwd,
            task["title"],
        )

        start_time = time.time()

        # Build command — -p flag enables non-interactive print mode
        cmd = [
            CLAUDE_CLI_PATH,
            "-p",
            prompt,
        ]

        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=CC_LIGHT_TASK_TIMEOUT_SECONDS,
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
                    "Claude Code (cc_light) exited %d for task %s (%.0fs)",
                    result.returncode,
                    task["id"][:8],
                    duration_seconds,
                )

            logger.info(
                "Task %s completed in %.1fs (%.1f min) via cc_light",
                task["id"][:8],
                duration_seconds,
                duration_minutes,
            )

            return {
                "response": stdout,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": result.returncode,
                "duration_seconds": duration_seconds,
                "duration_minutes": duration_minutes,
                "cwd": cwd,
                "tier": "cc_light",
            }

        except subprocess.TimeoutExpired:
            duration_seconds = round(time.time() - start_time, 1)
            self.budget_manager.record_spend(minutes=round(duration_seconds / 60, 2))
            raise TimeoutError(
                f"Claude Code (cc_light) timed out after {CC_LIGHT_TASK_TIMEOUT_SECONDS}s"
            )
