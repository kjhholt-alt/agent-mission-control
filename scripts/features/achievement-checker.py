"""Script 36: Server-side achievement check from Supabase data."""
import json, urllib.request

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

def sb_get(path):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{path}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "count=exact"})
    resp = urllib.request.urlopen(req, timeout=10)
    count = resp.headers.get("content-range", "*/0").split("/")[-1]
    data = json.loads(resp.read())
    return data, int(count) if count != "*" else len(data)

sessions, session_count = sb_get("nexus_sessions?select=cost_usd,input_tokens,output_tokens,tool_count,project_name")
tasks, task_count = sb_get("swarm_tasks?select=status")

total_cost = sum(float(s.get("cost_usd") or 0) for s in sessions)
total_tokens = sum((s.get("input_tokens") or 0) + (s.get("output_tokens") or 0) for s in sessions)
total_tools = sum(s.get("tool_count") or 0 for s in sessions)
projects = len(set(s.get("project_name") for s in sessions if s.get("project_name")))
completed = sum(1 for t in tasks if t["status"] == "completed")

ACHIEVEMENTS = [
    ("First Contact", "Spawn 1 mission", task_count >= 1),
    ("Mission Commander", "Spawn 10 missions", task_count >= 10),
    ("Fleet Admiral", "Spawn 50 missions", task_count >= 50),
    ("Online", "Record 1 session", session_count >= 1),
    ("Marathon Runner", "Complete 25 sessions", session_count >= 25),
    ("Tool Time", "100 tool calls", total_tools >= 100),
    ("Power User", "1,000 tool calls", total_tools >= 1000),
    ("Investor", "Spend $10", total_cost >= 10),
    ("High Roller", "Spend $100", total_cost >= 100),
    ("Multi-Tasker", "3+ projects", projects >= 3),
    ("Portfolio Manager", "5+ projects", projects >= 5),
    ("Million Token Club", "1M tokens", total_tokens >= 1_000_000),
]

print(f"\n  === ACHIEVEMENT STATUS ===\n")
print(f"  Sessions: {session_count} | Tasks: {task_count} | Cost: ${total_cost:.2f}")
print(f"  Tokens: {total_tokens:,} | Tools: {total_tools:,} | Projects: {projects}\n")

unlocked = 0
for name, desc, achieved in ACHIEVEMENTS:
    icon = "UNLOCKED" if achieved else "locked"
    print(f"  {'[x]' if achieved else '[ ]'}  {name:25s}  {desc}")
    if achieved: unlocked += 1

print(f"\n  {unlocked}/{len(ACHIEVEMENTS)} achievements unlocked")
