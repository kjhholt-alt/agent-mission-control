"""Test 5: Hit every API route, report pass/fail."""
import urllib.request, json, sys

NEXUS = "http://localhost:3000"
API_KEY = "nexus-hive-2026"

ROUTES = [
    ("GET",  "/api/agents",            None),
    ("GET",  "/api/sessions",          None),
    ("GET",  "/api/collector/agents",  None),
    ("GET",  "/api/deploy",            None),
    ("GET",  "/api/radiant",           None),
    ("GET",  "/api/oracle",            None),
    ("POST", "/api/collector/event",   {"session_id": "route-test", "event_type": "PreToolUse"}),
    ("POST", "/api/heartbeat",         {"agent_id": "route-test", "agent_name": "Test", "project": "nexus", "status": "running"}),
    ("POST", "/api/spawn",             {"goal": "route test", "project": "nexus"}),
    ("POST", "/api/webhook",           {"goal": "route test webhook", "project": "nexus"}),
]

passed = 0
failed = 0

print(f"\n  Testing {len(ROUTES)} API routes against {NEXUS}\n")

for method, path, body in ROUTES:
    try:
        headers = {"Content-Type": "application/json"}
        if method == "POST" and path in ["/api/spawn", "/api/webhook"]:
            headers["x-nexus-key"] = API_KEY

        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(f"{NEXUS}{path}", data=data, headers=headers, method=method)
        resp = urllib.request.urlopen(req, timeout=10)
        code = resp.getcode()
        result = json.loads(resp.read())

        if code == 200:
            print(f"  PASS  {method:4s} {path}")
            passed += 1
        else:
            print(f"  FAIL  {method:4s} {path} — HTTP {code}")
            failed += 1
    except Exception as e:
        print(f"  FAIL  {method:4s} {path} — {e}")
        failed += 1

print(f"\n  Results: {passed} passed, {failed} failed out of {len(ROUTES)}")
sys.exit(0 if failed == 0 else 1)
