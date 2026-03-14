"""
Task manager: CRUD + atomic claim operations for swarm tasks in Supabase.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from swarm.config import SUPABASE_KEY, SUPABASE_URL

logger = logging.getLogger("swarm.tasks")


class TaskManager:
    """Manages swarm tasks in the swarm_tasks Supabase table."""

    TABLE = "swarm_tasks"

    def __init__(self):
        from supabase import create_client

        self.sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── Create ────────────────────────────────────────────────────────────

    def create_task(
        self,
        task_type: str,
        title: str,
        project: str,
        input_data: dict[str, Any],
        cost_tier: str = "light",
        priority: int = 5,
        parent_id: Optional[str] = None,
        depends_on: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Create a new task in the queue.

        Args:
            task_type: One of "meta", "eval", "build", "test", "refactor", "mine"
            title: Human-readable task title
            project: Project key from config.PROJECTS
            input_data: Structured input for the worker
            cost_tier: "light" or "heavy"
            priority: 1 (highest) to 10 (lowest)
            parent_id: UUID of parent task (for child tasks)
            depends_on: List of task UUIDs that must complete first

        Returns:
            The created task row
        """
        status = "queued"
        if depends_on:
            # Check if all dependencies are completed
            dep_resp = (
                self.sb.table(self.TABLE)
                .select("id, status")
                .in_("id", depends_on)
                .execute()
            )
            completed_ids = {
                r["id"] for r in (dep_resp.data or []) if r["status"] == "completed"
            }
            if set(depends_on) - completed_ids:
                status = "blocked"

        row = {
            "id": str(uuid.uuid4()),
            "task_type": task_type,
            "title": title,
            "project": project,
            "input_data": json.dumps(input_data) if isinstance(input_data, dict) else input_data,
            "cost_tier": cost_tier,
            "priority": priority,
            "status": status,
            "parent_id": parent_id,
            "depends_on": depends_on or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "retry_count": 0,
            "max_retries": 3,
        }

        resp = self.sb.table(self.TABLE).insert(row).execute()
        if not resp.data:
            raise RuntimeError(f"Failed to create task: {resp}")
        logger.info("Created task %s: %s [%s]", row["id"][:8], title, status)
        return resp.data[0]

    # ── Pull (atomic claim) ───────────────────────────────────────────────

    def pull_task(self, cost_tier: str = "light") -> Optional[dict[str, Any]]:
        """Atomically claim the next queued task for a given cost tier.

        Uses an RPC function if available, otherwise falls back to
        select-then-update (less safe but functional).

        Args:
            cost_tier: "light" or "heavy"

        Returns:
            The claimed task row, or None if no tasks available
        """
        # Try RPC first (atomic, uses SELECT FOR UPDATE SKIP LOCKED)
        try:
            resp = self.sb.rpc(
                "claim_swarm_task", {"p_cost_tier": cost_tier}
            ).execute()
            if resp.data and len(resp.data) > 0:
                task = resp.data[0]
                logger.info("Claimed task %s via RPC: %s", task["id"][:8], task["title"])
                return task
            return None
        except Exception as e:
            logger.debug("RPC claim_swarm_task not available (%s), using fallback", e)

        # Fallback: select + update (race condition possible but acceptable)
        resp = (
            self.sb.table(self.TABLE)
            .select("*")
            .eq("status", "queued")
            .eq("cost_tier", cost_tier)
            .order("priority", desc=False)
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        if not resp.data:
            return None

        task = resp.data[0]
        update_resp = (
            self.sb.table(self.TABLE)
            .update(
                {
                    "status": "running",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", task["id"])
            .eq("status", "queued")  # Optimistic lock
            .execute()
        )
        if not update_resp.data:
            logger.debug("Task %s was claimed by another worker", task["id"][:8])
            return None

        logger.info("Claimed task %s: %s", task["id"][:8], task["title"])
        return update_resp.data[0]

    # ── Complete ──────────────────────────────────────────────────────────

    def complete_task(
        self, task_id: str, output_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Mark a task as completed and unblock dependents.

        Args:
            task_id: UUID of the task
            output_data: Structured output from the worker

        Returns:
            The updated task row
        """
        resp = (
            self.sb.table(self.TABLE)
            .update(
                {
                    "status": "completed",
                    "output_data": json.dumps(output_data)
                    if isinstance(output_data, dict)
                    else output_data,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", task_id)
            .execute()
        )

        if not resp.data:
            raise RuntimeError(f"Failed to complete task {task_id}")

        logger.info("Completed task %s", task_id[:8])

        # Unblock tasks that depended on this one
        self._unblock_dependents(task_id)
        return resp.data[0]

    # ── Fail ──────────────────────────────────────────────────────────────

    def fail_task(self, task_id: str, error: str) -> dict[str, Any]:
        """Mark a task as failed; retry if under max_retries.

        Args:
            task_id: UUID of the task
            error: Error message

        Returns:
            The updated task row
        """
        # Fetch current state
        resp = (
            self.sb.table(self.TABLE)
            .select("retry_count, max_retries")
            .eq("id", task_id)
            .execute()
        )
        if not resp.data:
            raise RuntimeError(f"Task {task_id} not found")

        task = resp.data[0]
        new_count = task["retry_count"] + 1

        if new_count < task["max_retries"]:
            # Retry: re-queue with incremented count
            update = {
                "status": "queued",
                "retry_count": new_count,
                "error": error,
                "started_at": None,
            }
            logger.warning(
                "Task %s failed (attempt %d/%d), re-queuing: %s",
                task_id[:8],
                new_count,
                task["max_retries"],
                error,
            )
        else:
            # Max retries exhausted
            update = {
                "status": "failed",
                "retry_count": new_count,
                "error": error,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
            logger.error(
                "Task %s permanently failed after %d attempts: %s",
                task_id[:8],
                new_count,
                error,
            )

        update_resp = (
            self.sb.table(self.TABLE).update(update).eq("id", task_id).execute()
        )
        return update_resp.data[0] if update_resp.data else update

    # ── Spawn children ────────────────────────────────────────────────────

    def spawn_children(
        self, parent_id: str, children: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Batch-create child tasks under a parent.

        Args:
            parent_id: UUID of the parent task
            children: List of dicts with keys matching create_task params

        Returns:
            List of created task rows
        """
        results = []
        for child in children:
            task = self.create_task(
                task_type=child.get("task_type", "build"),
                title=child["title"],
                project=child["project"],
                input_data=child.get("input_data", {}),
                cost_tier=child.get("cost_tier", "light"),
                priority=child.get("priority", 5),
                parent_id=parent_id,
                depends_on=child.get("depends_on"),
            )
            results.append(task)
        return results

    # ── Recurring/meta tasks ──────────────────────────────────────────────

    def get_pending_recurring(self) -> list[dict[str, Any]]:
        """Find meta-tasks that are due for re-evaluation.

        Returns:
            List of meta-task rows whose eval_interval has elapsed
        """
        resp = (
            self.sb.table(self.TABLE)
            .select("*")
            .eq("task_type", "meta")
            .in_("status", ["completed", "queued"])
            .execute()
        )
        return resp.data or []

    # ── Dependency management ─────────────────────────────────────────────

    def _unblock_dependents(self, completed_task_id: str):
        """Move blocked tasks to queued if all their deps are now completed."""
        # Find all blocked tasks
        resp = (
            self.sb.table(self.TABLE)
            .select("id, depends_on")
            .eq("status", "blocked")
            .execute()
        )
        if not resp.data:
            return

        for task in resp.data:
            deps = task.get("depends_on", [])
            if not deps or completed_task_id not in deps:
                continue

            # Check if ALL deps are completed
            dep_resp = (
                self.sb.table(self.TABLE)
                .select("id, status")
                .in_("id", deps)
                .execute()
            )
            all_completed = all(
                r["status"] == "completed" for r in (dep_resp.data or [])
            )
            if all_completed:
                self.sb.table(self.TABLE).update({"status": "queued"}).eq(
                    "id", task["id"]
                ).execute()
                logger.info("Unblocked task %s", task["id"][:8])

    def unblock_ready_tasks(self):
        """Scan all blocked tasks and unblock those with all deps satisfied."""
        resp = (
            self.sb.table(self.TABLE)
            .select("id, depends_on")
            .eq("status", "blocked")
            .execute()
        )
        if not resp.data:
            return

        for task in resp.data:
            deps = task.get("depends_on", [])
            if not deps:
                self.sb.table(self.TABLE).update({"status": "queued"}).eq(
                    "id", task["id"]
                ).execute()
                continue

            dep_resp = (
                self.sb.table(self.TABLE)
                .select("id, status")
                .in_("id", deps)
                .execute()
            )
            all_completed = all(
                r["status"] == "completed" for r in (dep_resp.data or [])
            )
            if all_completed:
                self.sb.table(self.TABLE).update({"status": "queued"}).eq(
                    "id", task["id"]
                ).execute()
                logger.info("Unblocked task %s", task["id"][:8])

    # ── Query helpers ─────────────────────────────────────────────────────

    def get_tasks_by_status(self, status: str, limit: int = 50) -> list[dict[str, Any]]:
        """Get tasks filtered by status."""
        resp = (
            self.sb.table(self.TABLE)
            .select("*")
            .eq("status", status)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []

    def get_all_active(self) -> list[dict[str, Any]]:
        """Get all non-terminal tasks (queued, running, blocked)."""
        resp = (
            self.sb.table(self.TABLE)
            .select("*")
            .in_("status", ["queued", "running", "blocked"])
            .order("priority", desc=False)
            .execute()
        )
        return resp.data or []
