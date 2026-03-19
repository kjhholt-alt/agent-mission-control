"""
Scout Agent: autonomous goal evaluator that runs every HOUR.

Evaluates current project state and recent completed work from swarm_memory,
suggests 5 goals ranked by impact, auto-fires ALL 5 as meta-tasks,
and posts a summary to Discord. The Hive must NEVER be idle.
"""

import json
import logging
import subprocess
import time
from datetime import datetime, timezone
from typing import Any, Optional

import requests

from swarm.config import (
    BLOCKED_PROJECTS,
    CLAUDE_CLI_PATH,
    DISCORD_WEBHOOK_URL,
    PROJECTS,
    SUPABASE_KEY,
    SUPABASE_URL,
)
from swarm.memory import SwarmMemory
from swarm.tasks.task_manager import TaskManager

logger = logging.getLogger("swarm.scout")

SCOUT_SYSTEM = """You are the Nexus Scout. Your #1 directive: NEVER let the Hive idle.
The factory processes 2.5 tasks/min and must always have a deep queue.

Available projects:
{projects}

Recent completed work:
{recent_work}

Failed approaches (avoid repeating these):
{failed_approaches}

Active/queued tasks (avoid duplicating these):
{active_tasks}

BLOCKED PROJECTS (DO NOT suggest tasks for these): {blocked_projects}

Generate EXACTLY 5 high-impact goals. Rotate through these categories:
1. Nexus UI/UX improvements (Palantir-grade dashboards, game view, visualizations)
2. Revenue actions (prospects, emails, outreach, proposals, landing pages)
3. Code quality (tests, types, refactoring, error handling, documentation)
4. Visual improvements (game view buildings, workers, animations, effects)
5. New features (tools, integrations, capabilities, MCP servers, automations)

For each goal:
- title: specific, actionable (not vague). Include the exact file or component to change.
- description: detailed enough that a worker can execute without asking questions
- project: which project it targets (must be from available projects list)
- priority: 1-100 (higher = more important). Revenue tasks get +20 boost.
- impact: high, medium, or low
- reasoning: why this matters RIGHT NOW

IMPORTANT RULES:
- DO NOT suggest tasks for blocked projects
- DO NOT duplicate active/queued tasks
- DO NOT repeat failed approaches
- ALWAYS suggest exactly 5 goals — the Hive must NEVER be idle
- Be SPECIFIC: "Add X to Y file" not "Improve the codebase"
- Mix quick wins (can finish in 5 min) with bigger features

Return a JSON array of 5 goal objects:
[
  {{
    "title": "Short goal title",
    "description": "Detailed description of what to do and why",
    "project": "project-key",
    "priority": 10,
    "impact": "high|medium|low",
    "reasoning": "Why this matters right now"
  }}
]

Return ONLY valid JSON, no markdown fences or extra text."""

TASK_LOG_TABLE = "swarm_task_log"


class ScoutAgent:
    """Autonomous scout that evaluates project state and fires goals."""

    SCOUT_INTERVAL = 60 * 60  # 1 hour in seconds

    def __init__(
        self,
        task_manager: Optional[TaskManager] = None,
        memory: Optional[SwarmMemory] = None,
    ):
        self.task_manager = task_manager or TaskManager()
        self.memory = memory or SwarmMemory()
        self.last_run: float = 0

        from supabase import create_client
        self.sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    def is_due(self) -> bool:
        """Check if it's time for a scout evaluation."""
        return time.time() - self.last_run > self.SCOUT_INTERVAL

    def run_evaluation(self):
        """Run a full scout evaluation cycle.

        1. Gather recent completed work from memory
        2. Ask Claude what to do next
        3. Auto-fire ALL 5 goals as meta-tasks (keep the Hive fed)
        4. Log what was fired and why
        5. Post summary to Discord
        """
        logger.info("Scout evaluation starting (hourly, 5 goals)")

        # 1. Gather context
        recent_work = self._gather_recent_work()
        failed_approaches = self._gather_failed_approaches()
        active_tasks = self._gather_active_tasks()

        # 2. Get suggestions from Claude
        suggestions = self._get_suggestions(recent_work, failed_approaches, active_tasks)
        if not suggestions:
            logger.warning("Scout produced no suggestions")
            return

        # Filter out any suggestions for blocked projects
        suggestions = [
            s for s in suggestions
            if s.get("project", "") not in BLOCKED_PROJECTS
        ]

        logger.info("Scout generated %d suggestions (after filtering blocked)", len(suggestions))

        # 3. Auto-fire ALL suggestions (up to 5) — the Hive must never idle
        fired = []
        for goal in suggestions[:5]:
            try:
                task = self.task_manager.create_task(
                    task_type="meta",
                    title=goal["title"][:100],
                    project=goal.get("project", "nexus"),
                    input_data={"prompt": goal["description"]},
                    cost_tier="light",
                    priority=goal.get("priority", 30),
                )
                fired.append({"goal": goal, "task_id": task["id"]})
                logger.info(
                    "Scout fired goal: %s (task %s)", goal["title"], task["id"][:8]
                )
            except Exception as e:
                logger.error("Scout failed to fire goal '%s': %s", goal["title"], e)

        # 4. Log to swarm_task_log
        self._log_scout_run(suggestions, fired)

        # 5. Post to Discord
        self._post_to_discord(suggestions, fired)

        self.last_run = time.time()
        logger.info("Scout evaluation complete. Fired %d goals.", len(fired))

    def _gather_recent_work(self) -> str:
        """Gather recent completed work across all projects."""
        sections = []
        for project_key in PROJECTS:
            if project_key in BLOCKED_PROJECTS:
                continue
            work = self.memory.recall(project_key, limit=5)
            if work:
                sections.append(f"[{project_key}]\n{work}")

        # Also gather cross-project work
        all_work = self.memory.recall("all", limit=20)
        if all_work:
            sections.append(f"[all projects]\n{all_work}")

        return "\n\n".join(sections) if sections else "No recent work found."

    def _gather_failed_approaches(self) -> str:
        """Gather recently failed approaches across all projects."""
        sections = []
        for project_key in PROJECTS:
            if project_key in BLOCKED_PROJECTS:
                continue
            failed = self.memory.get_failed_approaches(project_key)
            if failed:
                sections.append(f"[{project_key}]\n{failed}")
        return "\n\n".join(sections) if sections else "No recent failures."

    def _gather_active_tasks(self) -> str:
        """Get currently active/queued tasks to avoid duplicates."""
        try:
            active = self.task_manager.get_all_active()
            if not active:
                return "No active tasks."
            lines = []
            for t in active[:20]:
                lines.append(
                    f"  - [{t.get('status', '?')}] {t.get('title', '?')} ({t.get('project', '?')})"
                )
            return "\n".join(lines)
        except Exception as e:
            logger.debug("Failed to gather active tasks: %s", e)
            return "Could not fetch active tasks."

    def _get_suggestions(
        self, recent_work: str, failed_approaches: str, active_tasks: str
    ) -> list[dict[str, Any]]:
        """Ask Claude Code CLI (Opus, free) for goal suggestions."""
        projects_desc = "\n".join(
            f"  - {key}: {cfg['type']} project at {cfg['dir']}"
            for key, cfg in PROJECTS.items()
            if key not in BLOCKED_PROJECTS
        )

        system = SCOUT_SYSTEM.format(
            projects=projects_desc,
            recent_work=recent_work,
            failed_approaches=failed_approaches,
            active_tasks=active_tasks,
            blocked_projects=", ".join(BLOCKED_PROJECTS),
        )

        prompt = (
            f"{system}\n\n"
            f"Evaluate the current state and suggest EXACTLY 5 goals for the swarm "
            f"to pursue next. The Hive must NEVER idle. Return ONLY a valid JSON array, no markdown fences."
        )

        try:
            # Use stdin to avoid Windows command-line length limits
            result = subprocess.run(
                [CLAUDE_CLI_PATH, "-p", "-"],
                capture_output=True,
                text=True,
                input=prompt,
                timeout=300,  # 5 min max
                cwd="C:/Users/Kruz/Desktop/Projects/nexus",
                shell=True,
                encoding="utf-8",
                errors="replace",
            )

            response_text = result.stdout or ""

            # Parse JSON
            text = response_text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(
                    lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                )

            import re
            json_match = re.search(r"\[[\s\S]*\]", text)
            if json_match:
                text = json_match.group(0)

            suggestions = json.loads(text)
            if not isinstance(suggestions, list):
                logger.error("Scout response is not a list")
                return []
            return suggestions

        except Exception as e:
            logger.error("Scout Claude Code call failed: %s", e)
            return []

    def _log_scout_run(
        self, suggestions: list[dict[str, Any]], fired: list[dict[str, Any]]
    ):
        """Log the scout run to swarm_task_log (or swarm_memory as fallback)."""
        log_entry = {
            "event": "scout_evaluation",
            "suggestions_count": len(suggestions),
            "fired_count": len(fired),
            "suggestions": [
                {"title": s.get("title", "?"), "impact": s.get("impact", "?")}
                for s in suggestions
            ],
            "fired": [
                {"title": f["goal"].get("title", "?"), "task_id": f["task_id"]}
                for f in fired
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Try swarm_task_log first
        try:
            self.sb.table(TASK_LOG_TABLE).insert(
                {
                    "event_type": "scout_evaluation",
                    "details": json.dumps(log_entry),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            ).execute()
            logger.debug("Logged scout run to swarm_task_log")
        except Exception:
            # Fallback: store in memory
            self.memory.store(
                project="nexus",
                task_title="Scout Evaluation",
                output=json.dumps(log_entry, indent=2),
                task_type="scout",
            )
            logger.debug("Logged scout run to swarm_memory (fallback)")

    def _post_to_discord(
        self, suggestions: list[dict[str, Any]], fired: list[dict[str, Any]]
    ):
        """Post scout summary to Discord webhook."""
        if not DISCORD_WEBHOOK_URL:
            logger.debug("No DISCORD_WEBHOOK_URL set, skipping scout Discord post")
            return

        # Build embed
        fired_lines = []
        for f in fired:
            title = f["goal"].get("title", "?")
            project = f["goal"].get("project", "?")
            fired_lines.append(f"**{title}** ({project})")

        other_lines = []
        for s in suggestions[5:]:
            other_lines.append(
                f"- {s.get('title', '?')} [{s.get('impact', '?')}]"
            )

        embed = {
            "title": "Scout Evaluation Complete",
            "color": 0x00CED1,  # Dark turquoise
            "fields": [
                {
                    "name": "Auto-Fired Goals",
                    "value": "\n".join(fired_lines) if fired_lines else "None",
                    "inline": False,
                },
            ],
            "footer": {"text": "Nexus Hive Scout"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if other_lines:
            embed["fields"].append(
                {
                    "name": "Other Suggestions",
                    "value": "\n".join(other_lines),
                    "inline": False,
                }
            )

        payload = {"embeds": [embed]}

        try:
            resp = requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=10)
            if resp.status_code >= 400:
                logger.warning("Discord webhook returned %d", resp.status_code)
        except Exception as e:
            logger.warning("Failed to post scout summary to Discord: %s", e)
