"""
Task manager: CRUD + atomic claim operations for swarm tasks in Supabase.

Schema (swarm_tasks):
  id (uuid, auto), task_type (text), title (text), description (text),
  project (text), parent_task_id (uuid), root_task_id (uuid), depth (int),
  status (text, default 'pending'), priority (int, default 50),
  cost_tier (text, default 'light'), depends_on (uuid[]),
  assigned_worker_id (text), worker_type (text),
  input_data (jsonb), output_data (jsonb), checkpoint (jsonb),
  error_message (text), retry_count (int), max_retries (int, default 3),
  estimated_cost_cents (int), actual_cost_cents (int), tokens_used (int),
  is_recurring (bool), recurrence_interval_minutes (int), next_run_at (timestamptz),
  created_at, queued_at, started_at, completed_at, updated_at
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
        priority: int = 50,
        parent_id: Optional[str] = None,
        depends_on: Optional[list[str]] = None,
        description: str = "",
        is_recurring: bool = False,
        recurrence_interval_minutes: Optional[int] = None,
    ) -> dict[str, Any]:
        """Create a new task in the queue.

        Args:
            task_type: One of "meta", "eval", "build", "test", "refactor", "mine"
            title: Human-readable task title
            project: Project key from config.PROJECTS
            input_data: Structured input for the worker
            cost_tier: "light" or "heavy"
            priority: 1 (highest) to 100 (lowest), default 50
            parent_id: UUID of parent task (for child tasks)
            depends_on: List of task UUIDs that must complete first
            description: Detailed task description
            is_recurring: Whether this task recurs
            recurrence_interval_minutes: Minutes between recurrences

        Returns:
            The created task row
        """
        now = datetime.now(timezone.utc).isoformat()

        # Meta tasks are containers, never executed by workers
        status = "queued"
        if task_type == "meta":
            status = "completed"
        elif depends_on:
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

        # Route strategic thinking tasks to cc_light tier (free Opus via Claude Code CLI)
        if cost_tier == "light" and task_type in ("eval", "meta", "plan", "review"):
            cost_tier = "cc_light"

        row: dict[str, Any] = {
            "task_type": task_type,
            "title": title,
            "description": description,
            "project": project,
            "input_data": input_data,
            "cost_tier": cost_tier,
            "priority": priority,
            "status": status,
            "parent_task_id": parent_id,
            "depends_on": depends_on or [],
            "retry_count": 0,
            "max_retries": 3,
            "is_recurring": is_recurring,
            "queued_at": now if status == "queued" else None,
        }

        if recurrence_interval_minutes is not None:
            row["recurrence_interval_minutes"] = recurrence_interval_minutes

        resp = self.sb.table(self.TABLE).insert(row).execute()
        if not resp.data:
            raise RuntimeError(f"Failed to create task: {resp}")
        task = resp.data[0]
        logger.info("Created task %s: %s [%s]", task["id"][:8], title, status)

        # Priority inheritance: boost upstream tasks if this task is high-priority
        if depends_on and priority < 30:
            self._boost_upstream_priority(depends_on, priority)

        return task

    # ── Pull (atomic claim) ───────────────────────────────────────────────

    def pull_task(
        self,
        cost_tier: str = "light",
        worker_id: Optional[str] = None,
        worker_type: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """Atomically claim the next queued task for a given cost tier.

        Uses an RPC function if available, otherwise falls back to
        select-then-update (less safe but functional).

        When worker_type is provided, prefers tasks matching the worker's
        specialization (e.g. builder prefers build/implement/refactor tasks).

        Args:
            cost_tier: "light" or "heavy"
            worker_id: Worker ID to assign
            worker_type: Worker type for smart matching (e.g. "builder", "inspector")

        Returns:
            The claimed task row, or None if no tasks available
        """
        # Select + update with optimistic lock (status=queued guard)
        # Exclude meta tasks - they are containers, not executable by workers
        # Fetch a batch of candidates so we can do smart matching client-side
        resp = (
            self.sb.table(self.TABLE)
            .select("*")
            .eq("status", "queued")
            .eq("cost_tier", cost_tier)
            .neq("task_type", "meta")
            .order("priority", desc=False)
            .order("created_at", desc=False)
            .limit(20)
            .execute()
        )
        if not resp.data:
            return None

        # Smart worker matching: prefer tasks that match the worker's type
        task = self._pick_best_task(resp.data, worker_type)

        now = datetime.now(timezone.utc).isoformat()
        update: dict[str, Any] = {
            "status": "running",
            "started_at": now,
            "updated_at": now,
        }
        if worker_id:
            update["assigned_worker_id"] = worker_id

        update_resp = (
            self.sb.table(self.TABLE)
            .update(update)
            .eq("id", task["id"])
            .eq("status", "queued")  # Optimistic lock
            .execute()
        )
        if not update_resp.data:
            logger.debug("Task %s was claimed by another worker", task["id"][:8])
            return None

        logger.info("Claimed task %s: %s", task["id"][:8], task["title"])
        return update_resp.data[0]

    def _pick_best_task(
        self, candidates: list[dict[str, Any]], worker_type: Optional[str] = None
    ) -> dict[str, Any]:
        """Pick the best task from candidates based on worker type matching.

        If worker_type is provided and matches a known preference list,
        tasks whose task_type matches are preferred. Falls back to the
        first candidate (highest priority) if no type match is found.

        Args:
            candidates: List of queued task rows, already sorted by priority
            worker_type: Worker type for matching (e.g. "builder", "inspector")

        Returns:
            The best matching task row
        """
        from swarm.config import WORKER_TYPE_PREFERENCES

        if not worker_type or worker_type not in WORKER_TYPE_PREFERENCES:
            return candidates[0]

        preferred_types = WORKER_TYPE_PREFERENCES[worker_type]

        # Look for a type-matched task
        for task in candidates:
            if task.get("task_type") in preferred_types:
                logger.debug(
                    "Smart match: worker_type=%s matched task_type=%s for task %s",
                    worker_type,
                    task["task_type"],
                    task["id"][:8],
                )
                return task

        # No match found, fall back to highest priority
        return candidates[0]

    # ── Auto-complete meta tasks ─────────────────────────────────────────

    def _auto_complete_meta(self, task: dict[str, Any]):
        """Auto-complete a meta task that was accidentally queued.

        Meta tasks are containers that track child tasks. They shouldn't
        be executed by workers. Mark them as completed immediately.
        """
        now = datetime.now(timezone.utc).isoformat()
        self.sb.table(self.TABLE).update({
            "status": "completed",
            "output_data": {"note": "Meta task auto-completed (container only)"},
            "completed_at": now,
            "updated_at": now,
        }).eq("id", task["id"]).execute()
        logger.info("Auto-completed meta task %s", task["id"][:8])

    # ── Complete ──────────────────────────────────────────────────────────

    def complete_task(
        self, task_id: str, output_data: Any, cost_cents: int = 0, tokens: int = 0
    ) -> dict[str, Any]:
        """Mark a task as completed and unblock dependents.

        Args:
            task_id: UUID of the task
            output_data: Structured output from the worker (dict or string)
            cost_cents: Actual cost in cents
            tokens: Total tokens used

        Returns:
            The updated task row
        """
        # Ensure output_data is always a dict so it stores properly in JSONB
        if output_data is None:
            output_data = {"response": ""}
        elif isinstance(output_data, str):
            output_data = {"response": output_data}
        elif not isinstance(output_data, dict):
            output_data = {"response": str(output_data)}

        now = datetime.now(timezone.utc).isoformat()

        # Defensive: ensure output_data is safe for JSONB
        try:
            import json
            json.dumps(output_data)  # Test it's serializable
        except (TypeError, ValueError):
            output_data = {"response": str(output_data)[:5000]}

        update: dict[str, Any] = {
            "status": "completed",
            "output_data": output_data,
            "completed_at": now,
            "updated_at": now,
        }

        # Defensive int casting — the #1 source of 22P02 errors
        try:
            if cost_cents and float(cost_cents) > 0:
                update["actual_cost_cents"] = int(round(float(cost_cents)))
        except (TypeError, ValueError):
            pass
        try:
            if tokens and int(float(str(tokens))) > 0:
                update["tokens_used"] = int(float(str(tokens)))
        except (TypeError, ValueError):
            pass

        resp = None
        try:
            resp = (
                self.sb.table(self.TABLE)
                .update(update)
                .eq("id", task_id)
                .execute()
            )
            if not resp.data:
                logger.warning("No rows updated for task %s — may already be completed", task_id[:8])
        except Exception as e:
            # If the update fails, at least mark it as completed without cost data
            logger.error("Failed to complete task %s with full data: %s. Retrying minimal update.", task_id[:8], e)
            try:
                resp = self.sb.table(self.TABLE).update({
                    "status": "completed",
                    "completed_at": now,
                    "updated_at": now,
                }).eq("id", task_id).execute()
            except Exception as e2:
                logger.error("Even minimal completion failed for %s: %s", task_id[:8], e2)

        logger.info("Completed task %s", task_id[:8])

        # Unblock tasks that depended on this one
        self._unblock_dependents(task_id)
        return resp.data[0] if resp and resp.data else {}

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
        now = datetime.now(timezone.utc).isoformat()

        if new_count < task["max_retries"]:
            # Retry: re-queue with incremented count
            update: dict[str, Any] = {
                "status": "queued",
                "retry_count": new_count,
                "error_message": error,
                "started_at": None,
                "assigned_worker_id": None,
                "updated_at": now,
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
                "error_message": error,
                "completed_at": now,
                "updated_at": now,
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

        # Cascade-fail downstream dependents if this task is permanently dead
        if update.get("status") == "failed":
            self._cascade_fail_dependents(task_id, error)

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
                priority=child.get("priority", 50),
                parent_id=parent_id,
                depends_on=child.get("depends_on"),
                description=child.get("description", ""),
            )
            results.append(task)
        return results

    # ── Recurring/meta tasks ──────────────────────────────────────────────

    def get_pending_recurring(self) -> list[dict[str, Any]]:
        """Find recurring tasks that are due for re-execution.

        Returns:
            List of recurring task rows whose next_run_at has passed
        """
        now = datetime.now(timezone.utc).isoformat()
        resp = (
            self.sb.table(self.TABLE)
            .select("*")
            .eq("is_recurring", True)
            .in_("status", ["completed", "pending"])
            .lte("next_run_at", now)
            .execute()
        )
        return resp.data or []

    # ── Failure propagation ──────────────────────────────────────────────

    def _cascade_fail_dependents(self, failed_task_id: str, original_error: str):
        """Cascade-fail all downstream tasks when an upstream task permanently fails.

        Uses iterative BFS to find all transitive dependents and fail them.
        This prevents blocked tasks from waiting forever on a dead dependency.

        Args:
            failed_task_id: UUID of the permanently failed task
            original_error: Error message from the failed task
        """
        now = datetime.now(timezone.utc).isoformat()

        # Fetch all non-terminal tasks that might be downstream
        resp = (
            self.sb.table(self.TABLE)
            .select("id, depends_on")
            .in_("status", ["blocked", "queued"])
            .execute()
        )
        if not resp.data:
            return

        failed_ids = {failed_task_id}
        cascade_count = 0

        # Iterative BFS: keep scanning until no new failures found
        changed = True
        while changed:
            changed = False
            for task in resp.data:
                if task["id"] in failed_ids:
                    continue
                deps = task.get("depends_on", [])
                if any(d in failed_ids for d in deps):
                    self.sb.table(self.TABLE).update({
                        "status": "failed",
                        "error_message": f"Upstream task {failed_task_id[:8]} failed: {original_error[:200]}",
                        "completed_at": now,
                        "updated_at": now,
                    }).eq("id", task["id"]).execute()
                    failed_ids.add(task["id"])
                    cascade_count += 1
                    changed = True

        if cascade_count:
            logger.warning(
                "Cascade-failed %d downstream tasks from %s",
                cascade_count,
                failed_task_id[:8],
            )

    # ── Priority inheritance ───────────────────────────────────────────────

    def _boost_upstream_priority(self, dep_ids: list[str], child_priority: int):
        """Boost priority of upstream tasks when a high-priority task depends on them.

        If a priority-10 task depends on priority-50 tasks, those upstream tasks
        should execute sooner. Boosts upstream to child_priority + 1.

        Args:
            dep_ids: UUIDs of upstream dependency tasks
            child_priority: Priority of the high-priority downstream task
        """
        try:
            boosted_priority = child_priority + 1
            resp = (
                self.sb.table(self.TABLE)
                .select("id, priority")
                .in_("id", dep_ids)
                .gt("priority", boosted_priority)
                .in_("status", ["queued", "blocked"])
                .execute()
            )
            if not resp.data:
                return

            now = datetime.now(timezone.utc).isoformat()
            for task in resp.data:
                self.sb.table(self.TABLE).update({
                    "priority": boosted_priority,
                    "updated_at": now,
                }).eq("id", task["id"]).execute()
                logger.info(
                    "Priority inheritance: boosted task %s from %d to %d",
                    task["id"][:8],
                    task["priority"],
                    boosted_priority,
                )
        except Exception as e:
            logger.debug("Priority inheritance failed: %s", e)

    # ── Dependency management ─────────────────────────────────────────────

    def _unblock_dependents(self, completed_task_id: str):
        """Move blocked tasks to queued if all their deps are now completed.

        Also injects completed dependency outputs into the task's prompt
        so each task in a chain builds on what came before.
        """
        resp = (
            self.sb.table(self.TABLE)
            .select("id, depends_on, input_data")
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
                .select("id, status, title, output_data")
                .in_("id", deps)
                .execute()
            )
            all_completed = all(
                r["status"] == "completed" for r in (dep_resp.data or [])
            )
            if all_completed:
                # Inject parent outputs into the task prompt
                updated_input = self._inject_parent_outputs(
                    task.get("input_data", {}), dep_resp.data or []
                )
                now = datetime.now(timezone.utc).isoformat()
                self.sb.table(self.TABLE).update({
                    "status": "queued",
                    "queued_at": now,
                    "updated_at": now,
                    "input_data": updated_input,
                }).eq("id", task["id"]).execute()
                logger.info("Unblocked task %s with %d parent outputs injected", task["id"][:8], len(dep_resp.data or []))

    def _inject_parent_outputs(
        self, input_data: dict[str, Any], completed_deps: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Inject completed dependency outputs into a task's input_data.

        Appends parent task results before the original prompt so the task
        can build on what came before.

        Args:
            input_data: The task's current input_data dict
            completed_deps: List of completed dependency task rows with output_data

        Returns:
            Updated input_data with parent outputs prepended to the prompt
        """
        if isinstance(input_data, str):
            input_data = json.loads(input_data)

        input_data = dict(input_data)  # shallow copy
        original_prompt = input_data.get("prompt", "")

        # Build parent output context
        parent_sections: list[str] = []
        for dep in completed_deps:
            title = dep.get("title", "Unknown task")
            output = dep.get("output_data", {})
            if isinstance(output, str):
                try:
                    output = json.loads(output)
                except (json.JSONDecodeError, TypeError):
                    pass

            # Extract the response text from output_data
            if isinstance(output, dict):
                # Light worker output has "response", heavy has "stdout"
                output_text = output.get("response", output.get("stdout", ""))
            else:
                output_text = str(output) if output else ""

            if not output_text:
                continue

            # Adaptive truncation: less per-parent when many fan-in
            num_parents = len(completed_deps)
            if num_parents <= 3:
                max_output_len = 3000
            elif num_parents <= 6:
                max_output_len = 1500
            else:
                max_output_len = 800

            if len(output_text) > max_output_len:
                output_text = output_text[:max_output_len] + "\n[...truncated...]"

            parent_sections.append(
                f'Task: "{title}"\nOutput: {output_text}'
            )

        if not parent_sections:
            return input_data

        # Fan-in summary header for many parents
        if len(parent_sections) > 3:
            titles = [dep.get("title", "?") for dep in completed_deps if dep.get("output_data")]
            chained_context = (
                f"This task depends on {len(parent_sections)} completed upstream tasks: "
                f"{', '.join(t[:40] for t in titles)}.\n"
                f"Key outputs from each:\n---\n"
            )
        else:
            chained_context = "Previous task results:\n---\n"

        chained_context += "\n---\n".join(parent_sections)
        chained_context += f"\n---\n\nNow complete this task:\n{original_prompt}"

        input_data["prompt"] = chained_context
        return input_data

    def unblock_ready_tasks(self):
        """Scan all blocked tasks and unblock those with all deps satisfied.

        When unblocking, injects completed dependency outputs into the task's
        prompt for output chaining.
        """
        resp = (
            self.sb.table(self.TABLE)
            .select("id, depends_on, input_data")
            .eq("status", "blocked")
            .execute()
        )
        if not resp.data:
            return

        for task in resp.data:
            deps = task.get("depends_on", [])
            if not deps:
                now = datetime.now(timezone.utc).isoformat()
                self.sb.table(self.TABLE).update(
                    {"status": "queued", "queued_at": now, "updated_at": now}
                ).eq("id", task["id"]).execute()
                continue

            dep_resp = (
                self.sb.table(self.TABLE)
                .select("id, status, title, output_data")
                .in_("id", deps)
                .execute()
            )
            all_completed = all(
                r["status"] == "completed" for r in (dep_resp.data or [])
            )
            if all_completed:
                # Inject parent outputs into the task prompt
                updated_input = self._inject_parent_outputs(
                    task.get("input_data", {}), dep_resp.data or []
                )
                now = datetime.now(timezone.utc).isoformat()
                self.sb.table(self.TABLE).update({
                    "status": "queued",
                    "queued_at": now,
                    "updated_at": now,
                    "input_data": updated_input,
                }).eq("id", task["id"]).execute()
                logger.info("Unblocked task %s with %d parent outputs injected", task["id"][:8], len(dep_resp.data or []))

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
        """Get all non-terminal tasks (queued, running, blocked, pending)."""
        resp = (
            self.sb.table(self.TABLE)
            .select("*")
            .in_("status", ["queued", "running", "blocked", "pending"])
            .order("priority", desc=False)
            .execute()
        )
        return resp.data or []
