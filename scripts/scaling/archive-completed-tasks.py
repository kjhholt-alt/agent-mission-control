"""Script 13: Count completed tasks older than N days (cleanup candidate)."""
import json, urllib.request, sys
from datetime import datetime, timedelta, timezone

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

days = int(sys.argv[1]) if len(sys.argv) > 1 else 14
cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
action = "--delete" in sys.argv

req = urllib.request.Request(
    f"{SB_URL}/rest/v1/swarm_tasks?status=eq.completed&updated_at=lt.{cutoff}&select=id",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "count=exact"})
resp = urllib.request.urlopen(req, timeout=10)
count = resp.headers.get("content-range", "*/0").split("/")[-1]

print(f"  Completed tasks older than {days} days: {count}")

if action and int(count) > 0:
    print(f"  Deleting...")
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/swarm_tasks?status=eq.completed&updated_at=lt.{cutoff}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "return=representation"},
        method="DELETE")
    resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
    print(f"  Deleted {len(resp)} tasks")
elif not action and int(count) > 0:
    print(f"  Run with --delete to remove them")
