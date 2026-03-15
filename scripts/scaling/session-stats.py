"""Script 15: Generate cost/usage reports from nexus_sessions."""
import json, urllib.request, sys
from datetime import datetime, timedelta, timezone
from collections import defaultdict

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

req = urllib.request.Request(f"{SB_URL}/rest/v1/nexus_sessions?last_activity=gte.{cutoff}&order=last_activity.desc",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
sessions = json.loads(urllib.request.urlopen(req, timeout=10).read())

by_project = defaultdict(lambda: {"count": 0, "cost": 0, "tokens": 0, "tools": 0})
by_model = defaultdict(lambda: {"count": 0, "cost": 0})
by_day = defaultdict(lambda: {"count": 0, "cost": 0})

for s in sessions:
    proj = s.get("project_name") or "unknown"
    model = "Opus" if "opus" in (s.get("model") or "") else "Haiku" if "haiku" in (s.get("model") or "") else "Sonnet"
    day = (s.get("last_activity") or "")[:10]
    cost = float(s.get("cost_usd") or 0)
    tokens = (s.get("input_tokens") or 0) + (s.get("output_tokens") or 0)
    tools = s.get("tool_count") or 0

    by_project[proj]["count"] += 1
    by_project[proj]["cost"] += cost
    by_project[proj]["tokens"] += tokens
    by_project[proj]["tools"] += tools
    by_model[model]["count"] += 1
    by_model[model]["cost"] += cost
    by_day[day]["count"] += 1
    by_day[day]["cost"] += cost

total_cost = sum(float(s.get("cost_usd") or 0) for s in sessions)
total_tokens = sum((s.get("input_tokens") or 0) + (s.get("output_tokens") or 0) for s in sessions)

print(f"\n  === NEXUS SESSION STATS (last {days} days) ===\n")
print(f"  Total sessions: {len(sessions)}")
print(f"  Total cost:     ${total_cost:.2f}")
print(f"  Total tokens:   {total_tokens:,}")

print(f"\n  --- By Project ---")
for proj, stats in sorted(by_project.items(), key=lambda x: -x[1]["cost"]):
    print(f"    {proj:30s}  {stats['count']:3d} sessions  ${stats['cost']:7.2f}  {stats['tokens']:>10,} tokens  {stats['tools']:>5d} tools")

print(f"\n  --- By Model ---")
for model, stats in sorted(by_model.items(), key=lambda x: -x[1]["cost"]):
    print(f"    {model:10s}  {stats['count']:3d} sessions  ${stats['cost']:.2f}")

print(f"\n  --- By Day ---")
for day, stats in sorted(by_day.items()):
    bar = "#" * min(stats["count"], 50)
    print(f"    {day}  {stats['count']:3d} sessions  ${stats['cost']:6.2f}  {bar}")
