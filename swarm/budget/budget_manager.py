"""
Budget manager: tracks daily API spend and Claude Code usage against limits.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import requests

from swarm.config import (
    BUDGET_DEFAULTS,
    DISCORD_WEBHOOK_URL,
    SUPABASE_KEY,
    SUPABASE_URL,
)

logger = logging.getLogger("swarm.budget")


class BudgetManager:
    """Manages daily budget tracking via Supabase swarm_budgets table."""

    TABLE = "swarm_budgets"

    def __init__(self):
        from supabase import create_client

        self.sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        self._ensure_today()

    # ── Internal helpers ──────────────────────────────────────────────────

    @staticmethod
    def _today_str() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _ensure_today(self) -> dict[str, Any]:
        """Ensure a budget row exists for today; create if missing."""
        today = self._today_str()
        resp = (
            self.sb.table(self.TABLE)
            .select("*")
            .eq("budget_date", today)
            .execute()
        )
        if resp.data:
            return resp.data[0]

        row = {
            "budget_date": today,
            "api_spent_cents": 0,
            "claude_code_minutes_used": 0,
            "daily_api_budget_cents": BUDGET_DEFAULTS["daily_api_budget_cents"],
            "daily_claude_code_minutes": BUDGET_DEFAULTS["daily_claude_code_minutes"],
            "tasks_completed": 0,
            "tasks_failed": 0,
        }
        insert_resp = self.sb.table(self.TABLE).insert(row).execute()
        return insert_resp.data[0] if insert_resp.data else row

    def _get_today(self) -> dict[str, Any]:
        today = self._today_str()
        resp = (
            self.sb.table(self.TABLE)
            .select("*")
            .eq("budget_date", today)
            .execute()
        )
        if not resp.data:
            return self._ensure_today()
        return resp.data[0]

    # ── Public API ────────────────────────────────────────────────────────

    def can_spend(self, tier: str) -> bool:
        """Check whether the swarm is within budget for a given cost tier.

        Args:
            tier: "light" or "heavy"

        Returns:
            True if within budget
        """
        row = self._get_today()
        if tier == "heavy":
            return (
                row["claude_code_minutes_used"] < row["daily_claude_code_minutes"]
            )
        return row["api_spent_cents"] < row["daily_api_budget_cents"]

    def record_spend(self, cents: float = 0, tokens: int = 0, minutes: float = 0):
        """Record API spend and/or Claude Code minutes for today.

        Args:
            cents: API cost in cents to add
            tokens: Token count to add (tracked at task level, not budget table)
            minutes: Claude Code minutes to add
        """
        row = self._get_today()
        update: dict[str, Any] = {}
        if cents > 0:
            update["api_spent_cents"] = round(row["api_spent_cents"] + cents, 4)
        if minutes > 0:
            update["claude_code_minutes_used"] = round(
                row["claude_code_minutes_used"] + minutes, 2
            )

        if update:
            update["updated_at"] = datetime.now(timezone.utc).isoformat()
            self.sb.table(self.TABLE).update(update).eq("id", row["id"]).execute()

        # Check thresholds after recording
        new_row = self._get_today()
        api_pct = (
            new_row["api_spent_cents"] / new_row["daily_api_budget_cents"] * 100
            if new_row["daily_api_budget_cents"] > 0
            else 0
        )
        cc_pct = (
            new_row["claude_code_minutes_used"]
            / new_row["daily_claude_code_minutes"]
            * 100
            if new_row["daily_claude_code_minutes"] > 0
            else 0
        )

        if api_pct >= 90:
            self.send_alert(
                "critical",
                f"API budget at {api_pct:.0f}% (${new_row['api_spent_cents']/100:.2f}/${new_row['daily_api_budget_cents']/100:.2f})",
            )
        elif api_pct >= 75:
            self.send_alert(
                "warning",
                f"API budget at {api_pct:.0f}% (${new_row['api_spent_cents']/100:.2f}/${new_row['daily_api_budget_cents']/100:.2f})",
            )

        if cc_pct >= 90:
            self.send_alert(
                "critical",
                f"Claude Code budget at {cc_pct:.0f}% ({new_row['claude_code_minutes_used']:.0f}/{new_row['daily_claude_code_minutes']} min)",
            )

    def record_task_result(self, success: bool):
        """Increment tasks_completed or tasks_failed for today."""
        row = self._get_today()
        field = "tasks_completed" if success else "tasks_failed"
        self.sb.table(self.TABLE).update(
            {field: row[field] + 1, "updated_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", row["id"]).execute()

    def get_status(self) -> dict[str, Any]:
        """Return current budget status for today."""
        row = self._get_today()
        return {
            "date": row["budget_date"],
            "api_spent_cents": row["api_spent_cents"],
            "daily_api_budget_cents": row["daily_api_budget_cents"],
            "api_pct": round(
                row["api_spent_cents"] / row["daily_api_budget_cents"] * 100, 1
            )
            if row["daily_api_budget_cents"] > 0
            else 0,
            "claude_code_minutes_used": row["claude_code_minutes_used"],
            "daily_claude_code_minutes": row["daily_claude_code_minutes"],
            "cc_pct": round(
                row["claude_code_minutes_used"]
                / row["daily_claude_code_minutes"]
                * 100,
                1,
            )
            if row["daily_claude_code_minutes"] > 0
            else 0,
            "tasks_completed": row["tasks_completed"],
            "tasks_failed": row["tasks_failed"],
        }

    def send_alert(self, level: str, message: str):
        """Send budget alert to Discord webhook.

        Args:
            level: "info", "warning", or "critical"
            message: Alert message body
        """
        if not DISCORD_WEBHOOK_URL:
            logger.warning("No DISCORD_WEBHOOK_URL set, skipping alert: %s", message)
            return

        emoji = {"info": "\u2139\ufe0f", "warning": "\u26a0\ufe0f", "critical": "\ud83d\udea8"}.get(
            level, "\u2139\ufe0f"
        )
        payload = {
            "content": f"{emoji} **Swarm Budget {level.upper()}**: {message}",
            "username": "Swarm Budget",
        }
        try:
            resp = requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=10)
            resp.raise_for_status()
        except Exception as e:
            logger.error("Failed to send Discord alert: %s", e)
