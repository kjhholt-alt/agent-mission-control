"""Script 26: Find tasks stuck in 'running' >1hr, reset to 'queued'."""
import json, urllib.request
from datetime import datetime, timedelta, timezone

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

# Find stuck tasks
req = urllib.request.Request(
    f"{SB_URL}/rest/v1/swarm_tasks?status=eq.running&updated_at=lt.{cutoff}",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
stuck = json.loads(urllib.request.urlopen(req, timeout=10).read())

if not stuck:
    print("  No stuck tasks found")
else:
    print(f"  Found {len(stuck)} stuck tasks")
    for task in stuck:
        tid = task["id"]
        print(f"    Resetting: {task['title'][:60]} (stuck since {task.get('updated_at', '?')[:16]})")
        data = json.dumps({"status": "queued", "assigned_worker_id": None, "updated_at": datetime.now(timezone.utc).isoformat()}).encode()
        req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_tasks?id=eq.{tid}",
            data=data, headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}, method="PATCH")
        urllib.request.urlopen(req, timeout=5)
    print(f"  Reset {len(stuck)} tasks to queued")
