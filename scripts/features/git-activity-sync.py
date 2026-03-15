"""Script 32: Pull recent git commits per project, print activity summary."""
import os, subprocess, json
from datetime import datetime, timedelta

PROJECTS_ROOT = "C:/Users/Kruz/Desktop/Projects"
PROJECTS = ["nexus", "ai-finance-brief", "buildkit-services", "pc-bottleneck-analyzer",
    "outdoor-crm", "BarrelHouseCRM", "MoneyPrinter", "email-finder-app", "mcp-servers"]

days = 7
since = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

print(f"\n  === GIT ACTIVITY (last {days} days) ===\n")

total_commits = 0
for proj in PROJECTS:
    path = os.path.join(PROJECTS_ROOT, proj)
    if not os.path.isdir(os.path.join(path, ".git")):
        continue

    try:
        r = subprocess.run(
            ["git", "log", f"--since={since}", "--oneline", "--no-merges"],
            cwd=path, capture_output=True, text=True, timeout=10
        )
        commits = [l for l in r.stdout.strip().split("\n") if l.strip()]
        if commits:
            print(f"  {proj} ({len(commits)} commits)")
            for c in commits[:5]:
                print(f"    {c[:80]}")
            if len(commits) > 5:
                print(f"    ... and {len(commits) - 5} more")
            total_commits += len(commits)
        else:
            print(f"  {proj} (no commits)")
    except Exception as e:
        print(f"  {proj} (error: {e})")

print(f"\n  Total: {total_commits} commits across {len(PROJECTS)} projects")
