"""
Persistent Nexus Hive daemon.

Runs the orchestrator continuously in the background as a 24/7 process.
Handles graceful shutdown on SIGINT/SIGTERM.

Usage:
    python -m swarm.daemon
    python -m swarm --daemon
"""

import logging
import signal
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger("swarm.daemon")


def run_daemon():
    """Run the Nexus Hive as a persistent background process."""
    from swarm.orchestrator import SwarmOrchestrator

    orch = SwarmOrchestrator()

    def shutdown(sig, frame):
        signame = signal.Signals(sig).name if hasattr(signal, "Signals") else str(sig)
        logger.info("Nexus Hive received %s, shutting down...", signame)
        orch.alive = False

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    logger.info("=" * 60)
    logger.info("  NEXUS HIVE DAEMON STARTED")
    logger.info("  Running 24/7. Press Ctrl+C to stop.")
    logger.info("=" * 60)

    try:
        orch.run()  # This loops until orch.alive is False
    except Exception as e:
        logger.error("Daemon crashed: %s", e, exc_info=True)
        sys.exit(1)

    logger.info("Nexus Hive daemon stopped cleanly.")


if __name__ == "__main__":
    run_daemon()
