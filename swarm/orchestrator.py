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
from swarm.oracle import Oracle
from swarm.scouts import ScoutAgent
from swarm.supervisor import Supervisor
from swarm.tasks.task_manager import TaskManager

logger = logging.getLogger("swarm.orchestrator")


def _run_light_worker():
    """Entry point for light worker subprocess."""
    from swarm.workers.light_worker import LightWorker

    worker = LightWorker()
    worker.run_loop()


def _run_cc_light_worker():
    """Entry point for cc_light worker subprocess."""
    from swarm.workers.cc_light_worker import CCLightWorker

    worker = CCLightWorker()
    worker.run_loop()


def _run_heavy_worker():
    """Entry point for heavy worker subprocess."""
    from swarm.workers.heavy_worker import HeavyWorker

    worker = HeavyWorker()
    worker.run_loop()


def _run_browser_worker():
    """Entry point for browser worker subprocess."""
    from swarm.workers.browser_worker import BrowserWorker

    worker = BrowserWorker()
    worker.run_loop()


class SwarmOrchestrator:
    """Main daemon that orchestrates the swarm."""

    WORKERS_TABLE = "swarm_workers"

    TASKS_TABLE = "swarm_tasks"
    TASK_LOG_TABLE = "swarm_task_log"

    def __init__(self):
        from supabase import create_client

        self.sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.task_manager = TaskManager()
        self.budget_manager = BudgetManager()
        self.scout = ScoutAgent(task_manager=self.task_manager)
        self.oracle = Oracle(supabase_client=self.sb)
        self.supervisor = Supervisor(
            supabase_client=self.sb,
            task_manager=self.task_manager,
            budget_manager=self.budget_manager,
        )
        self.alive = True
        self.worker_processes: dict[str, multiprocessing.Process] = {}
        self._last_cleanup: float = 0
        self._cleanup_interval: float = 6 * 60 * 60  # 6 hours

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
                self.recover_stuck_tasks()
                self.enforce_budgets()

                # Supervisor patrol every 60 seconds
                if self.supervisor.is_due():
                    try:
                        issues = self.supervisor.run_patrol()
                        if issues > 0:
                            logger.info("Supervisor resolved %d issues", issues)
                    except Exception as e:
                        logger.error("Supervisor patrol failed: %s", e, exc_info=True)

                # Run scout every hour (5 goals per run)
                if self.scout.is_due():
                    try:
                        self.scout.run_evaluation()
                    except Exception as e:
                        logger.error("Scout failed: %s", e, exc_info=True)

                # Oracle: briefing every 2 hours
                if self.oracle.is_briefing_due():
                    try:
                        self.oracle.run_briefing()
                    except Exception as e:
                        logger.error("Oracle briefing failed: %s", e, exc_info=True)

                # Periodic cleanup every 6 hours
                if time.time() - self._last_cleanup > self._cleanup_interval:
                    try:
                        self.cleanup_stale_data()
                    except Exception as e:
                        logger.error("Cleanup failed: %s", e, exc_info=True)

                # Oracle: daily digest at 6pm UTC
                if self.oracle.is_daily_due():
                    try:
                        self.oracle.generate_daily_digest()
                    except Exception as e:
                        logger.error("Oracle daily digest failed: %s", e, exc_info=True)

                # Oracle: weekly report on Sundays
                if self.oracle.is_weekly_due():
                    try:
                        self.oracle.generate_weekly_report()
                    except Exception as e:
                        logger.error("Oracle weekly report failed: %s", e, exc_info=True)
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
        """Scale workers up or down based on queue depth.

        Only counts ACTIVE workers (not dead/paused). If there are queued tasks
        but 0 active workers of the needed tier, spawns replacements.
        """
        queued_tasks = self.task_manager.get_tasks_by_status("queued")
        light_count = sum(1 for t in queued_tasks if t.get("cost_tier") == "light")
        cc_light_count = sum(1 for t in queued_tasks if t.get("cost_tier") == "cc_light")
        heavy_count = sum(1 for t in queued_tasks if t.get("cost_tier") == "heavy")
        browser_count = sum(1 for t in queued_tasks if t.get("cost_tier") == "browser")

        # Only count active workers (filters out dead and stale heartbeats)
        active_workers = self._get_active_workers()
        active_light = sum(1 for w in active_workers if w.get("tier") == "light")
        active_cc_light = sum(1 for w in active_workers if w.get("tier") == "cc_light")
        active_heavy = sum(1 for w in active_workers if w.get("tier") == "heavy")
        active_browser = sum(1 for w in active_workers if w.get("tier") == "browser")

        # Scale light workers — spawn at least 1 if there are queued tasks
        if light_count > 0:
            needed_light = min(light_count, WORKER_LIMITS["light_max"]) - active_light
            needed_light = max(needed_light, 1 if active_light == 0 else 0)
        else:
            needed_light = 0
        for _ in range(max(0, needed_light)):
            self._spawn_worker("light")

        # Scale cc_light workers
        if cc_light_count > 0:
            needed_cc_light = min(cc_light_count, WORKER_LIMITS["cc_light_max"]) - active_cc_light
            needed_cc_light = max(needed_cc_light, 1 if active_cc_light == 0 else 0)
        else:
            needed_cc_light = 0
        for _ in range(max(0, needed_cc_light)):
            self._spawn_worker("cc_light")

        # Scale heavy workers
        if heavy_count > 0:
            needed_heavy = min(heavy_count, WORKER_LIMITS["heavy_max"]) - active_heavy
            needed_heavy = max(needed_heavy, 1 if active_heavy == 0 else 0)
        else:
            needed_heavy = 0
        for _ in range(max(0, needed_heavy)):
            self._spawn_worker("heavy")

        # Scale browser workers
        if browser_count > 0:
            needed_browser = min(browser_count, WORKER_LIMITS["browser_max"]) - active_browser
            needed_browser = max(needed_browser, 1 if active_browser == 0 else 0)
        else:
            needed_browser = 0
        for _ in range(max(0, needed_browser)):
            self._spawn_worker("browser")

    def _spawn_worker(self, tier: str):
        """Spawn a new worker subprocess."""
        targets = {
            "light": _run_light_worker,
            "cc_light": _run_cc_light_worker,
            "heavy": _run_heavy_worker,
            "browser": _run_browser_worker,
        }
        target = targets.get(tier, _run_light_worker)
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

    # ── Stuck task recovery ──────────────────────────────────────────────

    def recover_stuck_tasks(self):
        """Re-queue tasks assigned to dead/missing workers.

        Detects two cases:
        1. Orphaned tasks: assigned worker no longer in active workers list
        2. Stale tasks: running >30 min with no assigned worker
        """
        running_resp = (
            self.sb.table(self.TASKS_TABLE)
            .select("id, title, assigned_worker_id, started_at")
            .eq("status", "running")
            .execute()
        )
        if not running_resp.data:
            return

        active_worker_ids = {w["id"] for w in self._get_active_workers()}
        now = datetime.now(timezone.utc)
        recovered = 0

        for task in running_resp.data:
            worker_id = task.get("assigned_worker_id")
            started = task.get("started_at")

            # Check if worker is dead/missing
            orphaned = worker_id and worker_id not in active_worker_ids

            # Check if task has been running too long without a worker
            stale = False
            if started:
                try:
                    started_dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
                    stale = (now - started_dt).total_seconds() > 1800  # 30 min
                except (ValueError, TypeError):
                    pass

            if orphaned or (stale and not worker_id):
                self.sb.table(self.TASKS_TABLE).update({
                    "status": "queued",
                    "assigned_worker_id": None,
                    "started_at": None,
                    "updated_at": now.isoformat(),
                }).eq("id", task["id"]).execute()

                # Log the recovery event
                try:
                    worker_label = worker_id[:8] if worker_id else "none"
                    reason = "orphaned" if orphaned else "stale"
                    self.sb.table(self.TASK_LOG_TABLE).insert({
                        "task_id": task["id"],
                        "event": "task_recovered",
                        "details": f"Re-queued {reason} task (worker {worker_label})",
                    }).execute()
                except Exception:
                    pass

                recovered += 1
                logger.warning(
                    "Recovered stuck task %s: %s (worker=%s)",
                    task["id"][:8],
                    task["title"][:40],
                    worker_id[:8] if worker_id else "none",
                )

        if recovered:
            logger.info("Recovered %d stuck tasks", recovered)

    # ── Budget enforcement ────────────────────────────────────────────────

    def enforce_budgets(self):
        """Pause workers if budget is exceeded."""
        status = self.budget_manager.get_status()

        if status["api_pct"] >= 100:
            logger.warning("API budget exceeded! Pausing light workers.")
            self._pause_workers("light")

        if status["cc_pct"] >= 100:
            logger.warning("Claude Code budget exceeded! Pausing heavy and cc_light workers.")
            self._pause_workers("heavy")
            self._pause_workers("cc_light")

    def _pause_workers(self, tier: str):
        """Mark all workers of a tier as paused."""
        self.sb.table(self.WORKERS_TABLE).update({"status": "paused"}).eq(
            "tier", tier
        ).neq("status", "dead").execute()

    # ── Stale data cleanup ─────────────────────────────────────────────

    def cleanup_stale_data(self):
        """Remove failed tasks older than 24h and dead workers older than 12h."""
        now = datetime.now(timezone.utc)

        # Delete failed tasks older than 24 hours
        failed_cutoff = (now - timedelta(hours=24)).isoformat()
        try:
            resp = (
                self.sb.table(self.TASKS_TABLE)
                .delete()
                .eq("status", "failed")
                .lt("updated_at", failed_cutoff)
                .execute()
            )
            deleted_tasks = len(resp.data) if resp.data else 0
            if deleted_tasks:
                logger.info("Cleaned up %d failed tasks older than 24h", deleted_tasks)
        except Exception as e:
            logger.warning("Failed to clean up old failed tasks: %s", e)

        # Delete dead workers older than 12 hours
        dead_cutoff = (now - timedelta(hours=12)).isoformat()
        try:
            resp = (
                self.sb.table(self.WORKERS_TABLE)
                .delete()
                .eq("status", "dead")
                .lt("died_at", dead_cutoff)
                .execute()
            )
            deleted_workers = len(resp.data) if resp.data else 0
            if deleted_workers:
                logger.info("Cleaned up %d dead workers older than 12h", deleted_workers)
        except Exception as e:
            logger.warning("Failed to clean up dead workers: %s", e)

        # Clean up old task log entries older than 7 days
        log_cutoff = (now - timedelta(days=7)).isoformat()
        try:
            self.sb.table(self.TASK_LOG_TABLE).delete().lt(
                "created_at", log_cutoff
            ).execute()
        except Exception as e:
            logger.debug("Failed to clean up old task logs: %s", e)

        self._last_cleanup = time.time()
        logger.info("Periodic cleanup complete")

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
                "cc_light": sum(1 for w in active_workers if w["tier"] == "cc_light"),
                "heavy": sum(1 for w in active_workers if w["tier"] == "heavy"),
                "browser": sum(1 for w in active_workers if w["tier"] == "browser"),
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

    def get_health_score(self) -> dict[str, Any]:
        """Calculate overall swarm health score (0-100).

        Factors:
        - Worker availability (25%): active workers vs tasks needing work
        - Error rate (25%): recent failure rate
        - Budget headroom (25%): remaining budget
        - Queue health (25%): queue depth and wait times
        """
        score = 100
        issues: list[str] = []

        # Worker availability (25 points)
        active_workers = self._get_active_workers()
        active_tasks = self.task_manager.get_all_active()
        queued = sum(1 for t in active_tasks if t["status"] == "queued")
        working = sum(1 for w in active_workers if w.get("status") == "working")
        total_workers = len(active_workers)

        if total_workers == 0 and queued > 0:
            score -= 25
            issues.append("No active workers with queued tasks")
        elif queued > total_workers * 3:
            score -= 15
            issues.append(f"Queue overloaded: {queued} tasks for {total_workers} workers")
        elif queued > total_workers:
            score -= 5

        # Error rate (25 points) — check last 50 completed/failed tasks
        try:
            recent_resp = (
                self.sb.table(self.TASKS_TABLE)
                .select("status")
                .in_("status", ["completed", "failed"])
                .order("updated_at", desc=True)
                .limit(50)
                .execute()
            )
            recent = recent_resp.data or []
            if len(recent) >= 5:
                failed = sum(1 for t in recent if t["status"] == "failed")
                error_rate = failed / len(recent)
                if error_rate > 0.5:
                    score -= 25
                    issues.append(f"High error rate: {error_rate:.0%}")
                elif error_rate > 0.2:
                    score -= 15
                    issues.append(f"Elevated error rate: {error_rate:.0%}")
                elif error_rate > 0.1:
                    score -= 5
        except Exception:
            pass

        # Budget headroom (25 points)
        budget = self.budget_manager.get_status()
        api_pct = budget.get("api_pct", 0)
        if api_pct >= 100:
            score -= 25
            issues.append("API budget exhausted")
        elif api_pct >= 80:
            score -= 10
            issues.append(f"API budget at {api_pct:.0f}%")

        # Queue health (25 points) — check for long-blocked tasks
        blocked = [t for t in active_tasks if t["status"] == "blocked"]
        if len(blocked) > 10:
            score -= 15
            issues.append(f"{len(blocked)} blocked tasks")
        elif len(blocked) > 5:
            score -= 5

        return {
            "score": max(0, score),
            "grade": "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 40 else "F",
            "issues": issues,
            "workers_active": total_workers,
            "workers_busy": working,
            "queue_depth": queued,
            "blocked_count": len(blocked),
        }
