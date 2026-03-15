"""Script 25: Kill executor if daily API spend exceeds threshold."""
import json, urllib.request, sys
from datetime import datetime, timezone

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

DAILY_LIMIT = float(sys.argv[1]) if len(sys.argv) > 1 else 10.0  # $10 default

today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

req = urllib.request.Request(
    f"{SB_URL}/rest/v1/nexus_sessions?last_activity=gte.{today}T00:00:00Z&select=cost_usd",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
sessions = json.loads(urllib.request.urlopen(req, timeout=10).read())

total = sum(float(s.get("cost_usd") or 0) for s in sessions)
pct = (total / DAILY_LIMIT) * 100

print(f"\n  Daily Budget: ${DAILY_LIMIT:.2f}")
print(f"  Spent today:  ${total:.2f} ({pct:.0f}%)")

if total >= DAILY_LIMIT:
    print(f"\n  BUDGET EXCEEDED — pausing queued tasks")
    # Pause all queued tasks
    data = json.dumps({"status": "blocked"}).encode()
    req = urllib.request.Request(f"{SB_URL}/rest/v1/swarm_tasks?status=eq.queued",
        data=data, headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json"}, method="PATCH")
    urllib.request.urlopen(req, timeout=10)
    print("  All queued tasks moved to blocked")
elif pct >= 80:
    print(f"\n  WARNING: Approaching budget limit ({pct:.0f}%)")
else:
    print(f"\n  OK — within budget")
