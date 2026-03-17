"""
Supervisor: Factory foreman that monitors workers and handles stuck situations.

Patrols every 60 seconds checking for:
- Workers with no heartbeat in 5+ minutes → mark dead, re-queue task
- Tasks stuck at "running" for 10+ minutes → kill worker, re-queue
- Workers at 90%+ progress for 3+ minutes → likely stuck, force complete or restart
- Dead workers piling up → alert Oracle
- Queue backup (5+ queued, 0 running) → flag for scaling
"""

import logging
import time
from datetime import datetime, timezone, timedelta

import requests

from swarm.config import DISCORD_WEBHOOK_URL

logger = logging.getLogger("swarm.supervisor")

# Amber color for Supervisor embeds
SUPERVISOR_COLOR = 0xF59E0B


class Supervisor:
    """Factory foreman. Monitors workers and handles stuck situations."""

    STALE_HEARTBEAT_MINUTES = 5
    STUCK_TASK_MINUTES = 10
    STUCK_PROGRESS_MINUTES = 3
    CHECK_INTERVAL_SECONDS = 60

    WORKERS_TABLE = "swarm_workers"
    TASKS_TABLE = "swarm_tasks"

    def __init__(self, supabase_client, task_manager, budget_manager, discord_webhook=None):
        self.sb = supabase_client
        self.task_manager = task_manager
        self.budget_manager = budget_manager
        self.discord = discord_webhook or DISCORD_WEBHOOK_URL
        self.last_check: float = 0

    def is_due(self) -> bool:
        """Check if it's time for a patrol."""
        return time.time() - self.last_check > self.CHECK_INTERVAL_SECONDS

    def run_patrol(self) -> int:
        """The Supervisor's patrol — check everything, fix problems.

        Returns the number of issues found and resolved.
        """
        self.last_check = time.time()
        
        # Keep supervisor visible on the game map
        try:
            self.sb.table("swarm_workers").upsert({
                "id": "supervisor-warden-001",
                "worker_name": "supervisor-warden-001",
                "worker_type": "supervisor",
                "tier": "system",
                "status": "working",
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            pass

        issues_found = 0
        actions_taken: list[str] = []

        # 1. Check for stale workers (no heartbeat in 5 min)
        stale = self._find_stale_workers()
        for worker in stale:
            self._handle_stale_worker(worker)
            mins = self._minutes_since(worker.get("last_heartbeat"))
            actions_taken.append(
                f"Killed stale worker {worker.get('worker_name', worker['id'][:8])} "
                f"(no heartbeat {mins}m)"
            )
            issues_found += 1

        # 2. Check for stuck tasks (running too long)
        stuck = self._find_stuck_tasks()
        for task in stuck:
            self._handle_stuck_task(task)
            title = task.get("title", "unknown")[:50]
            actions_taken.append(f"Re-queued stuck task: {title}")
            issues_found += 1

        # 3. Check for workers stuck at high progress (90%+)
        # These workers are technically alive but haven't made progress
        almost_done = self._find_stuck_at_progress()
        for worker in almost_done:
            self._handle_stuck_progress(worker)
            actions_taken.append(
                f"Force-resolved worker {worker.get('worker_name', worker['id'][:8])} "
                f"stuck at high progress"
            )
            issues_found += 1

        # 4. ZERO TOLERANCE FOR IDLE — if tasks exist and workers are idle, fix it
        idle_fix = self._fix_idle_situation()
        if idle_fix:
            actions_taken.append(idle_fix)
            issues_found += 1

        # 5. Check for queue backup (no workers at all)
        queue_backup = self._check_queue_backup()
        if queue_backup:
            actions_taken.append(
                f"CRITICAL: {queue_backup} tasks queued with 0 active workers — need daemon restart"
            )
            issues_found += 1
            # Send urgent Discord alert
            self._send_urgent_alert(f"🚨 IDLE ALERT: {queue_backup} tasks waiting, 0 workers active! Daemon may need restart.")

        # 6. Clean up dead workers older than 30 min
        cleaned = self._cleanup_dead_workers()
        if cleaned > 0:
            actions_taken.append(f"Cleaned up {cleaned} dead workers")

        # 7. Detect failure patterns and auto-escalate
        escalated = self._detect_and_escalate_failures()
        for msg in escalated:
            actions_taken.append(msg)
            issues_found += 1

        # Report
        if actions_taken:
            self._report(actions_taken)

        return issues_found

    # ── Detection ─────────────────────────────────────────────────────────

    def _find_stale_workers(self) -> list:
        """Workers with status busy/working but no heartbeat in 5+ minutes."""
        cutoff = (
            datetime.now(timezone.utc)
            - timedelta(minutes=self.STALE_HEARTBEAT_MINUTES)
        ).isoformat()

        result = (
            self.sb.table(self.WORKERS_TABLE)
            .select("*")
            .in_("status", ["busy", "working", "idle"])
            .lt("last_heartbeat", cutoff)
            .execute()
        )
        return result.data or []

    def _find_stuck_tasks(self) -> list:
        """Tasks that have been 'running' for 10+ minutes."""
        cutoff = (
            datetime.now(timezone.utc)
            - timedelta(minutes=self.STUCK_TASK_MINUTES)
        ).isoformat()

        result = (
            self.sb.table(self.TASKS_TABLE)
            .select("*")
            .eq("status", "running")
            .lt("started_at", cutoff)
            .execute()
        )
        return result.data or []

    def _find_stuck_at_progress(self) -> list:
        """Workers that are 'working' but haven't updated in 3+ minutes.

        These are the ones showing 95% forever.
        """
        cutoff = (
            datetime.now(timezone.utc)
            - timedelta(minutes=self.STUCK_PROGRESS_MINUTES)
        ).isoformat()

        result = (
            self.sb.table(self.WORKERS_TABLE)
            .select("*")
            .in_("status", ["busy", "working"])
            .lt("last_heartbeat", cutoff)
            .execute()
        )
        # Filter to only workers NOT already caught by stale check (3-5 min window)
        stale_cutoff = (
            datetime.now(timezone.utc)
            - timedelta(minutes=self.STALE_HEARTBEAT_MINUTES)
        ).isoformat()

        return [
            w for w in (result.data or [])
            if w.get("last_heartbeat") and w["last_heartbeat"] >= stale_cutoff
        ]

    # ── Remediation ───────────────────────────────────────────────────────

    def _handle_stale_worker(self, worker: dict):
        """Mark worker as dead, re-queue its task."""
        now = datetime.now(timezone.utc).isoformat()

        # Mark dead
        self.sb.table(self.WORKERS_TABLE).update({
            "status": "dead",
            "died_at": now,
        }).eq("id", worker["id"]).execute()

        logger.warning(
            "Supervisor: marked worker %s as dead (stale heartbeat)",
            worker.get("worker_name", worker["id"][:8]),
        )

        # Re-queue its task if it had one
        task_id = worker.get("current_task_id")
        if task_id:
            self.sb.table(self.TASKS_TABLE).update({
                "status": "queued",
                "assigned_worker_id": None,
            }).eq("id", task_id).eq("status", "running").execute()

            logger.info("Supervisor: re-queued task %s from stale worker", task_id[:8])

    def _handle_stuck_task(self, task: dict):
        """Re-queue a stuck task and kill its worker, respecting max_retries."""
        now = datetime.now(timezone.utc).isoformat()
        retry_count = (task.get("retry_count", 0) or 0) + 1
        max_retries = task.get("max_retries", 3) or 3

        if retry_count >= max_retries:
            # Retries exhausted — use task_manager to fail properly (with cascade)
            self.task_manager.fail_task(
                task["id"],
                f"Supervisor: stuck after {retry_count} attempts (timeout)",
            )
            logger.warning(
                "Supervisor: permanently failed stuck task %s (retries exhausted: %d/%d)",
                task["id"][:8], retry_count, max_retries,
            )
        else:
            # Re-queue the task
            self.sb.table(self.TASKS_TABLE).update({
                "status": "queued",
                "assigned_worker_id": None,
                "retry_count": retry_count,
            }).eq("id", task["id"]).execute()

            logger.info(
                "Supervisor: re-queued stuck task %s (retry #%d/%d)",
                task["id"][:8], retry_count, max_retries,
            )

        # Kill the assigned worker if any
        worker_id = task.get("assigned_worker_id")
        if worker_id:
            self.sb.table(self.WORKERS_TABLE).update({
                "status": "dead",
                "died_at": now,
            }).eq("id", worker_id).execute()

            logger.warning(
                "Supervisor: killed worker %s (stuck task)", worker_id[:8],
            )

    def _handle_stuck_progress(self, worker: dict):
        """Force-resolve a stuck worker — mark its task complete or re-queue."""
        now = datetime.now(timezone.utc).isoformat()
        task_id = worker.get("current_task_id")

        if task_id:
            try:
                task_resp = (
                    self.sb.table(self.TASKS_TABLE)
                    .select("*")
                    .eq("id", task_id)
                    .single()
                    .execute()
                )
                task_data = task_resp.data
            except Exception:
                task_data = None

            if task_data and task_data.get("started_at"):
                started = task_data["started_at"].replace("Z", "+00:00")
                elapsed = (
                    datetime.now(timezone.utc)
                    - datetime.fromisoformat(started)
                ).total_seconds()

                if elapsed > 300:
                    # 5+ minutes — probably completed, worker just didn't report
                    self.sb.table(self.TASKS_TABLE).update({
                        "status": "completed",
                        "completed_at": now,
                        "output_data": {
                            "response": "Force-completed by Supervisor (worker stalled)"
                        },
                    }).eq("id", task_id).execute()

                    logger.info(
                        "Supervisor: force-completed task %s (worker stalled after %ds)",
                        task_id[:8], int(elapsed),
                    )
                else:
                    # Re-queue for another attempt
                    self.sb.table(self.TASKS_TABLE).update({
                        "status": "queued",
                        "assigned_worker_id": None,
                    }).eq("id", task_id).execute()

                    logger.info(
                        "Supervisor: re-queued task %s (worker stuck, only %ds elapsed)",
                        task_id[:8], int(elapsed),
                    )

        # Mark worker as dead
        self.sb.table(self.WORKERS_TABLE).update({
            "status": "dead",
            "died_at": now,
        }).eq("id", worker["id"]).execute()

    def _fix_idle_situation(self) -> str | None:
        """ZERO TOLERANCE: If there are queued/blocked tasks and idle workers, wake them up."""
        # Count queued tasks (use .count for accurate server-side count)
        queued = self.sb.table(self.TASKS_TABLE).select("id", count="exact", head=True).eq("status", "queued").execute()
        blocked = self.sb.table(self.TASKS_TABLE).select("id", count="exact", head=True).eq("status", "blocked").execute()
        queued_count = queued.count or 0
        blocked_count = blocked.count or 0
        total_pending = queued_count + blocked_count

        # Count idle workers (need data for kill loop, so fetch rows)
        idle_workers = self.sb.table(self.WORKERS_TABLE).select("id").eq("status", "idle").execute()
        idle_count = len(idle_workers.data) if idle_workers.data else 0

        # Count active workers
        active = self.sb.table(self.WORKERS_TABLE).select("id", count="exact", head=True).in_("status", ["busy", "working"]).execute()
        active_count = active.count or 0

        if total_pending > 0 and active_count == 0:
            # Tasks exist but NOBODY is working — kill all idle workers so orchestrator respawns fresh ones
            if idle_count > 0:
                for w in idle_workers.data:
                    self.sb.table(self.WORKERS_TABLE).update({
                        "status": "dead",
                        "died_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", w["id"]).execute()
                logger.warning(
                    "Supervisor: IDLE FIX — killed %d idle workers to force respawn. %d tasks pending.",
                    idle_count, total_pending
                )
                return f"IDLE FIX: Killed {idle_count} idle workers to force respawn ({total_pending} tasks pending)"
            else:
                logger.warning("Supervisor: NO WORKERS AT ALL — %d tasks pending, daemon may be down", total_pending)
                return f"NO WORKERS: {total_pending} tasks pending, 0 workers — daemon may need restart"

        elif total_pending > 0 and idle_count > active_count:
            # More idle than active — something's wrong, kill idle to force rebalance
            kill_count = min(idle_count, 3)  # Kill up to 3 idle workers
            killed = 0
            for w in idle_workers.data[:kill_count]:
                self.sb.table(self.WORKERS_TABLE).update({
                    "status": "dead",
                    "died_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", w["id"]).execute()
                killed += 1
            if killed > 0:
                logger.info("Supervisor: killed %d idle workers to rebalance (ratio: %d idle / %d active)", killed, idle_count, active_count)
                return f"REBALANCE: Killed {killed} idle workers ({idle_count} idle vs {active_count} active, {total_pending} tasks pending)"

        return None

    def _send_urgent_alert(self, message: str):
        """Send an urgent red alert to Discord."""
        if not DISCORD_WEBHOOK_URL:
            return
        try:
            requests.post(DISCORD_WEBHOOK_URL, json={
                "embeds": [{
                    "title": "🚨 NEXUS IDLE ALERT",
                    "description": message,
                    "color": 0xEF4444,  # Red
                }]
            }, timeout=5)
        except Exception:
            pass

    def _check_queue_backup(self) -> int:
        """Check if tasks are queued but no workers are running."""
        queued = (
            self.sb.table(self.TASKS_TABLE)
            .select("id", count="exact")
            .eq("status", "queued")
            .execute()
        )
        active = (
            self.sb.table(self.WORKERS_TABLE)
            .select("id", count="exact")
            .in_("status", ["busy", "working"])
            .execute()
        )

        queued_count = len(queued.data) if queued.data else 0
        active_count = len(active.data) if active.data else 0

        if queued_count >= 5 and active_count == 0:
            logger.warning(
                "Supervisor: queue backup — %d tasks queued, 0 active workers",
                queued_count,
            )
            return queued_count
        return 0

    def _detect_and_escalate_failures(self) -> list[str]:
        """Detect chronically failing task types and auto-escalate their cost tier.

        If a project+task_type combo fails >60% of the time on a light tier,
        escalate queued tasks of that type to cc_light. If cc_light also fails,
        escalate to heavy.

        Returns:
            List of action descriptions for the patrol report
        """
        actions: list[str] = []

        try:
            # Check specialization data for chronic failures
            resp = (
                self.sb.table("agent_specializations")
                .select("project, task_type, success_count, fail_count")
                .execute()
            )
            if not resp.data:
                return actions

            ESCALATION_MAP = {
                "light": "cc_light",
                "cc_light": "heavy",
            }

            for row in resp.data:
                total = (row.get("success_count") or 0) + (row.get("fail_count") or 0)
                if total < 5:
                    continue  # Not enough data

                fail_rate = (row.get("fail_count") or 0) / total
                if fail_rate < 0.6:
                    continue  # Not a problem

                project = row.get("project", "")
                task_type = row.get("task_type", "")

                # Find queued tasks of this type that could be escalated
                queued_resp = (
                    self.sb.table(self.TASKS_TABLE)
                    .select("id, cost_tier")
                    .eq("status", "queued")
                    .eq("project", project)
                    .eq("task_type", task_type)
                    .limit(10)
                    .execute()
                )

                escalated_count = 0
                for task in queued_resp.data or []:
                    current_tier = task.get("cost_tier", "light")
                    new_tier = ESCALATION_MAP.get(current_tier)
                    if new_tier:
                        self.sb.table(self.TASKS_TABLE).update({
                            "cost_tier": new_tier,
                        }).eq("id", task["id"]).execute()
                        escalated_count += 1

                if escalated_count > 0:
                    actions.append(
                        f"Auto-escalated {escalated_count} {project}/{task_type} "
                        f"tasks (fail rate {fail_rate:.0%})"
                    )
                    logger.info(
                        "Supervisor: escalated %d tasks for %s/%s (fail rate %.0f%%)",
                        escalated_count, project, task_type, fail_rate * 100,
                    )

        except Exception as e:
            logger.debug("Failure pattern detection failed: %s", e)

        return actions

    def _cleanup_dead_workers(self) -> int:
        """Remove dead workers older than 30 minutes."""
        cutoff = (
            datetime.now(timezone.utc) - timedelta(minutes=30)
        ).isoformat()

        try:
            result = (
                self.sb.table(self.WORKERS_TABLE)
                .delete()
                .eq("status", "dead")
                .neq("tier", "system")  # Preserve supervisor row
                .lt("died_at", cutoff)
                .execute()
            )
            count = len(result.data) if result.data else 0
            if count:
                logger.info("Supervisor: cleaned up %d dead workers", count)
            return count
        except Exception as e:
            logger.warning("Supervisor: cleanup failed: %s", e)
            return 0

    # ── Utilities ─────────────────────────────────────────────────────────

    def _minutes_since(self, timestamp_str: str | None) -> int:
        """How many minutes since a given ISO timestamp."""
        if not timestamp_str:
            return 999
        try:
            ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            return int((datetime.now(timezone.utc) - ts).total_seconds() / 60)
        except (ValueError, TypeError):
            return 999

    def _report(self, actions: list[str]):
        """Report to Discord and log."""
        summary = (
            f"Supervisor Patrol — {len(actions)} issues resolved:\n"
            + "\n".join(f"  - {a}" for a in actions)
        )
        logger.info(summary)

        if self.discord:
            try:
                requests.post(
                    self.discord,
                    json={
                        "embeds": [
                            {
                                "title": "Supervisor Patrol Report",
                                "description": "\n".join(
                                    f"• {a}" for a in actions
                                ),
                                "color": SUPERVISOR_COLOR,
                                "footer": {
                                    "text": f"{len(actions)} issues resolved"
                                },
                            }
                        ]
                    },
                    timeout=10,
                )
            except Exception as e:
                logger.debug("Supervisor: Discord report failed: %s", e)
