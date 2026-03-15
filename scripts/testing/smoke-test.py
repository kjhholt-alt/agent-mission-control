"""Test 10: Quick 30-second smoke test — API up, Supabase connected, writable."""
import json, urllib.request, time, sys

NEXUS = "http://localhost:3000"
SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

checks = []

def check(name, fn):
    try:
        result = fn()
        checks.append((name, True, result))
        print(f"  PASS  {name}: {result}")
    except Exception as e:
        checks.append((name, False, str(e)))
        print(f"  FAIL  {name}: {e}")

def api_health():
    r = urllib.request.urlopen(f"{NEXUS}/api/agents", timeout=5)
    return f"HTTP {r.getcode()}"

def supabase_read():
    req = urllib.request.Request(f"{SB_URL}/rest/v1/nexus_sessions?limit=1",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    r = urllib.request.urlopen(req, timeout=5)
    return f"HTTP {r.getcode()}"

def supabase_write():
    sid = f"smoke-{int(time.time())}"
    data = json.dumps({"session_id": sid, "event_type": "PreToolUse", "tool_name": "SmokeTest"}).encode()
    req = urllib.request.Request(f"{NEXUS}/api/collector/event", data, {"Content-Type": "application/json"})
    r = json.loads(urllib.request.urlopen(req, timeout=5).read())
    # Cleanup
    req = urllib.request.Request(f"{SB_URL}/rest/v1/nexus_sessions?session_id=eq.{sid}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}, method="DELETE")
    urllib.request.urlopen(req, timeout=5)
    return "write+delete OK"

def radiant_works():
    r = json.loads(urllib.request.urlopen(f"{NEXUS}/api/radiant", timeout=10).read())
    return f"{r.get('count', 0)} quests"

def sessions_api():
    r = json.loads(urllib.request.urlopen(f"{NEXUS}/api/sessions", timeout=5).read())
    return f"{r.get('total', 0)} sessions"

print(f"\n  Smoke Test — {NEXUS}\n")
start = time.time()

check("Nexus API reachable", api_health)
check("Supabase read", supabase_read)
check("Supabase write+delete", supabase_write)
check("Radiant quests", radiant_works)
check("Sessions API", sessions_api)

elapsed = time.time() - start
passed = sum(1 for _, ok, _ in checks if ok)
total = len(checks)

print(f"\n  {passed}/{total} passed in {elapsed:.1f}s")
sys.exit(0 if passed == total else 1)
