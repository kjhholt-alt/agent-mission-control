"""
Example: PL Engine Improve Loop with Nexus

Shows how to wrap any agent loop with Nexus reporting
so every step appears on the real-time dashboard.

Usage:
    python pl-engine-integration.py

    Or set NEXUS_URL to point at a deployed instance:
    NEXUS_URL=https://nexus.buildkit.store python pl-engine-integration.py
"""

import sys
import os
import time
import random

# Add SDK to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sdk", "python"))
from mission_control import MissionControl, MissionControlContext


def simulate_pl_engine_improve():
    """Simulates the PL Engine improve loop with Mission Control integration."""

    # Define the improvement targets
    targets = [
        {"file": "src/core/engine.py", "function": "calculate_pnl", "complexity": 47},
        {"file": "src/core/positions.py", "function": "reconcile_positions", "complexity": 35},
        {"file": "src/api/trades.py", "function": "fetch_recent_trades", "complexity": 28},
        {"file": "src/utils/math.py", "function": "weighted_average", "complexity": 15},
    ]

    total_steps = len(targets) * 3 + 2  # analyze + refactor + test per target, plus PR steps
    mc = MissionControl(
        "PL Engine Optimizer",
        "pl-engine",
        total_steps=total_steps,
    )

    step = 0

    try:
        # Phase 1: Scan codebase
        step += 1
        mc.step(f"Scanning codebase for improvement targets ({len(targets)} found)...", step)
        time.sleep(1.5)

        # Phase 2: Process each target
        for target in targets:
            # Analyze
            step += 1
            mc.step(
                f"Analyzing {target['function']}() in {target['file']} "
                f"(complexity: {target['complexity']})",
                step,
            )
            time.sleep(1 + random.random())

            # Refactor
            new_complexity = max(8, target["complexity"] - random.randint(10, 25))
            step += 1
            mc.step(
                f"Refactoring {target['function']}() — "
                f"reduced from {target['complexity']} to {new_complexity} lines",
                step,
            )
            time.sleep(1.5 + random.random())

            mc.log(
                f"[OK] {target['file']}::{target['function']} "
                f"({target['complexity']} -> {new_complexity} lines)"
            )

            # Test
            test_count = random.randint(12, 45)
            step += 1
            mc.step(f"Running tests for {target['function']}... ({test_count} tests)", step)
            time.sleep(1 + random.random())

        # Phase 3: Final steps
        step += 1
        mc.step("Running full test suite (142 tests)...", step)
        time.sleep(2)

        mc.complete(
            f"Refactored {len(targets)} functions, "
            f"reduced average complexity by 38%. "
            f"All 142 tests passing. PR #47 ready for review."
        )

    except Exception as e:
        mc.fail(str(e))
        raise


def example_with_context_manager():
    """Shows how to use MissionControl as a context manager."""

    with MissionControlContext("Quick Scanner", "demo-project", total_steps=3) as mc:
        mc.step("Step 1: Loading data...", 1)
        time.sleep(1)
        mc.step("Step 2: Processing...", 2)
        time.sleep(1)
        mc.step("Step 3: Saving results...", 3)
        time.sleep(1)
        # Auto-completes on exit; auto-fails if exception is raised


if __name__ == "__main__":
    print("=" * 60)
    print("  PL Engine Improve Loop — Nexus Demo")
    print("=" * 60)
    print()
    print("Watch your dashboard at http://localhost:3000")
    print()

    simulate_pl_engine_improve()

    print()
    print("Done! The agent should now appear as 'completed' on your dashboard.")
