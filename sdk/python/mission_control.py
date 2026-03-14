"""
Nexus Agent SDK

A lightweight Python client for reporting agent activity
to the Nexus dashboard in real-time.

Usage:
    from mission_control import MissionControl

    mc = MissionControl("Email Enricher", "buildkit-services", total_steps=500)
    mc.step("Scanning rainmasterqc.com...", 1)
    mc.step("Found: office@rainmasterqc.com", 2)
    mc.log("Batch 1 complete: 127/150 emails found")
    mc.complete("500 prospects scanned, 312 emails found")
"""

import os
import uuid
import time
import urllib.request
import urllib.error
import json
from typing import Optional


class MissionControl:
    """Reports agent activity to the Nexus dashboard."""

    def __init__(
        self,
        agent_name: str,
        project: str,
        total_steps: Optional[int] = None,
        base_url: Optional[str] = None,
        agent_id: Optional[str] = None,
        worker_type: str = "builder",
    ):
        self.agent_name = agent_name
        self.project = project
        self.total_steps = total_steps
        self.worker_type = worker_type
        self.base_url = (
            base_url
            or os.environ.get("NEXUS_URL")
            or os.environ.get("MISSION_CONTROL_URL", "http://localhost:3000")
        ).rstrip("/")
        self.agent_id = agent_id or f"{agent_name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:8]}"
        self._steps_completed = 0
        self._started = time.time()
        self._output_log: list[str] = []

        # Register with dashboard
        self._send_heartbeat(status="running", current_step="Initializing...")

    def step(self, description: str, step_num: Optional[int] = None) -> None:
        """Report the current step the agent is working on."""
        if step_num is not None:
            self._steps_completed = step_num
        else:
            self._steps_completed += 1

        self._send_heartbeat(status="running", current_step=description)

    def log(self, message: str) -> None:
        """Add a message to the output log."""
        self._output_log.append(message)
        self._send_heartbeat(
            status="running",
            current_step=message,
            output="\n".join(self._output_log),
        )

    def complete(self, summary: Optional[str] = None) -> None:
        """Mark the agent as successfully completed."""
        elapsed = time.time() - self._started
        final_output = summary or f"Completed in {elapsed:.1f}s"
        if self._output_log:
            final_output = "\n".join(self._output_log) + "\n---\n" + final_output

        self._send_heartbeat(
            status="completed",
            current_step="Done",
            output=final_output,
        )

    def fail(self, error: Optional[str] = None) -> None:
        """Mark the agent as failed."""
        elapsed = time.time() - self._started
        error_msg = error or "Unknown error"
        final_output = f"FAILED after {elapsed:.1f}s: {error_msg}"
        if self._output_log:
            final_output = "\n".join(self._output_log) + "\n---\n" + final_output

        self._send_heartbeat(
            status="failed",
            current_step=f"Error: {error_msg}",
            output=final_output,
        )

    def gain_xp(self, amount: int, reason: Optional[str] = None) -> None:
        """Award XP to this agent for completing work."""
        payload = {
            "agent_id": self.agent_id,
            "xp": amount,
            "reason": reason or "Task completed",
        }

        url = f"{self.base_url}/api/xp"
        data = json.dumps(payload).encode("utf-8")

        try:
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                resp.read()
        except (urllib.error.URLError, OSError) as e:
            print(f"[Nexus] Warning: Failed to send XP: {e}")

    def _send_heartbeat(
        self,
        status: str,
        current_step: Optional[str] = None,
        output: Optional[str] = None,
    ) -> None:
        """Send a heartbeat to the Mission Control API."""
        payload = {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "project": self.project,
            "status": status,
            "current_step": current_step,
            "steps_completed": self._steps_completed,
            "total_steps": self.total_steps,
            "output": output,
            "worker_type": self.worker_type,
        }

        url = f"{self.base_url}/api/heartbeat"
        data = json.dumps(payload).encode("utf-8")

        try:
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                resp.read()
        except (urllib.error.URLError, OSError) as e:
            # Silently fail — don't break the agent's main loop
            print(f"[Nexus] Warning: Failed to send heartbeat: {e}")


# Context manager support
class MissionControlContext:
    """Use Mission Control as a context manager for automatic complete/fail."""

    def __init__(
        self,
        agent_name: str,
        project: str,
        total_steps: Optional[int] = None,
        base_url: Optional[str] = None,
    ):
        self.mc = MissionControl(agent_name, project, total_steps, base_url)

    def __enter__(self) -> MissionControl:
        return self.mc

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None:
            self.mc.fail(str(exc_val))
        else:
            self.mc.complete()


if __name__ == "__main__":
    # Quick demo
    import sys

    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"

    mc = MissionControl("Demo Agent", "test-project", total_steps=5, base_url=base)

    for i in range(1, 6):
        mc.step(f"Processing item {i}/5...", i)
        time.sleep(1)

    mc.complete("Demo complete! 5 items processed.")
    print("Done! Check your Nexus dashboard.")
