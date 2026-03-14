"""
Base worker class: registration, heartbeat, pull-execute-report loop.

Schema (swarm_workers):
  id (text PK), worker_name (text), worker_type (text), tier (text),
  status (text, default 'idle'), current_task_id (uuid),
  last_heartbeat (timestamptz), pid (int),
  tasks_completed (int), tasks_failed (int),
  total_cost_cents (int), total_tokens (int), xp (int),
  spawned_at (timestamptz), died_at (timestamptz)
"""

import logging
import re
import signal
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
import requests

from swarm.budget.budget_manager import BudgetManager
from swarm.budget.cost_calculator import calculate_cost
from swarm.config import ANTHROPIC_API_KEY, ENABLE_QUALITY_GATE, NEXUS_URL, SUPABASE_KEY, SUPABASE_URL
from swarm.memory import SwarmMemory
from swarm.retry_strategy import AdaptiveRetry
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
        self.memory = SwarmMemory(supabase_client=self.sb)
        self.retry_strategy = AdaptiveRetry()

        now = datetime.now(timezone.utc).isoformat()

        # Register in workers table
        self.sb.table(self.WORKERS_TABLE).insert(
            {
                "id": self.worker_id,
                "worker_name": f"{worker_type}-{self.worker_id[:8]}",
                "worker_type": self.worker_type,
                "tier": self.tier,
                "status": "idle",
                "last_heartbeat": now,
                "spawned_at": now,
                "pid": self._get_pid(),
                "tasks_completed": 0,
                "tasks_failed": 0,
                "total_cost_cents": 0,
                "total_tokens": 0,
                "xp": 0,
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

    # ── Report to Nexus ──────────────────────────────────────────────────

    def report_to_nexus(self, step: str, status: str, data: Optional[dict] = None):
        """Send a step report to Nexus API.

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
                f"{NEXUS_URL}/api/swarm/report",
                json=payload,
                timeout=10,
            )
            if resp.status_code >= 400:
                logger.debug("Nexus report returned %d", resp.status_code)
        except Exception as e:
            logger.debug("Could not reach Nexus: %s", e)

    # ── Quality gate ─────────────────────────────────────────────────────

    def quality_check(self, task_title: str, output: str) -> tuple[bool, str]:
        """Run a quick quality check on task output using Haiku.

        Calls Haiku to rate the output 1-10 for actionability and specificity.
        Returns (True, "") if score >= 5, or (False, reason) if score < 5.

        Args:
            task_title: Title of the completed task
            output: The output text to evaluate

        Returns:
            Tuple of (passed: bool, reason: str)
        """
        if not ENABLE_QUALITY_GATE:
            return (True, "")

        # Truncate output to avoid huge quality check calls
        check_output = output[:2000] if len(output) > 2000 else output

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=10,
                system="You rate task outputs. Reply with ONLY a single number 1-10.",
                messages=[{
                    "role": "user",
                    "content": (
                        f"Rate this output 1-10 for actionability and specificity. "
                        f"Task: {task_title}. Output: {check_output}. "
                        f"Reply with just the number."
                    ),
                }],
            )

            response_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    response_text += block.text

            # Record the quality check cost
            qc_cost = calculate_cost(
                "claude-haiku-4-5-20251001",
                response.usage.input_tokens,
                response.usage.output_tokens,
            )
            self.budget_manager.record_spend(cents=qc_cost)

            # Parse score
            match = re.search(r"\d+", response_text.strip())
            if match:
                score = int(match.group())
                logger.info("Quality check score: %d/10 for task '%s'", score, task_title[:40])
                if score < 5:
                    return (False, f"Low quality output (score: {score}/10)")
                return (True, "")
            else:
                logger.warning("Quality check returned unparseable response: %s", response_text)
                return (True, "")  # Pass on parse failure to avoid blocking

        except Exception as e:
            logger.warning("Quality check failed: %s (passing by default)", e)
            return (True, "")  # Don't block on quality check errors

    # ── Pull and execute ──────────────────────────────────────────────────

    def pull_and_execute(self) -> bool:
        """Pull the next task, execute it, and report results.

        Returns:
            True if a task was executed, False if queue was empty
        """
        # Check budget before pulling
        if not self.budget_manager.can_spend(self.tier):
            logger.warning("Budget exceeded for tier=%s, skipping", self.tier)
            self.report_to_nexus("budget_check", "blocked", {"tier": self.tier})
            return False

        # Update status to idle while looking
        self.sb.table(self.WORKERS_TABLE).update({"status": "idle"}).eq(
            "id", self.worker_id
        ).execute()

        task = self.task_manager.pull_task(self.tier, worker_id=self.worker_id, worker_type=self.worker_type)
        if not task:
            return False

        # Update worker status
        self.sb.table(self.WORKERS_TABLE).update(
            {"status": "working", "current_task_id": task["id"]}
        ).eq("id", self.worker_id).execute()

        self.report_to_nexus(
            "task_started", "running", {"task_id": task["id"], "title": task["title"]}
        )

        # ── Memory injection: add context from previous work ──────────
        project = task.get("project", "")
        task_type = task.get("task_type")
        if project:
            context = self.memory.recall(project)
            failed_approaches = self.memory.get_failed_approaches(project, task_type)
            input_data = task.get("input_data", {})
            if isinstance(input_data, str):
                import json
                input_data = json.loads(input_data)

            prompt = input_data.get("prompt", "")
            memory_prefix = ""
            if context:
                memory_prefix += f"{context}\n\n"
            if failed_approaches:
                memory_prefix += f"{failed_approaches}\n\n"
            if memory_prefix and prompt:
                input_data["prompt"] = f"{memory_prefix}{prompt}"
                task["input_data"] = input_data

        # ── Adaptive retry: modify prompt if this is a retry ──────────
        retry_count = task.get("retry_count", 0)
        if retry_count > 0:
            input_data = task.get("input_data", {})
            if isinstance(input_data, str):
                import json
                input_data = json.loads(input_data)

            original_prompt = input_data.get("prompt", "")
            previous_error = task.get("error_message", "Unknown error")
            enhanced_prompt = self.retry_strategy.enhance_prompt_after_failure(
                original_prompt, previous_error, retry_count
            )
            input_data["prompt"] = enhanced_prompt

            # On attempt 2+, escalate the system prompt
            if self.retry_strategy.should_escalate_model(retry_count):
                system = input_data.get(
                    "system",
                    "You are an autonomous agent worker in a swarm system. "
                    "Complete the task precisely and return structured output.",
                )
                input_data["system"] = self.retry_strategy.build_escalation_system_prompt(system)

            task["input_data"] = input_data
            logger.info(
                "Task %s: retry %d, prompt enhanced with failure context",
                task["id"][:8],
                retry_count,
            )

        try:
            output = self.execute(task)

            # ── Quality gate: check output before marking complete ────────
            response_text = output.get("response", output.get("stdout", ""))
            quality_retried = task.get("_quality_retried", False)

            if ENABLE_QUALITY_GATE and response_text and not quality_retried:
                passed, reason = self.quality_check(task.get("title", ""), response_text)
                if not passed:
                    logger.warning(
                        "Task %s failed quality gate: %s. Retrying with enhanced prompt.",
                        task["id"][:8],
                        reason,
                    )
                    # Retry once with enhanced prompt
                    input_data = task.get("input_data", {})
                    if isinstance(input_data, str):
                        import json
                        input_data = json.loads(input_data)
                    input_data = dict(input_data)
                    original_prompt = input_data.get("prompt", "")
                    input_data["prompt"] = (
                        f"Previous attempt was too vague. Be MORE specific and actionable.\n\n"
                        f"{original_prompt}"
                    )
                    task["input_data"] = input_data
                    task["_quality_retried"] = True
                    output = self.execute(task)
                    response_text = output.get("response", output.get("stdout", ""))

            # Extract cost/token info from output if available (must be int for Supabase)
            cost_cents = int(round(output.get("cost_cents", 0)))
            tokens = int(output.get("input_tokens", 0)) + int(output.get("output_tokens", 0))

            self.task_manager.complete_task(task["id"], output, cost_cents=cost_cents, tokens=tokens)
            self.budget_manager.record_task_result(success=True)

            # Update worker stats
            self.sb.table(self.WORKERS_TABLE).update({
                "tasks_completed": self.sb.table(self.WORKERS_TABLE)
                    .select("tasks_completed")
                    .eq("id", self.worker_id)
                    .execute()
                    .data[0]["tasks_completed"] + 1,
                "total_cost_cents": self.sb.table(self.WORKERS_TABLE)
                    .select("total_cost_cents")
                    .eq("id", self.worker_id)
                    .execute()
                    .data[0]["total_cost_cents"] + cost_cents,
                "total_tokens": self.sb.table(self.WORKERS_TABLE)
                    .select("total_tokens")
                    .eq("id", self.worker_id)
                    .execute()
                    .data[0]["total_tokens"] + tokens,
                "xp": self.sb.table(self.WORKERS_TABLE)
                    .select("xp")
                    .eq("id", self.worker_id)
                    .execute()
                    .data[0]["xp"] + 10,
            }).eq("id", self.worker_id).execute()

            # ── Store result in memory bank ─────────────────────────────
            if project:
                response_text = output.get("response", "")
                self.memory.store(
                    project=project,
                    task_title=task.get("title", "Untitled"),
                    output=response_text,
                    task_type=task.get("task_type"),
                    tokens_used=tokens,
                )

            self.report_to_nexus(
                "task_completed",
                "completed",
                {"task_id": task["id"], "title": task["title"]},
            )
            logger.info("Task %s completed successfully", task["id"][:8])
        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            self.task_manager.fail_task(task["id"], error_msg)
            self.budget_manager.record_task_result(success=False)

            # Update worker fail count
            try:
                w = self.sb.table(self.WORKERS_TABLE).select("tasks_failed").eq("id", self.worker_id).execute()
                if w.data:
                    self.sb.table(self.WORKERS_TABLE).update({
                        "tasks_failed": w.data[0]["tasks_failed"] + 1,
                    }).eq("id", self.worker_id).execute()
            except Exception:
                pass

            self.report_to_nexus(
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
                    "died_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", self.worker_id).execute()
            logger.info("Worker %s shut down", self.worker_id[:8])
        except Exception as e:
            logger.error("Error during shutdown: %s", e)
