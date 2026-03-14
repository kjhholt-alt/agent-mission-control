"""
Goal decomposer: breaks high-level user goals into structured meta-tasks.

Uses Claude Code CLI (free Opus on Max plan) instead of Haiku API for much
smarter goal decomposition.
"""

import json
import logging
import subprocess
from typing import Any

from swarm.config import BLOCKED_PROJECTS, PROJECTS
from swarm.tasks.task_manager import TaskManager

logger = logging.getLogger("swarm.decomposer")

DECOMPOSE_SYSTEM = """You are the goal decomposition engine for an autonomous agent swarm.
Given a high-level goal, break it into concrete, actionable tasks.

Available projects and their types:
{projects}

Each task must have:
- task_type: one of "meta", "eval", "build", "test", "refactor", "mine"
- title: short, specific title
- project: project key from the list above
- input_data: dict with a "prompt" field containing the detailed instructions
- cost_tier: "light" (API call, quick analysis) or "heavy" (Claude Code, complex coding)
- priority: 1 (critical) to 10 (low)
- depends_on_index: list of task indices (0-based) this task depends on, or empty list

Return a JSON array of task objects. No markdown, just JSON.

Guidelines:
- Start with an "eval" task to assess current state before making changes
- Use "light" tier for analysis, evaluation, planning
- Use "heavy" tier for code changes, refactoring, testing
- Keep tasks focused — one concern per task
- Set realistic dependencies (eval before build, build before test)
- Typically 2-6 tasks per goal"""


class GoalDecomposer:
    """Breaks user goals into structured tasks using Claude Code CLI (free Opus)."""

    def __init__(self):
        self.task_manager = TaskManager()

    def decompose(self, user_prompt: str) -> list[dict[str, Any]]:
        """Decompose a user goal into meta-tasks and create them in Supabase.

        Uses Claude Code CLI subprocess for free Opus-level decomposition.

        Args:
            user_prompt: High-level goal description

        Returns:
            List of created task dicts
        """
        projects_desc = "\n".join(
            f"  - {key}: {cfg['type']} project at {cfg['dir']}"
            for key, cfg in PROJECTS.items()
            if key not in BLOCKED_PROJECTS
        )

        system = DECOMPOSE_SYSTEM.format(projects=projects_desc)

        prompt = f"{system}\n\n{user_prompt}"

        logger.info("Decomposing goal via Claude Code CLI: %s", user_prompt[:100])

        try:
            result = subprocess.run(
                ["C:/Users/Kruz/.local/bin/claude.exe", "-p", prompt, "--no-input"],
                capture_output=True,
                text=True,
                timeout=300,  # 5 min max
                cwd="C:/Users/Kruz/Desktop/Projects/nexus",
            )
            response_text = result.stdout or ""
        except subprocess.TimeoutExpired:
            raise ValueError("Goal decomposition timed out after 5 minutes")
        except FileNotFoundError:
            raise ValueError("Claude Code CLI not found. Is 'claude' in PATH?")

        # Parse JSON from response
        try:
            # Try to extract JSON array from response
            text = response_text.strip()
            if text.startswith("```"):
                # Strip markdown code fences
                lines = text.split("\n")
                text = "\n".join(
                    lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                )
            # Find JSON array in the response (handles text before/after)
            import re
            json_match = re.search(r'\[[\s\S]*\]', text)
            if json_match:
                text = json_match.group(0)
            tasks_data = json.loads(text)
        except json.JSONDecodeError as e:
            logger.error("Failed to parse decomposition response: %s", e)
            logger.debug("Raw response: %s", response_text)
            raise ValueError(f"Goal decomposition returned invalid JSON: {e}")

        if not isinstance(tasks_data, list):
            raise ValueError("Goal decomposition must return a JSON array")

        # Create a parent meta-task
        parent = self.task_manager.create_task(
            task_type="meta",
            title=f"Goal: {user_prompt[:80]}",
            project=tasks_data[0].get("project", "nexus") if tasks_data else "nexus",
            input_data={
                "prompt": f"Meta task: track progress of child tasks for goal: {user_prompt[:200]}",
                "original_prompt": user_prompt,
            },
            cost_tier="light",
            priority=1,
        )

        # Create child tasks, resolving index-based dependencies to real IDs
        created_tasks = []
        id_map: dict[int, str] = {}  # index -> task_id

        for i, td in enumerate(tasks_data):
            # Resolve depends_on_index to actual task IDs
            depends_on = []
            for dep_idx in td.get("depends_on_index", []):
                if dep_idx in id_map:
                    depends_on.append(id_map[dep_idx])

            task = self.task_manager.create_task(
                task_type=td.get("task_type", "build"),
                title=td["title"],
                project=td.get("project", "nexus"),
                input_data=td.get("input_data", {"prompt": td["title"]}),
                cost_tier=td.get("cost_tier", "light"),
                priority=td.get("priority", 5),
                parent_id=parent["id"],
                depends_on=depends_on if depends_on else None,
            )
            id_map[i] = task["id"]
            created_tasks.append(task)

        logger.info(
            "Decomposed goal into %d tasks (parent %s)",
            len(created_tasks),
            parent["id"][:8],
        )

        return [parent] + created_tasks
