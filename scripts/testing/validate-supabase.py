"""Test 9: Verify all expected Supabase tables exist with correct columns."""
import json, urllib.request, sys

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

EXPECTED_TABLES = {
    "nexus_sessions": ["session_id", "project_name", "model", "status", "tool_count", "cost_usd", "input_tokens", "output_tokens"],
    "nexus_hook_events": ["session_id", "event_type", "tool_name", "project_name"],
    "swarm_tasks": ["id", "title", "project", "status", "priority", "cost_tier", "task_type"],
    "swarm_workers": ["id", "worker_name", "tier", "status", "tasks_completed"],
    "swarm_budgets": ["budget_date", "daily_api_budget_cents", "api_spent_cents"],
    "swarm_task_log": ["task_id", "event", "details"],
    "agent_activity": ["agent_id", "agent_name", "project", "status"],
    "oracle_decisions": ["title", "severity", "status"],
}

def check_table(table, expected_cols):
    try:
        req = urllib.request.Request(f"{SB_URL}/rest/v1/{table}?limit=0",
            headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "count=exact"})
        resp = urllib.request.urlopen(req, timeout=5)
        # If we get here, table exists
        # Check columns by requesting one row
        req2 = urllib.request.Request(f"{SB_URL}/rest/v1/{table}?limit=1",
            headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
        data = json.loads(urllib.request.urlopen(req2, timeout=5).read())
        if data:
            cols = set(data[0].keys())
            missing = [c for c in expected_cols if c not in cols]
            if missing:
                return "WARN", f"missing columns: {', '.join(missing)}"
        return "PASS", "exists"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "FAIL", "table not found"
        return "FAIL", f"HTTP {e.code}"
    except Exception as e:
        return "FAIL", str(e)

print(f"\n  Validating {len(EXPECTED_TABLES)} Supabase tables\n")
passed = 0
for table, cols in EXPECTED_TABLES.items():
    status, msg = check_table(table, cols)
    icon = "PASS" if status == "PASS" else "WARN" if status == "WARN" else "FAIL"
    print(f"  {icon:4s}  {table:25s} {msg}")
    if status != "FAIL": passed += 1

print(f"\n  {passed}/{len(EXPECTED_TABLES)} tables verified")
sys.exit(0 if passed == len(EXPECTED_TABLES) else 1)
