"""
Oracle: The user's personal AI assistant within the Nexus Hive.

Oracle watches everything, filters noise, and only surfaces:
- Decisions that need human input
- Milestone achievements
- Anomalies or problems
- Revenue opportunities
- Weekly/daily summaries
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import requests

from swarm.config import (
    DISCORD_WEBHOOK_URL,
    SUPABASE_KEY,
    SUPABASE_URL,
    BUDGET_DEFAULTS,
    PROJECTS,
)

logger = logging.getLogger("swarm.oracle")

# Gold color for Oracle embeds
ORACLE_GOLD = 0xE8A019
ORACLE_GOLD_HEX = "#e8a019"


class Oracle:
    """The user's personal AI assistant within the Nexus Hive.

    Oracle watches everything, filters noise, and only surfaces:
    - Decisions that need human input
    - Milestone achievements
    - Anomalies or problems
    - Revenue opportunities
    - Weekly/daily summaries
    """

    TABLE_BRIEFINGS = "oracle_briefings"
    TABLE_TASKS = "swarm_tasks"
    TABLE_WORKERS = "swarm_workers"
    TABLE_BUDGETS = "swarm_budgets"

    def __init__(
        self,
        supabase_client=None,
        memory=None,
        discord_webhook_url: Optional[str] = None,
    ):
        if supabase_client:
            self.sb = supabase_client
        else:
            from supabase import create_client
            self.sb = create_client(SUPABASE_URL, SUPABASE_KEY)

        self.memory = memory
        self.webhook_url = discord_webhook_url or DISCORD_WEBHOOK_URL
        self._last_briefing: Optional[datetime] = None
        self._last_daily: Optional[datetime] = None
        self._last_weekly: Optional[datetime] = None

    # ── Scheduling helpers ─────────────────────────────────────────────────

    def is_briefing_due(self) -> bool:
        """Check if it's time for a briefing (every 2 hours)."""
        if self._last_briefing is None:
            return True
        return datetime.now(timezone.utc) - self._last_briefing > timedelta(hours=2)

    def is_daily_due(self) -> bool:
        """Check if it's time for the daily digest (6pm UTC)."""
        now = datetime.now(timezone.utc)
        if self._last_daily and self._last_daily.date() == now.date():
            return False
        return now.hour >= 18

    def is_weekly_due(self) -> bool:
        """Check if it's time for the weekly report (Sunday)."""
        now = datetime.now(timezone.utc)
        if self._last_weekly and (now - self._last_weekly) < timedelta(days=6):
            return False
        return now.weekday() == 6 and now.hour >= 9

    # ── Main briefing ──────────────────────────────────────────────────────

    def run_briefing(self) -> dict[str, Any]:
        """Generate a briefing of what the user needs to know RIGHT NOW.

        Returns:
            Briefing dict with sections: decisions, highlights, budget, health, next_steps
        """
        logger.info("Oracle generating briefing...")

        decisions = self.check_decisions_needed()
        highlights = self._get_recent_highlights()
        budget_status = self._get_budget_status()
        project_health = self._get_project_health()
        next_steps = self._get_next_steps()

        briefing = {
            "type": "briefing",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "greeting": self._get_greeting(),
            "decisions_needed": decisions,
            "highlights": highlights,
            "budget": budget_status,
            "project_health": project_health,
            "next_steps": next_steps,
            "summary": self._compose_summary(decisions, highlights, budget_status),
        }

        # Store to Supabase
        self._store_briefing(briefing)

        # Post to Discord
        self._post_to_discord(briefing)

        self._last_briefing = datetime.now(timezone.utc)
        logger.info("Oracle briefing complete: %d decisions, %d highlights",
                     len(decisions), len(highlights))
        return briefing

    # ── Decisions needed ───────────────────────────────────────────────────

    def check_decisions_needed(self) -> list[dict[str, Any]]:
        """Find things that REQUIRE human input.

        Checks:
        - Tasks that failed 3x and need redirection
        - Budget approaching limit (>80%)
        - Tasks stuck in running state too long
        """
        decisions = []

        # 1. Tasks failed max retries
        try:
            resp = (
                self.sb.table(self.TABLE_TASKS)
                .select("id, title, project, error_message, retry_count, max_retries")
                .eq("status", "failed")
                .order("completed_at", desc=True)
                .limit(10)
                .execute()
            )
            for task in resp.data or []:
                if task.get("retry_count", 0) >= task.get("max_retries", 3):
                    decisions.append({
                        "type": "failed_task",
                        "severity": "high",
                        "title": f"Task failed {task['retry_count']}x: {task['title']}",
                        "detail": task.get("error_message", "No error recorded")[:200],
                        "task_id": task["id"],
                        "project": task.get("project", "unknown"),
                        "actions": ["retry", "redirect", "dismiss"],
                    })
        except Exception as e:
            logger.warning("Failed to check failed tasks: %s", e)

        # 2. Budget threshold check
        budget = self._get_budget_status()
        if budget.get("api_pct", 0) >= 80:
            decisions.append({
                "type": "budget_warning",
                "severity": "critical" if budget["api_pct"] >= 95 else "high",
                "title": f"API budget at {budget['api_pct']:.0f}%",
                "detail": f"${budget['api_spent'] / 100:.2f} / ${budget['api_limit'] / 100:.2f} spent today",
                "actions": ["increase_budget", "pause_workers", "dismiss"],
            })

        # 3. Stuck tasks (running for more than 30 minutes)
        try:
            cutoff = (
                datetime.now(timezone.utc) - timedelta(minutes=30)
            ).isoformat()
            resp = (
                self.sb.table(self.TABLE_TASKS)
                .select("id, title, project, started_at, assigned_worker_id")
                .eq("status", "running")
                .lt("started_at", cutoff)
                .execute()
            )
            for task in resp.data or []:
                decisions.append({
                    "type": "stuck_task",
                    "severity": "medium",
                    "title": f"Task stuck: {task['title']}",
                    "detail": f"Running since {task.get('started_at', 'unknown')} in {task.get('project', 'unknown')}",
                    "task_id": task["id"],
                    "project": task.get("project", "unknown"),
                    "actions": ["retry", "cancel", "dismiss"],
                })
        except Exception as e:
            logger.warning("Failed to check stuck tasks: %s", e)

        # 4. Workers that died
        try:
            cutoff = (
                datetime.now(timezone.utc) - timedelta(hours=2)
            ).isoformat()
            resp = (
                self.sb.table(self.TABLE_WORKERS)
                .select("id, worker_name, worker_type, died_at")
                .eq("status", "dead")
                .gte("died_at", cutoff)
                .execute()
            )
            if resp.data and len(resp.data) >= 2:
                decisions.append({
                    "type": "worker_deaths",
                    "severity": "medium",
                    "title": f"{len(resp.data)} workers died in the last 2 hours",
                    "detail": "Multiple worker deaths may indicate a systemic issue",
                    "actions": ["investigate", "restart_swarm", "dismiss"],
                })
        except Exception as e:
            logger.warning("Failed to check dead workers: %s", e)

        return decisions

    # ── Daily digest ───────────────────────────────────────────────────────

    def generate_daily_digest(self) -> dict[str, Any]:
        """End-of-day summary.

        Returns:
            Digest dict with accomplishments, costs, highlights, and tomorrow's plan
        """
        logger.info("Oracle generating daily digest...")

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Tasks completed today
        completed = self._get_tasks_completed_today()
        failed = self._get_tasks_failed_today()
        budget = self._get_budget_status()

        # Top highlights
        highlights = []
        for task in completed[:5]:
            highlights.append(f"Completed: {task['title']} ({task.get('project', '?')})")

        # Blockers
        blockers = []
        for task in failed:
            blockers.append(f"Failed: {task['title']} - {task.get('error_message', 'unknown')[:100]}")

        digest = {
            "type": "daily_digest",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "date": today,
            "tasks_completed": len(completed),
            "tasks_failed": len(failed),
            "total_cost_cents": budget.get("api_spent", 0),
            "highlights": highlights[:3],
            "blockers": blockers[:3],
            "tomorrow": self._get_next_steps()[:3],
            "budget_summary": f"${budget.get('api_spent', 0) / 100:.2f} spent today ({budget.get('api_pct', 0):.0f}% of daily budget)",
        }

        self._store_briefing(digest)
        self._post_digest_to_discord(digest)

        self._last_daily = datetime.now(timezone.utc)
        logger.info("Daily digest complete: %d completed, %d failed",
                     len(completed), len(failed))
        return digest

    # ── Weekly report ──────────────────────────────────────────────────────

    def generate_weekly_report(self) -> dict[str, Any]:
        """Weekly strategic review.

        Returns:
            Report dict with week-over-week comparisons and recommendations
        """
        logger.info("Oracle generating weekly report...")

        now = datetime.now(timezone.utc)
        week_start = (now - timedelta(days=7)).isoformat()

        # This week's stats
        try:
            resp = (
                self.sb.table(self.TABLE_TASKS)
                .select("id, title, status, project, actual_cost_cents, tokens_used, completed_at")
                .gte("created_at", week_start)
                .execute()
            )
            tasks_this_week = resp.data or []
        except Exception:
            tasks_this_week = []

        completed_this_week = [t for t in tasks_this_week if t["status"] == "completed"]
        failed_this_week = [t for t in tasks_this_week if t["status"] == "failed"]
        total_cost = sum(t.get("actual_cost_cents", 0) or 0 for t in tasks_this_week)
        total_tokens = sum(t.get("tokens_used", 0) or 0 for t in tasks_this_week)

        # Per-project breakdown
        project_stats: dict[str, dict[str, int]] = {}
        for task in tasks_this_week:
            proj = task.get("project", "unknown")
            if proj not in project_stats:
                project_stats[proj] = {"completed": 0, "failed": 0, "total": 0}
            project_stats[proj]["total"] += 1
            if task["status"] == "completed":
                project_stats[proj]["completed"] += 1
            elif task["status"] == "failed":
                project_stats[proj]["failed"] += 1

        report = {
            "type": "weekly_report",
            "timestamp": now.isoformat(),
            "week_ending": now.strftime("%Y-%m-%d"),
            "tasks_completed": len(completed_this_week),
            "tasks_failed": len(failed_this_week),
            "total_tasks": len(tasks_this_week),
            "total_cost_cents": total_cost,
            "total_tokens": total_tokens,
            "success_rate": round(
                len(completed_this_week) / len(tasks_this_week) * 100, 1
            ) if tasks_this_week else 0,
            "project_breakdown": project_stats,
            "recommendations": self._generate_recommendations(
                completed_this_week, failed_this_week, project_stats, total_cost
            ),
        }

        self._store_briefing(report)
        self._post_weekly_to_discord(report)

        self._last_weekly = datetime.now(timezone.utc)
        logger.info("Weekly report complete: %d tasks, $%.2f spent",
                     len(tasks_this_week), total_cost / 100)
        return report

    # ── Internal data gathering ────────────────────────────────────────────

    def _get_greeting(self) -> str:
        """Generate a time-appropriate greeting."""
        hour = datetime.now(timezone.utc).hour
        # Approximate Eastern time (UTC-5)
        eastern_hour = (hour - 5) % 24
        if eastern_hour < 12:
            return "Good morning, Kruz. Here's what you need to know:"
        elif eastern_hour < 17:
            return "Good afternoon, Kruz. Here's your update:"
        else:
            return "Good evening, Kruz. Here's the latest:"

    def _get_recent_highlights(self) -> list[dict[str, Any]]:
        """Get notable task completions since last briefing."""
        since = self._last_briefing or (
            datetime.now(timezone.utc) - timedelta(hours=2)
        )
        try:
            resp = (
                self.sb.table(self.TABLE_TASKS)
                .select("id, title, project, completed_at, output_data, actual_cost_cents")
                .eq("status", "completed")
                .gte("completed_at", since.isoformat())
                .neq("task_type", "meta")
                .order("completed_at", desc=True)
                .limit(10)
                .execute()
            )
            highlights = []
            for task in resp.data or []:
                output = task.get("output_data", {})
                summary = ""
                if isinstance(output, dict):
                    summary = output.get("response", output.get("stdout", ""))[:150]
                highlights.append({
                    "title": task["title"],
                    "project": task.get("project", "unknown"),
                    "completed_at": task.get("completed_at"),
                    "summary": summary,
                })
            return highlights
        except Exception as e:
            logger.warning("Failed to get highlights: %s", e)
            return []

    def _get_budget_status(self) -> dict[str, Any]:
        """Get today's budget status."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        try:
            resp = (
                self.sb.table(self.TABLE_BUDGETS)
                .select("*")
                .eq("budget_date", today)
                .limit(1)
                .execute()
            )
            if resp.data:
                row = resp.data[0]
                api_limit = row.get("daily_api_budget_cents", BUDGET_DEFAULTS["daily_api_budget_cents"])
                api_spent = row.get("api_spent_cents", 0)
                return {
                    "api_spent": api_spent,
                    "api_limit": api_limit,
                    "api_pct": round(api_spent / api_limit * 100, 1) if api_limit > 0 else 0,
                    "cc_minutes_used": row.get("claude_code_minutes_used", 0),
                    "cc_minutes_limit": row.get("daily_claude_code_minutes", BUDGET_DEFAULTS["daily_claude_code_minutes"]),
                    "tasks_completed": row.get("tasks_completed", 0),
                    "tasks_failed": row.get("tasks_failed", 0),
                }
        except Exception as e:
            logger.warning("Failed to get budget: %s", e)

        return {
            "api_spent": 0, "api_limit": BUDGET_DEFAULTS["daily_api_budget_cents"],
            "api_pct": 0, "cc_minutes_used": 0,
            "cc_minutes_limit": BUDGET_DEFAULTS["daily_claude_code_minutes"],
            "tasks_completed": 0, "tasks_failed": 0,
        }

    def _get_project_health(self) -> dict[str, str]:
        """Get health status for each project (green/yellow/red)."""
        health: dict[str, str] = {}
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

        for project_key in PROJECTS:
            try:
                resp = (
                    self.sb.table(self.TABLE_TASKS)
                    .select("status")
                    .eq("project", project_key)
                    .gte("created_at", cutoff)
                    .execute()
                )
                tasks = resp.data or []
                if not tasks:
                    health[project_key] = "idle"
                    continue

                failed = sum(1 for t in tasks if t["status"] == "failed")
                completed = sum(1 for t in tasks if t["status"] == "completed")
                total = len(tasks)

                if failed > completed and failed > 2:
                    health[project_key] = "red"
                elif failed > 0:
                    health[project_key] = "yellow"
                elif completed > 0:
                    health[project_key] = "green"
                else:
                    health[project_key] = "idle"
            except Exception:
                health[project_key] = "unknown"

        return health

    def _get_next_steps(self) -> list[str]:
        """Get upcoming queued tasks as next steps."""
        try:
            resp = (
                self.sb.table(self.TABLE_TASKS)
                .select("title, project, priority")
                .eq("status", "queued")
                .neq("task_type", "meta")
                .order("priority", desc=False)
                .limit(5)
                .execute()
            )
            return [
                f"[{t.get('project', '?')}] {t['title']}"
                for t in (resp.data or [])
            ]
        except Exception:
            return []

    def _get_tasks_completed_today(self) -> list[dict[str, Any]]:
        """Get all tasks completed today."""
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
        try:
            resp = (
                self.sb.table(self.TABLE_TASKS)
                .select("id, title, project, completed_at, actual_cost_cents")
                .eq("status", "completed")
                .gte("completed_at", today_start)
                .neq("task_type", "meta")
                .order("completed_at", desc=True)
                .execute()
            )
            return resp.data or []
        except Exception:
            return []

    def _get_tasks_failed_today(self) -> list[dict[str, Any]]:
        """Get all tasks that failed today."""
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
        try:
            resp = (
                self.sb.table(self.TABLE_TASKS)
                .select("id, title, project, error_message, completed_at")
                .eq("status", "failed")
                .gte("completed_at", today_start)
                .order("completed_at", desc=True)
                .execute()
            )
            return resp.data or []
        except Exception:
            return []

    def _compose_summary(
        self,
        decisions: list[dict[str, Any]],
        highlights: list[dict[str, Any]],
        budget: dict[str, Any],
    ) -> str:
        """Compose a one-paragraph summary of the current state."""
        parts = []

        if decisions:
            critical = [d for d in decisions if d.get("severity") == "critical"]
            high = [d for d in decisions if d.get("severity") == "high"]
            if critical:
                parts.append(f"{len(critical)} critical issue(s) need your attention")
            if high:
                parts.append(f"{len(high)} item(s) need your input")

        if highlights:
            parts.append(f"{len(highlights)} task(s) completed since last briefing")

        api_pct = budget.get("api_pct", 0)
        if api_pct > 0:
            parts.append(f"budget at {api_pct:.0f}%")

        if not parts:
            return "All quiet. The swarm is running smoothly."

        return ". ".join(parts).capitalize() + "."

    def _generate_recommendations(
        self,
        completed: list[dict[str, Any]],
        failed: list[dict[str, Any]],
        project_stats: dict[str, dict[str, int]],
        total_cost: int,
    ) -> list[str]:
        """Generate strategic recommendations for the weekly report."""
        recs = []

        # Check for high failure rate projects
        for proj, stats in project_stats.items():
            if stats["total"] > 0:
                fail_rate = stats["failed"] / stats["total"]
                if fail_rate > 0.5 and stats["failed"] > 2:
                    recs.append(
                        f"High failure rate in {proj} ({stats['failed']}/{stats['total']}). "
                        f"Consider reviewing task complexity or worker allocation."
                    )

        # Cost efficiency
        if total_cost > 0 and completed:
            cost_per_task = total_cost / len(completed)
            if cost_per_task > 50:  # more than $0.50 per task
                recs.append(
                    f"Cost per completed task is ${cost_per_task/100:.2f}. "
                    f"Consider using lighter workers or smaller task scopes."
                )

        # Low activity
        if len(completed) < 5:
            recs.append(
                "Low task throughput this week. Consider adding more goals or checking "
                "if the swarm needs configuration changes."
            )

        if not recs:
            recs.append("Swarm is performing well. No adjustments needed.")

        return recs

    # ── Storage ────────────────────────────────────────────────────────────

    def _store_briefing(self, briefing: dict[str, Any]):
        """Store briefing to Supabase for the dashboard."""
        try:
            self.sb.table(self.TABLE_BRIEFINGS).insert({
                "briefing_type": briefing["type"],
                "data": json.dumps(briefing),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.warning("Failed to store briefing (table may not exist yet): %s", e)

    # ── Discord integration ────────────────────────────────────────────────

    def _post_to_discord(self, briefing: dict[str, Any]):
        """Post briefing to Discord as a rich embed."""
        if not self.webhook_url:
            logger.debug("No Discord webhook URL, skipping post")
            return

        decisions = briefing.get("decisions_needed", [])
        highlights = briefing.get("highlights", [])
        budget = briefing.get("budget", {})
        health = briefing.get("project_health", {})

        fields = []

        # Decisions
        if decisions:
            decision_lines = []
            for d in decisions[:5]:
                severity_icon = {"critical": "!!!", "high": "!!", "medium": "!"}.get(
                    d.get("severity", "medium"), "!"
                )
                decision_lines.append(f"[{severity_icon}] {d['title']}")
            fields.append({
                "name": "Decisions Needed",
                "value": "\n".join(decision_lines) or "None",
                "inline": False,
            })

        # Highlights
        if highlights:
            highlight_lines = [
                f"- {h['title']} ({h.get('project', '?')})"
                for h in highlights[:5]
            ]
            fields.append({
                "name": "Recent Highlights",
                "value": "\n".join(highlight_lines) or "None",
                "inline": False,
            })

        # Budget
        fields.append({
            "name": "Budget Status",
            "value": (
                f"API: ${budget.get('api_spent', 0) / 100:.2f} / "
                f"${budget.get('api_limit', 500) / 100:.2f} "
                f"({budget.get('api_pct', 0):.0f}%)\n"
                f"Tasks: {budget.get('tasks_completed', 0)} done, "
                f"{budget.get('tasks_failed', 0)} failed"
            ),
            "inline": True,
        })

        # Health
        if health:
            health_lines = []
            status_icons = {"green": "[OK]", "yellow": "[!!]", "red": "[XX]", "idle": "[--]", "unknown": "[??]"}
            for proj, status in health.items():
                health_lines.append(f"{status_icons.get(status, '[??]')} {proj}")
            if health_lines:
                fields.append({
                    "name": "Project Health",
                    "value": "\n".join(health_lines),
                    "inline": True,
                })

        # Next steps
        next_steps = briefing.get("next_steps", [])
        if next_steps:
            fields.append({
                "name": "Next Steps",
                "value": "\n".join(f"- {s}" for s in next_steps[:3]),
                "inline": False,
            })

        embed = {
            "title": "Oracle Briefing",
            "description": briefing.get("greeting", ""),
            "color": ORACLE_GOLD,
            "fields": fields,
            "footer": {"text": "Oracle | Nexus Hive"},
            "timestamp": briefing.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }

        self._send_discord_embed(embed)

    def _post_digest_to_discord(self, digest: dict[str, Any]):
        """Post daily digest to Discord."""
        if not self.webhook_url:
            return

        highlights_text = "\n".join(f"- {h}" for h in digest.get("highlights", [])) or "None"
        blockers_text = "\n".join(f"- {b}" for b in digest.get("blockers", [])) or "None"
        tomorrow_text = "\n".join(f"- {t}" for t in digest.get("tomorrow", [])) or "TBD"

        embed = {
            "title": f"Oracle Daily Digest - {digest.get('date', 'Today')}",
            "color": ORACLE_GOLD,
            "fields": [
                {
                    "name": "Summary",
                    "value": (
                        f"Completed: {digest.get('tasks_completed', 0)} | "
                        f"Failed: {digest.get('tasks_failed', 0)} | "
                        f"Spent: {digest.get('budget_summary', 'N/A')}"
                    ),
                    "inline": False,
                },
                {"name": "Top Highlights", "value": highlights_text, "inline": False},
                {"name": "Blockers", "value": blockers_text, "inline": False},
                {"name": "Tomorrow", "value": tomorrow_text, "inline": False},
            ],
            "footer": {"text": "Oracle | End of Day"},
            "timestamp": digest.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }

        self._send_discord_embed(embed)

    def _post_weekly_to_discord(self, report: dict[str, Any]):
        """Post weekly report to Discord."""
        if not self.webhook_url:
            return

        # Project breakdown
        breakdown_lines = []
        for proj, stats in report.get("project_breakdown", {}).items():
            breakdown_lines.append(
                f"**{proj}**: {stats['completed']}/{stats['total']} done "
                f"({stats['failed']} failed)"
            )
        breakdown_text = "\n".join(breakdown_lines) or "No projects active"

        # Recommendations
        recs_text = "\n".join(
            f"- {r}" for r in report.get("recommendations", [])
        ) or "None"

        embed = {
            "title": f"Oracle Weekly Report - Week Ending {report.get('week_ending', '?')}",
            "color": ORACLE_GOLD,
            "fields": [
                {
                    "name": "This Week",
                    "value": (
                        f"Tasks: {report.get('tasks_completed', 0)} completed, "
                        f"{report.get('tasks_failed', 0)} failed "
                        f"(of {report.get('total_tasks', 0)} total)\n"
                        f"Success Rate: {report.get('success_rate', 0)}%\n"
                        f"Total Spend: ${report.get('total_cost_cents', 0) / 100:.2f}\n"
                        f"Total Tokens: {report.get('total_tokens', 0):,}"
                    ),
                    "inline": False,
                },
                {"name": "Project Breakdown", "value": breakdown_text, "inline": False},
                {"name": "Recommendations", "value": recs_text, "inline": False},
            ],
            "footer": {"text": "Oracle | Weekly Strategic Review"},
            "timestamp": report.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }

        self._send_discord_embed(embed)

    def _send_discord_embed(self, embed: dict[str, Any]):
        """Send a Discord embed via webhook."""
        payload = {
            "username": "Oracle",
            "embeds": [embed],
        }
        try:
            resp = requests.post(self.webhook_url, json=payload, timeout=10)
            resp.raise_for_status()
            logger.debug("Posted Oracle embed to Discord")
        except Exception as e:
            logger.error("Failed to post to Discord: %s", e)

    # ── API for dashboard ──────────────────────────────────────────────────

    def get_latest_briefing(self) -> Optional[dict[str, Any]]:
        """Get the most recent briefing from Supabase."""
        try:
            resp = (
                self.sb.table(self.TABLE_BRIEFINGS)
                .select("*")
                .eq("briefing_type", "briefing")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if resp.data:
                data = resp.data[0].get("data")
                if isinstance(data, str):
                    return json.loads(data)
                return data
        except Exception as e:
            logger.warning("Failed to get latest briefing: %s", e)
        return None

    def get_latest_digest(self) -> Optional[dict[str, Any]]:
        """Get the most recent daily digest."""
        try:
            resp = (
                self.sb.table(self.TABLE_BRIEFINGS)
                .select("*")
                .eq("briefing_type", "daily_digest")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if resp.data:
                data = resp.data[0].get("data")
                if isinstance(data, str):
                    return json.loads(data)
                return data
        except Exception as e:
            logger.warning("Failed to get latest digest: %s", e)
        return None

    def get_recent_briefings(self, limit: int = 10) -> list[dict[str, Any]]:
        """Get recent briefings of all types."""
        try:
            resp = (
                self.sb.table(self.TABLE_BRIEFINGS)
                .select("*")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            results = []
            for row in resp.data or []:
                data = row.get("data")
                if isinstance(data, str):
                    data = json.loads(data)
                results.append(data)
            return results
        except Exception as e:
            logger.warning("Failed to get recent briefings: %s", e)
            return []
