"""
Discord reporter for The Terminal hub.
Posts swarm progress updates to Discord channels via webhooks.
"""
import json
import logging
from typing import Optional

import requests

logger = logging.getLogger("swarm.discord_reporter")

# The Terminal Discord webhook URLs
WEBHOOKS = {
    "projects": "https://discord.com/api/webhooks/1485505125626675372/YIKDm1Uo_dB289aqyoNZkaS5XFNXOEoFHxSM54gvrsbL6dNb5MCU9BWwI998WowDj6dG",
    "code_review": None,  # Uses bot reply, not webhook
    "deploys": "https://discord.com/api/webhooks/1485495823956578496/BsPumSe3P8H9DpzutXywhCnBXDFCNNGE4bUaDlOZnAAaqgeMJY43O88TEmIi3f2Z3Q0A",
    "automations": "https://discord.com/api/webhooks/1485497818800980110/cZuhlKny2JRjPuMoAy2gZbfIjnwMN0_xpSreujhuEogCJNDVRniPB0gvK6LhOrGOGeRC",
}

# Color constants
GREEN = 3066993
RED = 15158332
AMBER = 16776960
CYAN = 3447003
PURPLE = 10181046


def _post_webhook(webhook_url: str, payload: dict) -> bool:
    """Post a payload to a Discord webhook URL."""
    try:
        resp = requests.post(webhook_url, json=payload, timeout=10)
        return resp.status_code in (200, 204)
    except Exception as e:
        logger.error("Discord webhook failed: %s", e)
        return False


def report_task_spawned(goal: str, project: str, worker_count: int = 1, team: bool = False):
    """Report that a task or team has been spawned."""
    title = "🚀 Swarm Team Spawned" if team else "🚀 Task Spawned"
    embed = {
        "title": title,
        "description": f"**{goal}**",
        "color": CYAN,
        "fields": [
            {"name": "Project", "value": project or "general", "inline": True},
            {"name": "Workers", "value": str(worker_count), "inline": True},
        ],
        "footer": {"text": "The Terminal - Swarm"},
    }
    _post_webhook(WEBHOOKS["projects"], {"embeds": [embed]})


def report_task_progress(task_title: str, status: str, progress_pct: Optional[int] = None):
    """Report task progress update."""
    emoji = "⏳" if status == "running" else "🔄"
    desc = f"{emoji} **{task_title}**"
    if progress_pct is not None:
        desc += f" — {progress_pct}%"

    embed = {
        "title": "Swarm Progress",
        "description": desc,
        "color": AMBER,
        "footer": {"text": "The Terminal - Swarm"},
    }
    _post_webhook(WEBHOOKS["projects"], {"embeds": [embed]})


def report_task_complete(task_title: str, project: str, output_summary: str, has_code_changes: bool = False):
    """Report task completion."""
    embed = {
        "title": "✅ Task Complete",
        "description": f"**{task_title}**",
        "color": GREEN,
        "fields": [
            {"name": "Project", "value": project or "general", "inline": True},
            {"name": "Output", "value": output_summary[:500], "inline": False},
        ],
        "footer": {"text": "The Terminal - Swarm"},
    }
    _post_webhook(WEBHOOKS["projects"], {"embeds": [embed]})


def report_task_failed(task_title: str, error: str, project: str = ""):
    """Report task failure."""
    embed = {
        "title": "❌ Task Failed",
        "description": f"**{task_title}**",
        "color": RED,
        "fields": [
            {"name": "Project", "value": project or "general", "inline": True},
            {"name": "Error", "value": error[:300], "inline": False},
        ],
        "footer": {"text": "The Terminal - Swarm"},
    }
    _post_webhook(WEBHOOKS["automations"], {"embeds": [embed]})


def report_team_complete(goal: str, tasks_completed: int, tasks_failed: int, total_duration_s: float):
    """Report team goal completion."""
    status = "✅" if tasks_failed == 0 else "⚠️"
    embed = {
        "title": f"{status} Swarm Team Finished",
        "description": f"**{goal}**",
        "color": GREEN if tasks_failed == 0 else AMBER,
        "fields": [
            {"name": "Completed", "value": str(tasks_completed), "inline": True},
            {"name": "Failed", "value": str(tasks_failed), "inline": True},
            {"name": "Duration", "value": f"{total_duration_s / 60:.1f} min", "inline": True},
        ],
        "footer": {"text": "The Terminal - Swarm"},
    }
    _post_webhook(WEBHOOKS["projects"], {"embeds": [embed]})
