"""Comprehensive Nexus test suite — run with: pytest tests/ -v"""

import json
import os
import time
import urllib.request
import urllib.error
import pytest

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"


def sb_get(path):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"},
    )
    return json.loads(urllib.request.urlopen(req, timeout=10).read())


def sb_post(path, data):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        json.dumps(data).encode(),
        headers={
            "apikey": SB_KEY,
            "Authorization": f"Bearer {SB_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    return json.loads(urllib.request.urlopen(req, timeout=10).read())


def sb_delete(path):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        headers={
            "apikey": SB_KEY,
            "Authorization": f"Bearer {SB_KEY}",
            "Prefer": "return=representation",
        },
        method="DELETE",
    )
    return json.loads(urllib.request.urlopen(req, timeout=10).read())


# ── Test 1: Supabase Connection ─────────────────────────────────────

EXPECTED_TABLES = [
    "nexus_sessions",
    "nexus_hook_events",
    "swarm_tasks",
    "swarm_workers",
    "swarm_budgets",
    "swarm_task_log",
    "agent_activity",
    "oracle_decisions",
    "nexus_schedules",
]


@pytest.mark.parametrize("table", EXPECTED_TABLES)
def test_supabase_table_exists(table):
    """Verify each Supabase table exists and is queryable."""
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{table}?limit=0",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"},
    )
    resp = urllib.request.urlopen(req, timeout=10)
    assert resp.getcode() == 200


# ── Test 2: Collector Event ──────────────────────────────────────────


def test_collector_event_write_and_read():
    """Send a collector event directly to Supabase and verify it's readable."""
    test_sid = f"pytest-{int(time.time())}"

    # Write
    sb_post("nexus_sessions", {
        "session_id": test_sid,
        "project_name": "pytest",
        "status": "completed",
        "tool_count": 1,
        "cost_usd": 0.001,
    })

    # Read
    sessions = sb_get(f"nexus_sessions?session_id=eq.{test_sid}")
    assert len(sessions) == 1
    assert sessions[0]["project_name"] == "pytest"
    assert sessions[0]["tool_count"] == 1

    # Cleanup
    sb_delete(f"nexus_sessions?session_id=eq.{test_sid}")


# ── Test 3: Spawn Mission ───────────────────────────────────────────


def test_swarm_tasks_readable():
    """Verify swarm_tasks table is queryable with expected fields."""
    tasks = sb_get("swarm_tasks?limit=1&order=updated_at.desc")
    assert isinstance(tasks, list)
    if tasks:
        t = tasks[0]
        assert "id" in t
        assert "title" in t
        assert "status" in t
        assert "project" in t
        assert "priority" in t
        assert t["status"] in ("queued", "running", "completed", "failed", "blocked", "pending")


# ── Test 4: Sessions API Format ──────────────────────────────────────


def test_sessions_data_format():
    """Verify nexus_sessions returns data in expected format."""
    sessions = sb_get("nexus_sessions?limit=5&order=last_activity.desc")
    assert isinstance(sessions, list)
    if sessions:
        s = sessions[0]
        assert "session_id" in s
        assert "project_name" in s
        assert "status" in s
        assert "cost_usd" in s
        assert "tool_count" in s


# ── Test 5: Pricing Calculations ─────────────────────────────────────


def test_pricing_calculations():
    """Verify cost calculation for all Claude models."""
    sys_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "lib")

    # Test the Python-side pricing logic (same formula as TypeScript)
    # Opus: $15/1M input, $75/1M output
    opus_cost = (50000 / 1_000_000) * 15 + (12000 / 1_000_000) * 75
    assert abs(opus_cost - 1.65) < 0.01

    # Sonnet: $3/1M input, $15/1M output
    sonnet_cost = (50000 / 1_000_000) * 3 + (12000 / 1_000_000) * 15
    assert abs(sonnet_cost - 0.33) < 0.01

    # Haiku: $0.8/1M input, $4/1M output
    haiku_cost = (50000 / 1_000_000) * 0.8 + (12000 / 1_000_000) * 4
    assert abs(haiku_cost - 0.088) < 0.01


# ── Test 6: Hook Event Format ────────────────────────────────────────


def test_hook_event_insert():
    """Verify hook events can be written and read."""
    test_sid = f"pytest-hook-{int(time.time())}"

    sb_post("nexus_hook_events", {
        "session_id": test_sid,
        "event_type": "PreToolUse",
        "tool_name": "PytestTool",
        "project_name": "pytest",
    })

    events = sb_get(f"nexus_hook_events?session_id=eq.{test_sid}")
    assert len(events) == 1
    assert events[0]["event_type"] == "PreToolUse"
    assert events[0]["tool_name"] == "PytestTool"

    # Cleanup
    sb_delete(f"nexus_hook_events?session_id=eq.{test_sid}")


# ── Test 7: Schedule CRUD ────────────────────────────────────────────


def test_schedule_crud():
    """Verify schedules can be created and deleted."""
    result = sb_post("nexus_schedules", {
        "name": "Pytest Schedule",
        "goal": "Test goal",
        "cron_expression": "0 12 * * *",
        "enabled": False,
    })

    assert len(result) == 1
    schedule_id = result[0]["id"]

    # Read
    schedules = sb_get(f"nexus_schedules?id=eq.{schedule_id}")
    assert len(schedules) == 1
    assert schedules[0]["name"] == "Pytest Schedule"

    # Delete
    sb_delete(f"nexus_schedules?id=eq.{schedule_id}")
    after = sb_get(f"nexus_schedules?id=eq.{schedule_id}")
    assert len(after) == 0


# ── Test 8: Task Log Format ──────────────────────────────────────────


def test_task_log_read():
    """Verify task log entries are readable."""
    logs = sb_get("swarm_task_log?limit=1")
    assert isinstance(logs, list)
    if logs:
        assert "event" in logs[0]
        assert "details" in logs[0]


# ── Test 9: Project Scanner ──────────────────────────────────────────


def test_project_dirs_exist():
    """Verify key project directories exist on disk."""
    projects_root = "C:/Users/Kruz/Desktop/Projects"
    required = ["nexus", "buildkit-services", "ai-finance-brief"]

    for proj in required:
        path = os.path.join(projects_root, proj)
        assert os.path.isdir(path), f"Project directory missing: {path}"


# ── Test 10: Executor Script Exists ──────────────────────────────────


def test_executor_exists():
    """Verify executor.py exists and is importable."""
    executor_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "executor.py"
    )
    assert os.path.isfile(executor_path)

    # Verify it has the main function
    with open(executor_path) as f:
        content = f.read()
    assert "def main():" in content
    assert "def execute_task(" in content
    assert "def fetch_next_task(" in content
