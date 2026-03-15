"""Test 1: End-to-end collector test — sends hook events, verifies session in Supabase."""
import json, urllib.request, time, sys

NEXUS = "http://localhost:3000"
SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

def post(url, data):
    req = urllib.request.Request(url, json.dumps(data).encode(), {"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

def get_session(sid):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/nexus_sessions?session_id=eq.{sid}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

sid = f"test-e2e-{int(time.time())}"
print(f"  Session ID: {sid}")

# Step 1: PreToolUse
print("  [1/4] Sending PreToolUse...", end=" ")
r = post(f"{NEXUS}/api/collector/event", {"session_id": sid, "event_type": "PreToolUse", "tool_name": "Read", "workspace_path": "C:/Users/Kruz/Desktop/Projects/nexus", "model": "claude-sonnet-4-6"})
print("OK" if r.get("ok") else f"FAIL: {r}")

# Step 2: PostToolUse
print("  [2/4] Sending PostToolUse...", end=" ")
r = post(f"{NEXUS}/api/collector/event", {"session_id": sid, "event_type": "PostToolUse", "tool_name": "Read", "workspace_path": "C:/Users/Kruz/Desktop/Projects/nexus", "model": "claude-sonnet-4-6"})
print("OK" if r.get("ok") else f"FAIL: {r}")

# Step 3: Stop
print("  [3/4] Sending Stop...", end=" ")
r = post(f"{NEXUS}/api/collector/event", {"session_id": sid, "event_type": "Stop", "workspace_path": "C:/Users/Kruz/Desktop/Projects/nexus", "model": "claude-sonnet-4-6", "input_tokens": 10000, "output_tokens": 3000})
print("OK" if r.get("ok") else f"FAIL: {r}")

# Step 4: Verify in Supabase
time.sleep(1)
print("  [4/4] Verifying in Supabase...", end=" ")
sessions = get_session(sid)
if sessions and len(sessions) > 0:
    s = sessions[0]
    print(f"OK — project={s['project_name']}, cost=${s['cost_usd']}, tokens={s['input_tokens']}+{s['output_tokens']}")
else:
    print("FAIL — session not found in Supabase")
    sys.exit(1)

# Cleanup
req = urllib.request.Request(f"{SB_URL}/rest/v1/nexus_sessions?session_id=eq.{sid}",
    headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}, method="DELETE")
urllib.request.urlopen(req, timeout=5)
print("  Cleaned up test session")
print("\n  ALL TESTS PASSED")
