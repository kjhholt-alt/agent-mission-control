"""
Goal decomposer: breaks high-level user goals into structured meta-tasks.
"""

import json
import logging
from typing import Any

import anthropic

from swarm.config import ANTHROPIC_API_KEY, PROJECTS
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
    """Breaks user goals into structured tasks using Sonnet."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.task_manager = TaskManager()

    def decompose(self, user_prompt: str) -> list[dict[str, Any]]:
        """Decompose a user goal into meta-tasks and create them in Supabase.

        Args:
            user_prompt: High-level goal description

        Returns:
            List of created task dicts
        """
        projects_desc = "\n".join(
            f"  - {key}: {cfg['type']} project at {cfg['dir']}"
            for key, cfg in PROJECTS.items()
        )

        system = DECOMPOSE_SYSTEM.format(projects=projects_desc)

        logger.info("Decomposing goal: %s", user_prompt[:100])

        response = self.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
        )

        response_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                response_text += block.text

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
