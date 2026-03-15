"""Script 39: Smart task router — match queued tasks to best worker type."""
import json, urllib.request

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

KEYWORDS = {
    "builder": ["build", "add", "create", "implement", "feature", "fix", "refactor", "write code"],
    "inspector": ["review", "audit", "check", "test", "validate", "verify", "inspect"],
    "miner": ["find", "prospect", "scrape", "enrich", "search", "collect", "mine"],
    "scout": ["research", "plan", "explore", "investigate", "analyze", "evaluate"],
    "deployer": ["deploy", "release", "ship", "push", "publish"],
    "messenger": ["email", "notify", "send", "message", "follow up"],
}

req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_tasks?status=eq.queued&select=id,title,description,task_type,worker_type",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
tasks = json.loads(urllib.request.urlopen(req, timeout=10).read())

if not tasks:
    print("  No queued tasks to assign")
    exit(0)

print(f"\n  Analyzing {len(tasks)} queued tasks\n")

assigned = 0
for task in tasks:
    text = f"{task.get('title', '')} {task.get('description', '')}".lower()
    best_type = None
    best_score = 0

    for worker_type, keywords in KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_type = worker_type

    if not best_type:
        best_type = "builder"  # Default

    current = task.get("worker_type") or task.get("task_type")
    if current != best_type:
        print(f"  {task['title'][:50]:50s} -> {best_type} (was: {current})")
        assigned += 1

print(f"\n  {assigned}/{len(tasks)} tasks would be reassigned")
print("  (Dry run — no changes made. Edit script to apply.)")
