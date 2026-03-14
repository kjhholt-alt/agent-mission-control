"""
Swarm Memory / Context Bank: stores and recalls task outputs per project
so future tasks can reference what's already been done.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from swarm.config import SUPABASE_KEY, SUPABASE_URL

logger = logging.getLogger("swarm.memory")

# Table for dedicated memory storage
MEMORY_TABLE = "swarm_memory"
# Fallback: reuse the task log table
TASKS_TABLE = "swarm_tasks"


class SwarmMemory:
    """Context bank that stores and retrieves task outputs per project."""

    def __init__(self, supabase_client=None):
        """Initialize with an existing Supabase client or create one.

        Args:
            supabase_client: Optional existing Supabase client instance
        """
        if supabase_client:
            self.sb = supabase_client
        else:
            from supabase import create_client
            self.sb = create_client(SUPABASE_URL, SUPABASE_KEY)

        self._memory_table_available: Optional[bool] = None

    def _has_memory_table(self) -> bool:
        """Check if the swarm_memory table exists (cached)."""
        if self._memory_table_available is not None:
            return self._memory_table_available

        try:
            self.sb.table(MEMORY_TABLE).select("id").limit(1).execute()
            self._memory_table_available = True
        except Exception:
            logger.debug("swarm_memory table not available, using swarm_tasks fallback")
            self._memory_table_available = False

        return self._memory_table_available

    # ── Store ──────────────────────────────────────────────────────────────

    def store(
        self,
        project: str,
        task_title: str,
        output: str,
        task_type: Optional[str] = None,
        tokens_used: int = 0,
    ):
        """Store a task result in the context bank.

        Args:
            project: Project key (e.g. "nexus", "pl-engine")
            task_title: Human-readable task title
            output: The task output/result text
            task_type: Optional task type for categorization
            tokens_used: Tokens consumed by this task
        """
        if not self._has_memory_table():
            logger.debug("Skipping memory store (no swarm_memory table)")
            return

        # Truncate output for summary (first 500 chars)
        summary = output[:500] if len(output) > 500 else output

        row = {
            "project": project,
            "task_title": task_title,
            "task_type": task_type,
            "output_summary": summary,
            "full_output": output,
            "tokens_used": tokens_used,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            self.sb.table(MEMORY_TABLE).insert(row).execute()
            logger.info("Stored memory for project=%s task=%s", project, task_title)
        except Exception as e:
            logger.warning("Failed to store memory: %s", e)

    # ── Recall ─────────────────────────────────────────────────────────────

    def recall(self, project: str, limit: int = 5) -> str:
        """Get recent task outputs for a project as a context string.

        Args:
            project: Project key
            limit: Max number of recent results to return

        Returns:
            Formatted string of recent work, or empty string if none
        """
        results = self._query_recent(project, limit)
        if not results:
            return ""

        lines = ["Recent work on this project:"]
        for r in results:
            title = r.get("task_title") or r.get("title", "Unknown")
            summary = r.get("output_summary") or self._extract_summary(r)
            age = self._format_age(r.get("created_at") or r.get("completed_at"))
            lines.append(f"  - [{age}] {title}: {summary}")

        return "\n".join(lines)

    def _query_recent(self, project: str, limit: int) -> list[dict[str, Any]]:
        """Query recent completed work for a project."""
        # Try dedicated memory table first
        if self._has_memory_table():
            try:
                resp = (
                    self.sb.table(MEMORY_TABLE)
                    .select("task_title, output_summary, created_at")
                    .eq("project", project)
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                if resp.data:
                    return resp.data
            except Exception as e:
                logger.debug("Memory table query failed: %s", e)

        # Fallback: use swarm_tasks
        try:
            resp = (
                self.sb.table(TASKS_TABLE)
                .select("title, output_data, completed_at")
                .eq("project", project)
                .eq("status", "completed")
                .order("completed_at", desc=True)
                .limit(limit)
                .execute()
            )
            return resp.data or []
        except Exception as e:
            logger.debug("Tasks fallback query failed: %s", e)
            return []

    # ── Failed approaches ──────────────────────────────────────────────────

    def get_failed_approaches(self, project: str, task_type: Optional[str] = None) -> str:
        """Get previously failed approaches so we don't repeat them.

        Args:
            project: Project key
            task_type: Optional task type to filter by

        Returns:
            Formatted string of failed approaches, or empty string
        """
        try:
            query = (
                self.sb.table(TASKS_TABLE)
                .select("title, error_message, input_data, completed_at")
                .eq("project", project)
                .eq("status", "failed")
                .order("completed_at", desc=True)
                .limit(5)
            )
            if task_type:
                query = query.eq("task_type", task_type)

            resp = query.execute()
            if not resp.data:
                return ""

            lines = ["These approaches have been tried and failed:"]
            for r in resp.data:
                title = r.get("title", "Unknown")
                error = r.get("error_message", "No error recorded")
                age = self._format_age(r.get("completed_at"))
                lines.append(f"  - [{age}] {title}: {error}")

            return "\n".join(lines)

        except Exception as e:
            logger.debug("Failed to query failed approaches: %s", e)
            return ""

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_summary(task_row: dict[str, Any]) -> str:
        """Extract a summary from a task row's output_data."""
        output = task_row.get("output_data", {})
        if isinstance(output, dict):
            resp = output.get("response", "")
            if resp:
                return resp[:200] + ("..." if len(resp) > 200 else "")
        if isinstance(output, str):
            return output[:200] + ("..." if len(output) > 200 else "")
        return "No output"

    @staticmethod
    def _format_age(timestamp_str: Optional[str]) -> str:
        """Format a timestamp as a human-readable age string."""
        if not timestamp_str:
            return "unknown"

        try:
            ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            delta = now - ts
            total_seconds = int(delta.total_seconds())

            if total_seconds < 60:
                return f"{total_seconds}s ago"
            elif total_seconds < 3600:
                return f"{total_seconds // 60}m ago"
            elif total_seconds < 86400:
                return f"{total_seconds // 3600}h ago"
            else:
                return f"{total_seconds // 86400}d ago"
        except (ValueError, TypeError):
            return "unknown"
