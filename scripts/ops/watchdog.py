"""Script 22: Standalone watchdog — monitors daemon, alerts Discord if dead."""
import json, urllib.request, time, sys, subprocess

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"
DISCORD = "https://discordapp.com/api/webhooks/1477500882529554624/Cumn_pkEtvf6NU5jOvFfVy33jJ9_ePOpSnIfm9aBRAQUr4JMZwxhqoytRIAWQM4sJ7FW"

INTERVAL = int(sys.argv[1]) if len(sys.argv) > 1 else 300  # 5 min default
last_alert = 0

def alert(msg):
    global last_alert
    if time.time() - last_alert < 600: return  # Don't spam
    try:
        data = json.dumps({"username": "NEXUS Watchdog", "embeds": [{"description": msg, "color": 0xef4444}]}).encode()
        req = urllib.request.Request(DISCORD, data, {"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5)
        last_alert = time.time()
    except Exception:
        pass

def check_workers():
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_workers?status=neq.dead&last_heartbeat=gte.{cutoff}&select=id",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "count=exact"})
    resp = urllib.request.urlopen(req, timeout=5)
    count = resp.headers.get("content-range", "*/0").split("/")[-1]
    return int(count) if count != "*" else 0

def check_queue():
    req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_tasks?status=eq.queued&select=id",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "count=exact"})
    resp = urllib.request.urlopen(req, timeout=5)
    count = resp.headers.get("content-range", "*/0").split("/")[-1]
    return int(count) if count != "*" else 0

print(f"  Watchdog started (checking every {INTERVAL}s)")
print("  Press Ctrl+C to stop\n")

try:
    while True:
        try:
            workers = check_workers()
            queued = check_queue()
            status = f"workers={workers} queued={queued}"
            print(f"  [{time.strftime('%H:%M:%S')}] {status}")

            if workers == 0 and queued > 0:
                alert(f"**NEXUS WATCHDOG:** 0 workers active but {queued} tasks queued! Daemon may be dead.")
            elif queued > 50:
                alert(f"**NEXUS WATCHDOG:** Queue backlog: {queued} tasks waiting")
        except Exception as e:
            print(f"  [{time.strftime('%H:%M:%S')}] Error: {e}")

        time.sleep(INTERVAL)
except KeyboardInterrupt:
    print("\n  Watchdog stopped")
