"""Script 21: Full system health check — Supabase, Vercel, daemon, Discord."""
import json, urllib.request, sys, time

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

checks = []

def check(name, fn):
    start = time.time()
    try:
        result = fn()
        ms = int((time.time() - start) * 1000)
        checks.append((name, "PASS", f"{result} ({ms}ms)"))
        print(f"  PASS  {name:35s} {result} ({ms}ms)")
    except Exception as e:
        ms = int((time.time() - start) * 1000)
        checks.append((name, "FAIL", str(e)))
        print(f"  FAIL  {name:35s} {e} ({ms}ms)")

def sb_read():
    req = urllib.request.Request(f"{SB_URL}/rest/v1/nexus_sessions?limit=1",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    urllib.request.urlopen(req, timeout=5)
    return "readable"

def sb_tasks():
    req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_tasks?limit=1&select=status",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    urllib.request.urlopen(req, timeout=5)
    return "readable"

def vercel_site():
    r = urllib.request.urlopen("https://nexus.buildkit.store", timeout=10)
    return f"HTTP {r.getcode()}"

def local_api():
    r = urllib.request.urlopen("http://localhost:3000/api/agents", timeout=5)
    return f"HTTP {r.getcode()}"

def discord_webhook():
    url = "https://discordapp.com/api/webhooks/1477500882529554624/Cumn_pkEtvf6NU5jOvFfVy33jJ9_ePOpSnIfm9aBRAQUr4JMZwxhqoytRIAWQM4sJ7FW"
    # Just check if the webhook URL responds (GET returns webhook info)
    r = urllib.request.urlopen(url, timeout=5)
    return f"HTTP {r.getcode()}"

def task_queue():
    req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_tasks?status=eq.queued&select=id",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "count=exact"})
    resp = urllib.request.urlopen(req, timeout=5)
    count = resp.headers.get("content-range", "").split("/")[-1]
    return f"{count} queued"

def active_workers():
    req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_workers?status=neq.dead&select=id",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "count=exact"})
    resp = urllib.request.urlopen(req, timeout=5)
    count = resp.headers.get("content-range", "").split("/")[-1]
    return f"{count} active"

print("\n  === NEXUS HEALTH CHECK ===\n")

check("Supabase (sessions)", sb_read)
check("Supabase (tasks)", sb_tasks)
check("Vercel (nexus.buildkit.store)", vercel_site)
check("Local API (localhost:3000)", local_api)
check("Discord webhook", discord_webhook)
check("Task queue depth", task_queue)
check("Active workers", active_workers)

passed = sum(1 for _, s, _ in checks if s == "PASS")
print(f"\n  {passed}/{len(checks)} healthy")
sys.exit(0 if passed == len(checks) else 1)
