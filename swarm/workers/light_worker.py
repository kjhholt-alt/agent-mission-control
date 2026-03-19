"""
Light worker: uses Claude Code CLI instead of direct API calls.

Previously used Anthropic Python SDK (Haiku) which cost real money.
Now routes through Claude Code CLI — free on Max plan, and smarter (Opus).
"""

import json
import logging
import os
import re
import subprocess
import tempfile
import time
from typing import Any

from swarm.config import BLOCKED_PROJECTS, CLAUDE_CLI_PATH, PROJECTS
from swarm.context import gather_project_context
from swarm.workers.base import BaseWorker

logger = logging.getLogger("swarm.worker.light")

# 2 minute timeout for light tasks (fast analysis, evals, checks)
LIGHT_TASK_TIMEOUT_SECONDS = 120


class LightWorker(BaseWorker):
    """Worker that uses Claude Code CLI for fast tasks. Free on Max plan."""

    def __init__(self, worker_type: str = "light"):
        super().__init__(worker_type=worker_type, tier="light")

    def _build_prompt_with_context(self, task: dict[str, Any], prompt: str) -> str:
        """Inject project context before the task prompt if a project is specified."""
        project_key = task.get("project", "")
        if not project_key:
            return prompt

        if project_key in BLOCKED_PROJECTS:
            logger.debug("Skipping context for blocked project: %s", project_key)
            return prompt

        project_config = PROJECTS.get(project_key)
        if not project_config:
            return prompt

        project_dir = project_config.get("dir", "")
        if not project_dir:
            return prompt

        try:
            context = gather_project_context(project_dir, project_key=project_key)
        except Exception as e:
            logger.warning("Context gathering failed for %s: %s", project_key, e)
            return prompt
        if not context:
            return prompt

        logger.info(
            "Injected %d chars of project context for %s",
            len(context),
            project_key,
        )
        return f"{context}\n\n{prompt}"

    def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """Execute a task via Claude Code CLI (free on Max plan).

        Args:
            task: Task row from Supabase. input_data should contain:
                - prompt: The prompt to send

        Returns:
            Output data with response and duration
        """
        input_data = task.get("input_data", {})
        if isinstance(input_data, str):
            input_data = json.loads(input_data)

        prompt = input_data.get("prompt", "")
        if not prompt:
            raise ValueError("Task input_data must contain a 'prompt' field")

        # Validate task ID format (prevents shell injection)
        if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', task["id"]):
            raise ValueError(f"Invalid task ID format: {task['id'][:40]}")

        # Inject project context before the prompt
        prompt = self._build_prompt_with_context(task, prompt)

        # Add system context to prompt
        system_prompt = input_data.get("system", "")
        if system_prompt:
            prompt = f"{system_prompt}\n\n{prompt}"

        # Resolve working directory
        project_key = task.get("project", "")
        project_config = PROJECTS.get(project_key, {})
        cwd = project_config.get("dir", "C:/Users/Kruz/Desktop/Projects")

        logger.info(
            "Launching Claude Code (light) for task %s in %s: %s",
            task["id"][:8],
            cwd,
            task["title"],
        )

        start_time = time.time()

        # Write prompt to temp file to avoid Windows cmd.exe argument mangling
        prompt_file = os.path.join(
            tempfile.gettempdir(), f"swarm-prompt-light-{task['id']}.txt"
        )
        with open(prompt_file, "w", encoding="utf-8") as pf:
            pf.write(prompt)

        shell_cmd = (
            f'type "{prompt_file}" | "{CLAUDE_CLI_PATH}" '
            f'--output-format text -p -'
        )

        try:
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
                timeout=LIGHT_TASK_TIMEOUT_SECONDS,
                shell=True,
                encoding="utf-8",
                errors="replace",
                startupinfo=startupinfo,
            )

            duration_seconds = round(time.time() - start_time, 1)

            stdout = result.stdout or ""
            stderr = result.stderr or ""

            # Truncate large outputs
            max_output = 10000
            if len(stdout) > max_output:
                stdout = f"[...truncated {len(stdout) - max_output} chars...]\n" + stdout[-max_output:]

            if result.returncode != 0:
                error_detail = stderr[:500] or f"Exit code {result.returncode}"
                logger.error(
                    "Claude Code (light) exited %d for task %s (%.0fs): %s",
                    result.returncode,
                    task["id"][:8],
                    duration_seconds,
                    error_detail[:200],
                )
                raise RuntimeError(
                    f"Claude Code failed (exit {result.returncode}): {error_detail}"
                )

            logger.info(
                "Task %s completed in %.1fs via light (CLI)",
                task["id"][:8],
                duration_seconds,
            )

            return {
                "response": stdout,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": result.returncode,
                "duration_seconds": duration_seconds,
                "cost_cents": 0,  # Free on Max plan
                "tier": "light",
            }

        except subprocess.TimeoutExpired:
            duration_seconds = round(time.time() - start_time, 1)
            raise TimeoutError(
                f"Claude Code (light) timed out after {LIGHT_TASK_TIMEOUT_SECONDS}s"
            )
        finally:
            try:
                if prompt_file and os.path.exists(prompt_file):
                    os.remove(prompt_file)
            except Exception:
                pass
