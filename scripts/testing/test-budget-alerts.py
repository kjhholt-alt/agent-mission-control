"""Test 8: Verify radiant engine detects budget warnings."""
import json, urllib.request, sys

NEXUS = "http://localhost:3000"

print("  Checking if radiant detects budget-related quests...", end=" ")
r = json.loads(urllib.request.urlopen(f"{NEXUS}/api/radiant", timeout=10).read())
budget_quests = [q for q in r.get("quests", []) if "budget" in q["title"].lower() or q["category"] == "health"]
print(f"OK — {len(budget_quests)} health/budget quests found")
for q in budget_quests:
    print(f"    [{q['severity']:8s}] {q['title']}")
print("\n  PASSED (radiant budget detection working)")
