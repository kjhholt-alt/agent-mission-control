"""Script 23: Generate daily summary and post to Discord."""
import json, urllib.request
from datetime import datetime, timedelta, timezone

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"
DISCORD = "https://discordapp.com/api/webhooks/1477500882529554624/Cumn_pkEtvf6NU5jOvFfVy33jJ9_ePOpSnIfm9aBRAQUr4JMZwxhqoytRIAWQM4sJ7FW"

def sb_get(path):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{path}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    return json.loads(urllib.request.urlopen(req, timeout=10).read())

today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

# Gather stats
sessions = sb_get(f"nexus_sessions?last_activity=gte.{yesterday}T00:00:00Z&last_activity=lt.{today}T23:59:59Z")
tasks = sb_get(f"swarm_tasks?updated_at=gte.{yesterday}T00:00:00Z")

total_sessions = len(sessions)
total_cost = sum(float(s.get("cost_usd") or 0) for s in sessions)
total_tokens = sum((s.get("input_tokens") or 0) + (s.get("output_tokens") or 0) for s in sessions)
total_tools = sum(s.get("tool_count") or 0 for s in sessions)
completed_tasks = sum(1 for t in tasks if t["status"] == "completed")
failed_tasks = sum(1 for t in tasks if t["status"] == "failed")
queued_tasks = sum(1 for t in tasks if t["status"] == "queued")

projects = set(s.get("project_name") for s in sessions if s.get("project_name"))

digest = f"""**NEXUS Daily Digest** — {today}

**Sessions:** {total_sessions}
**Cost:** ${total_cost:.2f}
**Tokens:** {total_tokens:,}
**Tool Calls:** {total_tools:,}

**Tasks:** {completed_tasks} completed, {failed_tasks} failed, {queued_tasks} queued
**Projects Active:** {', '.join(sorted(projects)) if projects else 'none'}"""

print(digest)

# Post to Discord
data = json.dumps({
    "username": "NEXUS Daily Digest",
    "embeds": [{
        "title": f"Daily Digest — {today}",
        "description": digest,
        "color": 0x06b6d4,
        "footer": {"text": "NEXUS"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }]
}).encode()

req = urllib.request.Request(DISCORD, data, {"Content-Type": "application/json"})
urllib.request.urlopen(req, timeout=10)
print("\n  Posted to Discord")
