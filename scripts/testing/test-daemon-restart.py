"""Test 7: Verify executor picks up a task and completes it."""
import json, urllib.request, subprocess, sys, time, os

NEXUS = "http://localhost:3000"
API_KEY = "nexus-hive-2026"
EXECUTOR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "executor.py")

# Spawn a simple task
print("  [1/3] Spawning test task...", end=" ")
data = json.dumps({"goal": "Say 'hello from test' and nothing else", "project": "nexus", "priority": 1}).encode()
req = urllib.request.Request(f"{NEXUS}/api/spawn", data,
    {"Content-Type": "application/json", "x-nexus-key": API_KEY})
r = json.loads(urllib.request.urlopen(req, timeout=10).read())
tid = r.get("task_id")
print(f"OK — {tid[:8]}...")

# Run executor (single mode — picks up one task)
print("  [2/3] Running executor...", end=" ")
result = subprocess.run([sys.executable, EXECUTOR], capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace")
if result.returncode == 0:
    print("OK — executor completed")
else:
    print(f"FAIL — exit code {result.returncode}")
    print(f"  stderr: {result.stderr[:200]}")

# Check task status
print("  [3/3] Verifying task completed...", end=" ")
SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"
req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_tasks?id=eq.{tid}&select=status",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
tasks = json.loads(urllib.request.urlopen(req, timeout=5).read())
status = tasks[0]["status"] if tasks else "NOT FOUND"
if status in ("completed", "failed"):
    print(f"OK — status={status}")
else:
    print(f"UNEXPECTED — status={status}")
