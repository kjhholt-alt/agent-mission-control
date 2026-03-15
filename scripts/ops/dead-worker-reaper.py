"""Script 27: Clean up dead workers from swarm_workers table."""
import json, urllib.request
from datetime import datetime, timedelta, timezone

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

cutoff = (datetime.now(timezone.utc) - timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%SZ")

req = urllib.request.Request(
    f"{SB_URL}/rest/v1/swarm_workers?status=eq.dead&died_at=lt.{cutoff}",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "return=representation"},
    method="DELETE")
resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
print(f"  Reaped {len(resp)} dead workers (older than 12h)")
