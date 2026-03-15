"""Test 2: Spawn a mission via API, verify task created in Supabase."""
import json, urllib.request, sys, time

NEXUS = "http://localhost:3000"
API_KEY = "nexus-hive-2026"
SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

def post(url, data, key=None):
    headers = {"Content-Type": "application/json"}
    if key: headers["x-nexus-key"] = key
    req = urllib.request.Request(url, json.dumps(data).encode(), headers)
    return json.loads(urllib.request.urlopen(req, timeout=10).read())

# Step 1: Spawn
print("  [1/3] Spawning test mission...", end=" ")
r = post(f"{NEXUS}/api/spawn", {"goal": "E2E test — echo hello", "project": "nexus", "priority": 99}, API_KEY)
if not r.get("ok"):
    print(f"FAIL: {r}")
    sys.exit(1)
tid = r["task_id"]
print(f"OK — task_id={tid[:8]}...")

# Step 2: Verify in Supabase
print("  [2/3] Verifying in Supabase...", end=" ")
req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_tasks?id=eq.{tid}",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
tasks = json.loads(urllib.request.urlopen(req, timeout=5).read())
if tasks and tasks[0]["status"] == "queued":
    print(f"OK — status=queued, cost_tier={tasks[0].get('cost_tier')}")
else:
    print(f"FAIL — task not found or wrong status")
    sys.exit(1)

# Step 3: Cleanup (delete test task)
print("  [3/3] Cleaning up...", end=" ")
req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_tasks?id=eq.{tid}",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "return=representation"},
    method="DELETE")
urllib.request.urlopen(req, timeout=5)
print("OK")
print("\n  ALL TESTS PASSED")
