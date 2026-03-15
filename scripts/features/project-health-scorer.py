"""Script 38: Score each project 0-100 based on activity, tests, deploy, staleness."""
import os, subprocess, json
from datetime import datetime, timedelta

PROJECTS_ROOT = "C:/Users/Kruz/Desktop/Projects"
PROJECTS = ["nexus", "ai-finance-brief", "ai-chess-coach", "trade-journal",
    "buildkit-services", "pc-bottleneck-analyzer", "outdoor-crm", "BarrelHouseCRM",
    "email-finder-app", "portfolio", "mcp-servers", "n16-soccer", "MoneyPrinter"]

results = []

for proj in PROJECTS:
    path = os.path.join(PROJECTS_ROOT, proj)
    if not os.path.isdir(path):
        continue

    score = 50  # Start at 50

    # Git activity (last 7 days)
    try:
        since = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        r = subprocess.run(["git", "log", f"--since={since}", "--oneline"], cwd=path, capture_output=True, text=True, timeout=5)
        commits = len([l for l in r.stdout.strip().split("\n") if l.strip()])
        if commits >= 10: score += 20
        elif commits >= 5: score += 15
        elif commits >= 1: score += 10
        else: score -= 10
    except Exception:
        score -= 5

    # Has package.json / requirements.txt
    has_pkg = os.path.exists(os.path.join(path, "package.json")) or os.path.exists(os.path.join(path, "requirements.txt"))
    if has_pkg: score += 5

    # Has tests
    has_tests = any(os.path.exists(os.path.join(path, d)) for d in ["tests", "test", "__tests__", "src/__tests__"])
    if has_tests: score += 10
    else: score -= 5

    # Has CI/CD
    has_ci = os.path.exists(os.path.join(path, ".github", "workflows"))
    if has_ci: score += 5

    # Has README
    has_readme = os.path.exists(os.path.join(path, "README.md"))
    if has_readme: score += 5
    else: score -= 5

    # Clean working tree
    try:
        r = subprocess.run(["git", "status", "--porcelain"], cwd=path, capture_output=True, text=True, timeout=5)
        dirty = len([l for l in r.stdout.strip().split("\n") if l.strip()])
        if dirty == 0: score += 10
        elif dirty > 20: score -= 10
    except Exception:
        pass

    score = max(0, min(100, score))
    grade = "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D" if score >= 20 else "F"
    results.append((proj, score, grade))

results.sort(key=lambda x: -x[1])

print(f"\n  === PROJECT HEALTH SCORES ===\n")
for proj, score, grade in results:
    bar = "#" * (score // 5)
    color_grade = grade
    print(f"  {grade}  {score:3d}/100  {proj:30s}  {bar}")

avg = sum(s for _, s, _ in results) / len(results) if results else 0
print(f"\n  Average: {avg:.0f}/100 across {len(results)} projects")
