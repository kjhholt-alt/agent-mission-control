"""Script 11: Purge nexus_sessions older than N days (default 30)."""
import json, urllib.request, sys
from datetime import datetime, timedelta, timezone

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

days = int(sys.argv[1]) if len(sys.argv) > 1 else 30
cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

print(f"  Deleting nexus_sessions older than {days} days (before {cutoff[:10]})")

req = urllib.request.Request(
    f"{SB_URL}/rest/v1/nexus_sessions?last_activity=lt.{cutoff}",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Prefer": "return=representation"},
    method="DELETE")
resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
print(f"  Deleted {len(resp)} old sessions")
