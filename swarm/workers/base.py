"""
Base worker class: registration, heartbeat, pull-execute-report loop.
"""

import logging
import signal
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import requests

from swarm.budget.budget_manager import BudgetManager
from swarm.config import MISSION_CONTROL_URL, SUPABASE_KEY, SUPABASE_URL
from swarm.tasks.task_manager import TaskManager

logger = logging.getLogger("swarm.worker")


class BaseWorker:
    """Abstract base class for swarm workers."""

    WORKERS_TABLE = "swarm_workers"

    def __init__(self, worker_type: str, tier: str):
        """Initialize and register worker.

        Args:
            worker_type: Human label (e.g. "builder", "miner", "evaluator")
            tier: "light" or "heavy"
        """
        from supabase import create_client

        self.worker_id = str(uuid.uuid4())
        self.worker_type = worker_type
        self.tier = tier
        self.alive = True

        self.sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.task_manager = TaskManager()
        self.budget_manager = BudgetManager()

        # Register in workers table
        self.sb.table(self.WORKERS_TABLE).insert(
            {
                "id": self.worker_id,
                "worker_type": self.worker_type,
                "tier": self.tier,
                "status": "idle",
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                "started_at": datetime.now(timezone.utc).isoformat(),
                "pid": self._get_pid(),
            }
        ).execute()

        logger.info(
            "Worker %s registered: type=%s tier=%s",
            self.worker_id[:8],
            worker_type,
            tier,
        )

        # Graceful shutdown on signals
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    @staticmethod
    def _get_pid() -> int:
        import os
        return os.getpid()

    def _signal_handler(self, signum, frame):
        logger.info("Worker %s received signal %s, shutting down", self.worker_id[:8], signum)
        self.alive = False

    # ── Heartbeat ─────────────────────────────────────────────────────────

    def heartbeat(self):
        """Update last_heartbeat timestamp."""
        self.sb.table(self.WORKERS_TABLE).update(
            {"last_heartbeat": datetime.now(timezone.utc).isoformat()}
        ).eq("id", self.worker_id).execute()

    # ── Execute (override in subclass) ────────────────────────────────────

    def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """Execute a task. Must be overridden by subclasses.

        Args:
            task: The task row from Supabase

        Returns:
            Output data dict
        """
        raise NotImplementedError("Subclasses must implement execute()")

    # ── Report to Mission Control ─────────────────────────────────────────

    def report_to_mission_control(self, step: str, status: str, data: Optional[dict] = None):
        """Send a step report to Mission Control API.

        Args:
            step: Step description
            status: "running", "completed", "failed"
            data: Optional payload
        """
        payload = {
            "worker_id": self.worker_id,
            "worker_type": self.worker_type,
            "step": step,
            "status": status,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            resp = requests.post(
                f"{MISSION_CONTROL_URL}/api/swarm/report",
                json=payload,
                timeout=10,
            )
            if resp.status_code >= 400:
                logger.debug("Mission Control report returned %d", resp.status_code)
        except Exception as e:
            logger.debug("Could not reach Mission Control: %s", e)

    # ── Pull and execute ──────────────────────────────────────────────────

    def pull_and_execute(self) -> bool:
        """Pull the next task, execute it, and report results.

        Returns:
            True if a task was executed, False if queue was empty
        """
        # Check budget before pulling
        if not self.budget_manager.can_spend(self.tier):
            logger.warning("Budget exceeded for tier=%s, skipping", self.tier)
            self.report_to_mission_control("budget_check", "blocked", {"tier": self.tier})
            return False

        # Update status to idle while looking
        self.sb.table(self.WORKERS_TABLE).update({"status": "idle"}).eq(
            "id", self.worker_id
        ).execute()

        task = self.task_manager.pull_task(self.tier)
        if not task:
            return False

        # Update worker status
        self.sb.table(self.WORKERS_TABLE).update(
            {"status": "working", "current_task_id": task["id"]}
        ).eq("id", self.worker_id).execute()

        self.report_to_mission_control(
            "task_started", "running", {"task_id": task["id"], "title": task["title"]}
        )

        try:
            output = self.execute(task)
            self.task_manager.complete_task(task["id"], output)
            self.report_to_mission_control(
                "task_completed",
                "completed",
                {"task_id": task["id"], "title": task["title"]},
            )
            logger.info("Task %s completed successfully", task["id"][:8])
        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            self.task_manager.fail_task(task["id"], error_msg)
            self.report_to_mission_control(
                "task_failed",
                "failed",
                {"task_id": task["id"], "error": error_msg},
            )
            logger.error("Task %s failed: %s", task["id"][:8], error_msg)
        finally:
            self.sb.table(self.WORKERS_TABLE).update(
                {"status": "idle", "current_task_id": None}
            ).eq("id", self.worker_id).execute()

        return True

    # ── Main loop ─────────────────────────────────────────────────────────

    def run_loop(self, poll_interval: float = 5.0):
        """Continuous loop: pull, execute, report, repeat.

        Args:
            poll_interval: Seconds to sleep when queue is empty
        """
        logger.info("Worker %s starting loop (tier=%s)", self.worker_id[:8], self.tier)
        while self.alive:
            try:
                self.heartbeat()
                executed = self.pull_and_execute()
                if not executed:
                    time.sleep(poll_interval)
            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error("Worker loop error: %s", e, exc_info=True)
                time.sleep(poll_interval)

        self.shutdown()

    # ── Shutdown ──────────────────────────────────────────────────────────

    def shutdown(self):
        """Mark worker as dead in the registry."""
        try:
            self.sb.table(self.WORKERS_TABLE).update(
                {
                    "status": "dead",
                    "stopped_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", self.worker_id).execute()
            logger.info("Worker %s shut down", self.worker_id[:8])
        except Exception as e:
            logger.error("Error during shutdown: %s", e)
