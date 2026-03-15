"""Script 24: Generate weekly report and post to Discord."""
import json, urllib.request
from datetime import datetime, timedelta, timezone
from collections import defaultdict

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"
DISCORD = "https://discordapp.com/api/webhooks/1477500882529554624/Cumn_pkEtvf6NU5jOvFfVy33jJ9_ePOpSnIfm9aBRAQUr4JMZwxhqoytRIAWQM4sJ7FW"

now = datetime.now(timezone.utc)
week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")

def sb_get(path):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{path}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    return json.loads(urllib.request.urlopen(req, timeout=10).read())

sessions = sb_get(f"nexus_sessions?last_activity=gte.{week_ago}")
tasks = sb_get(f"swarm_tasks?updated_at=gte.{week_ago}")

cost = sum(float(s.get("cost_usd") or 0) for s in sessions)
tokens = sum((s.get("input_tokens") or 0) + (s.get("output_tokens") or 0) for s in sessions)
completed = sum(1 for t in tasks if t["status"] == "completed")
failed = sum(1 for t in tasks if t["status"] == "failed")
projects = set(s.get("project_name") for s in sessions if s.get("project_name"))

report = f"""**Weekly Sessions:** {len(sessions)}
**Weekly Cost:** ${cost:.2f}
**Tokens Processed:** {tokens:,}
**Tasks Completed:** {completed}
**Tasks Failed:** {failed}
**Active Projects:** {len(projects)}
**Projects:** {', '.join(sorted(projects)) if projects else 'none'}"""

print(f"\n  === NEXUS WEEKLY REPORT ===\n")
print(report)

# Post to Discord
data = json.dumps({"username": "NEXUS Weekly", "embeds": [{
    "title": f"Weekly Report — {now.strftime('%b %d')}",
    "description": report, "color": 0x8b5cf6,
    "footer": {"text": "NEXUS"},
    "timestamp": now.isoformat(),
}]}).encode()
req = urllib.request.Request(DISCORD, data, {"Content-Type": "application/json"})
urllib.request.urlopen(req, timeout=10)
print("\n  Posted to Discord")
