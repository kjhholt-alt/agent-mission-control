"""Test 4: Send test notification to Discord, verify 200."""
import json, urllib.request, sys

NEXUS = "http://localhost:3000"
API_KEY = "nexus-hive-2026"

print("  Sending test Discord notification...", end=" ")
data = json.dumps({"type": "session_summary", "data": {"project": "nexus", "model": "Test", "tools": "0", "cost": "0.00"}}).encode()
req = urllib.request.Request(f"{NEXUS}/api/discord/notify", data,
    {"Content-Type": "application/json", "x-nexus-key": API_KEY})
try:
    r = json.loads(urllib.request.urlopen(req, timeout=10).read())
    if r.get("ok"):
        print("OK — notification sent")
    else:
        print(f"FAIL — {r}")
        sys.exit(1)
except Exception as e:
    print(f"FAIL — {e}")
    sys.exit(1)
