"""
Swarm orchestrator: the main daemon that manages workers, tasks, and budgets.
"""

import logging
import multiprocessing
import signal
import time
from datetime import datetime, timezone, timedelta
from typing import Any

from swarm.budget.budget_manager import BudgetManager
from swarm.config import (
    ORCHESTRATOR_LOOP_SECONDS,
    SUPABASE_KEY,
    SUPABASE_URL,
    WORKER_HEARTBEAT_TIMEOUT_SECONDS,
    WORKER_LIMITS,
)
from swarm.tasks.task_manager import TaskManager

logger = logging.getLogger("swarm.orchestrator")


def _run_light_worker():
    """Entry point for light worker subprocess."""
    from swarm.workers.light_worker import LightWorker

    worker = LightWorker()
    worker.run_loop()


def _run_heavy_worker():
    """Entry point for heavy worker subprocess."""
    from swarm.workers.heavy_worker import HeavyWorker

    worker = HeavyWorker()
    worker.run_loop()


class SwarmOrchestrator:
    """Main daemon that orchestrates the swarm."""

    WORKERS_TABLE = "swarm_workers"

    def __init__(self):
        from supabase import create_client

        self.sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.task_manager = TaskManager()
        self.budget_manager = BudgetManager()
        self.alive = True
        self.worker_processes: dict[str, multiprocessing.Process] = {}

        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        logger.info("Orchestrator received signal %s, shutting down", signum)
        self.alive = False

    # ── Main loop ─────────────────────────────────────────────────────────

    def run(self):
        """Main orchestrator loop."""
        logger.info("Swarm orchestrator starting")

        while self.alive:
            try:
                self.check_recurring_tasks()
                self.task_manager.unblock_ready_tasks()
                self.scale_workers()
                self.check_worker_health()
                self.enforce_budgets()
            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error("Orchestrator loop error: %s", e, exc_info=True)

            time.sleep(ORCHESTRATOR_LOOP_SECONDS)

        self.shutdown_all()

    # ── Recurring tasks ───────────────────────────────────────────────────

    def check_recurring_tasks(self):
        """Check if any recurring tasks are due for re-execution."""
        due_tasks = self.task_manager.get_pending_recurring()
        for task in due_tasks:
            # Re-queue the recurring task
            now = datetime.now(timezone.utc)
            interval = task.get("recurrence_interval_minutes", 120)
            next_run = now + timedelta(minutes=interval)

            self.sb.table(self.task_manager.TABLE).update({
                "status": "queued",
                "queued_at": now.isoformat(),
                "started_at": None,
                "completed_at": None,
                "output_data": {},
                "error_message": None,
                "assigned_worker_id": None,
                "next_run_at": next_run.isoformat(),
                "updated_at": now.isoformat(),
            }).eq("id", task["id"]).execute()
            logger.info("Re-queued recurring task %s: %s", task["id"][:8], task["title"])

    # ── Worker scaling ────────────────────────────────────────────────────

    def scale_workers(self):
        """Scale workers up or down based on queue depth."""
        queued_tasks = self.task_manager.get_tasks_by_status("queued")
        light_count = sum(1 for t in queued_tasks if t.get("cost_tier") == "light")
        heavy_count = sum(1 for t in queued_tasks if t.get("cost_tier") == "heavy")

        active_workers = self._get_active_workers()
        active_light = sum(1 for w in active_workers if w["tier"] == "light")
        active_heavy = sum(1 for w in active_workers if w["tier"] == "heavy")

        # Scale light workers
        needed_light = min(light_count, WORKER_LIMITS["light_max"]) - active_light
        for _ in range(max(0, needed_light)):
            self._spawn_worker("light")

        # Scale heavy workers
        needed_heavy = min(heavy_count, WORKER_LIMITS["heavy_max"]) - active_heavy
        for _ in range(max(0, needed_heavy)):
            self._spawn_worker("heavy")

    def _spawn_worker(self, tier: str):
        """Spawn a new worker subprocess."""
        target = _run_light_worker if tier == "light" else _run_heavy_worker
        proc = multiprocessing.Process(target=target, daemon=True)
        proc.start()
        self.worker_processes[f"{tier}-{proc.pid}"] = proc
        logger.info("Spawned %s worker (PID %d)", tier, proc.pid)

    def _get_active_workers(self) -> list[dict[str, Any]]:
        """Get workers that are alive (not dead, heartbeat within timeout)."""
        cutoff = (
            datetime.now(timezone.utc)
            - timedelta(seconds=WORKER_HEARTBEAT_TIMEOUT_SECONDS)
        ).isoformat()

        resp = (
            self.sb.table(self.WORKERS_TABLE)
            .select("*")
            .neq("status", "dead")
            .gte("last_heartbeat", cutoff)
            .execute()
        )
        return resp.data or []

    # ── Worker health ─────────────────────────────────────────────────────

    def check_worker_health(self):
        """Watchdog: mark workers with stale heartbeats as dead."""
        cutoff = (
            datetime.now(timezone.utc)
            - timedelta(seconds=WORKER_HEARTBEAT_TIMEOUT_SECONDS)
        ).isoformat()

        resp = (
            self.sb.table(self.WORKERS_TABLE)
            .select("id, worker_type, last_heartbeat")
            .neq("status", "dead")
            .lt("last_heartbeat", cutoff)
            .execute()
        )

        for worker in resp.data or []:
            logger.warning(
                "Worker %s (%s) missed heartbeat, marking dead",
                worker["id"][:8],
                worker["worker_type"],
            )
            self.sb.table(self.WORKERS_TABLE).update(
                {
                    "status": "dead",
                    "died_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", worker["id"]).execute()

        # Clean up dead subprocess references
        dead_keys = []
        for key, proc in self.worker_processes.items():
            if not proc.is_alive():
                dead_keys.append(key)
        for key in dead_keys:
            del self.worker_processes[key]

    # ── Budget enforcement ────────────────────────────────────────────────

    def enforce_budgets(self):
        """Pause workers if budget is exceeded."""
        status = self.budget_manager.get_status()

        if status["api_pct"] >= 100:
            logger.warning("API budget exceeded! Pausing light workers.")
            self._pause_workers("light")

        if status["cc_pct"] >= 100:
            logger.warning("Claude Code budget exceeded! Pausing heavy workers.")
            self._pause_workers("heavy")

    def _pause_workers(self, tier: str):
        """Mark all workers of a tier as paused."""
        self.sb.table(self.WORKERS_TABLE).update({"status": "paused"}).eq(
            "tier", tier
        ).neq("status", "dead").execute()

    # ── Shutdown ──────────────────────────────────────────────────────────

    def shutdown_all(self):
        """Gracefully shut down all worker processes."""
        logger.info("Shutting down all workers...")

        for key, proc in self.worker_processes.items():
            if proc.is_alive():
                logger.info("Terminating worker %s (PID %d)", key, proc.pid)
                proc.terminate()

        for key, proc in self.worker_processes.items():
            proc.join(timeout=10)
            if proc.is_alive():
                logger.warning("Force-killing worker %s (PID %d)", key, proc.pid)
                proc.kill()

        # Mark all workers as dead in DB
        self.sb.table(self.WORKERS_TABLE).update(
            {
                "status": "dead",
                "died_at": datetime.now(timezone.utc).isoformat(),
            }
        ).neq("status", "dead").execute()

        logger.info("All workers shut down")

    # ── Status ────────────────────────────────────────────────────────────

    def get_status(self) -> dict[str, Any]:
        """Get full swarm status."""
        active_workers = self._get_active_workers()
        active_tasks = self.task_manager.get_all_active()
        budget = self.budget_manager.get_status()

        return {
            "workers": {
                "total": len(active_workers),
                "light": sum(1 for w in active_workers if w["tier"] == "light"),
                "heavy": sum(1 for w in active_workers if w["tier"] == "heavy"),
                "details": active_workers,
            },
            "tasks": {
                "queued": sum(1 for t in active_tasks if t["status"] == "queued"),
                "running": sum(1 for t in active_tasks if t["status"] == "running"),
                "blocked": sum(1 for t in active_tasks if t["status"] == "blocked"),
                "pending": sum(1 for t in active_tasks if t["status"] == "pending"),
                "details": active_tasks,
            },
            "budget": budget,
        }
