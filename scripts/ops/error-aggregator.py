"""Script 29: Aggregate task errors by type, surface top failure patterns."""
import json, urllib.request
from collections import Counter

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

req = urllib.request.Request(
    f"{SB_URL}/rest/v1/swarm_tasks?status=eq.failed&select=error_message,project,title&order=updated_at.desc&limit=200",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
tasks = json.loads(urllib.request.urlopen(req, timeout=10).read())

if not tasks:
    print("  No failed tasks found")
    exit(0)

# Categorize errors
error_types = Counter()
by_project = Counter()
for t in tasks:
    err = t.get("error_message") or "unknown"
    # Simplify error messages
    if "timeout" in err.lower(): category = "Timeout"
    elif "permission" in err.lower(): category = "Permission denied"
    elif "not found" in err.lower(): category = "Not found"
    elif "exit code" in err.lower(): category = "Non-zero exit"
    elif "connection" in err.lower(): category = "Connection error"
    else: category = err[:60]
    error_types[category] += 1
    by_project[t.get("project") or "unknown"] += 1

print(f"\n  === ERROR ANALYSIS ({len(tasks)} failed tasks) ===\n")
print("  --- Top Error Types ---")
for err, count in error_types.most_common(10):
    bar = "#" * min(count, 40)
    print(f"    {count:4d}  {err:40s}  {bar}")

print("\n  --- Failures by Project ---")
for proj, count in by_project.most_common(10):
    print(f"    {count:4d}  {proj}")
