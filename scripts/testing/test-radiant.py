"""Test 3: Hit /api/radiant, validate response schema."""
import json, urllib.request, sys

NEXUS = "http://localhost:3000"

print("  [1/2] Fetching radiant quests...", end=" ")
r = json.loads(urllib.request.urlopen(f"{NEXUS}/api/radiant", timeout=10).read())

if "quests" not in r or "count" not in r:
    print(f"FAIL — missing fields: {list(r.keys())}")
    sys.exit(1)
print(f"OK — {r['count']} quests")

print("  [2/2] Validating quest schema...", end=" ")
required_fields = {"id", "title", "description", "project", "worker_type", "priority", "category", "severity", "auto_goal"}
for q in r["quests"]:
    missing = required_fields - set(q.keys())
    if missing:
        print(f"FAIL — quest missing: {missing}")
        sys.exit(1)
    if q["category"] not in ("health", "growth", "maintenance", "opportunity"):
        print(f"FAIL — bad category: {q['category']}")
        sys.exit(1)
    if q["severity"] not in ("critical", "high", "medium", "low"):
        print(f"FAIL — bad severity: {q['severity']}")
        sys.exit(1)
print("OK — all quests valid")
print("\n  ALL TESTS PASSED")
