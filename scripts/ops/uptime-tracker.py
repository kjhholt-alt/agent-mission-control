"""Script 28: Log current uptime status to stdout."""
import json, urllib.request, subprocess
from datetime import datetime, timezone

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

print(f"\n  === NEXUS UPTIME — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===\n")

# Check Nexus.exe
try:
    r = subprocess.run(["tasklist"], capture_output=True, text=True, timeout=5)
    nexus_running = "nexus.exe" in r.stdout.lower()
    print(f"  Nexus.exe:     {'RUNNING' if nexus_running else 'STOPPED'}")
except Exception:
    print(f"  Nexus.exe:     UNKNOWN")

# Check Vercel
try:
    urllib.request.urlopen("https://nexus.buildkit.store", timeout=10)
    print(f"  Vercel site:   UP")
except Exception:
    print(f"  Vercel site:   DOWN")

# Check Supabase
try:
    req = urllib.request.Request(f"{SB_URL}/rest/v1/nexus_sessions?limit=1",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    urllib.request.urlopen(req, timeout=5)
    print(f"  Supabase:      UP")
except Exception:
    print(f"  Supabase:      DOWN")

# Check local API
try:
    urllib.request.urlopen("http://localhost:3000/api/agents", timeout=3)
    print(f"  Local API:     UP")
except Exception:
    print(f"  Local API:     DOWN")

# Active workers
try:
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).strftime("%Y-%m-%dT%H:%M:%SZ")
    req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_workers?status=neq.dead&last_heartbeat=gte.{cutoff}&select=id",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "count=exact"})
    resp = urllib.request.urlopen(req, timeout=5)
    count = resp.headers.get("content-range", "*/0").split("/")[-1]
    print(f"  Workers:       {count} active")
except Exception:
    print(f"  Workers:       UNKNOWN")
