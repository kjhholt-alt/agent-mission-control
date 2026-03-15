"""Script 42: Populate Supabase with realistic demo data."""
import json, urllib.request, time, random
from datetime import datetime, timedelta, timezone

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

def sb_post(table, data):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{table}",
        json.dumps(data).encode(),
        {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json", "Prefer": "return=representation"})
    return json.loads(urllib.request.urlopen(req, timeout=10).read())

PROJECTS = ["nexus", "ai-finance-brief", "buildkit-services", "pc-bottleneck-analyzer", "outdoor-crm"]
MODELS = ["claude-opus-4-6", "claude-sonnet-4-6", "claude-sonnet-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]
TOOLS = ["Read", "Edit", "Write", "Bash", "Grep", "Glob", "Agent"]

now = datetime.now(timezone.utc)

# Seed 20 sessions over the past 3 days
print("  Seeding 20 demo sessions...")
for i in range(20):
    hours_ago = random.randint(1, 72)
    started = now - timedelta(hours=hours_ago)
    duration_min = random.randint(2, 45)
    ended = started + timedelta(minutes=duration_min)
    model = random.choice(MODELS)
    proj = random.choice(PROJECTS)
    input_tok = random.randint(5000, 200000)
    output_tok = random.randint(1000, 50000)
    tools = random.randint(5, 150)

    # Calculate cost based on model
    if "opus" in model:
        cost = (input_tok / 1e6 * 15) + (output_tok / 1e6 * 75)
    elif "haiku" in model:
        cost = (input_tok / 1e6 * 0.8) + (output_tok / 1e6 * 4)
    else:
        cost = (input_tok / 1e6 * 3) + (output_tok / 1e6 * 15)

    sb_post("nexus_sessions", {
        "session_id": f"demo-{i}-{int(time.time())}",
        "project_name": proj,
        "workspace_path": f"C:/Users/Kruz/Desktop/Projects/{proj}",
        "model": model,
        "status": "completed",
        "started_at": started.isoformat(),
        "last_activity": ended.isoformat(),
        "completed_at": ended.isoformat(),
        "tool_count": tools,
        "input_tokens": input_tok,
        "output_tokens": output_tok,
        "cost_usd": round(cost, 4),
    })

print("  Seeding 10 demo hook events...")
for i in range(10):
    sb_post("nexus_hook_events", {
        "session_id": f"demo-0-{int(time.time())}",
        "event_type": random.choice(["PreToolUse", "PostToolUse"]),
        "tool_name": random.choice(TOOLS),
        "project_name": random.choice(PROJECTS),
        "model": random.choice(MODELS),
    })

print(f"\n  Seeded 20 sessions + 10 events")
print("  View at: http://localhost:3000/sessions")
