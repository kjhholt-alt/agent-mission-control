"""Script 37: Predict this month's API spend based on daily trends."""
import json, urllib.request
from datetime import datetime, timedelta, timezone
from collections import defaultdict

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

# Get all sessions this month
now = datetime.now(timezone.utc)
month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")

req = urllib.request.Request(
    f"{SB_URL}/rest/v1/nexus_sessions?last_activity=gte.{month_start}&select=cost_usd,last_activity",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
sessions = json.loads(urllib.request.urlopen(req, timeout=10).read())

# Group by day
daily_cost = defaultdict(float)
for s in sessions:
    day = (s.get("last_activity") or "")[:10]
    daily_cost[day] += float(s.get("cost_usd") or 0)

days_elapsed = now.day
days_in_month = 31  # Approximate
days_remaining = days_in_month - days_elapsed

spent_so_far = sum(daily_cost.values())
daily_avg = spent_so_far / max(days_elapsed, 1)
forecast = spent_so_far + (daily_avg * days_remaining)

print(f"\n  === COST FORECAST — {now.strftime('%B %Y')} ===\n")
print(f"  Days elapsed:     {days_elapsed}")
print(f"  Spent so far:     ${spent_so_far:.2f}")
print(f"  Daily average:    ${daily_avg:.2f}")
print(f"  Days remaining:   {days_remaining}")
print(f"  Month forecast:   ${forecast:.2f}")

if daily_cost:
    print(f"\n  --- Daily Breakdown ---")
    for day in sorted(daily_cost.keys()):
        bar = "#" * int(daily_cost[day] * 10)
        print(f"    {day}  ${daily_cost[day]:6.2f}  {bar}")

if forecast > 50:
    print(f"\n  WARNING: Projected spend exceeds $50!")
elif forecast > 20:
    print(f"\n  NOTE: Projected spend above $20")
