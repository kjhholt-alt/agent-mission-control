"""Script 31: Scan all project dirs, detect issues, feed suggestions to radiant."""
import os, json, subprocess, urllib.request

PROJECTS_ROOT = "C:/Users/Kruz/Desktop/Projects"
SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

SCAN_PROJECTS = ["nexus", "ai-finance-brief", "ai-chess-coach", "trade-journal",
    "buildkit-services", "pc-bottleneck-analyzer", "outdoor-crm", "BarrelHouseCRM",
    "email-finder-app", "portfolio", "mcp-servers", "n16-soccer"]

findings = []

for proj in SCAN_PROJECTS:
    path = os.path.join(PROJECTS_ROOT, proj)
    if not os.path.isdir(path):
        continue

    issues = []

    # Check for package.json and outdated deps
    pkg_json = os.path.join(path, "package.json")
    if os.path.exists(pkg_json):
        with open(pkg_json) as f:
            pkg = json.load(f)
        deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
        if "next" in deps and deps["next"].replace("^","").replace("~","") < "15":
            issues.append("Next.js below v15 — consider upgrading")

    # Check for .env without .env.example
    if os.path.exists(os.path.join(path, ".env")) and not os.path.exists(os.path.join(path, ".env.example")):
        issues.append("Has .env but no .env.example")

    # Check git status for uncommitted changes
    try:
        r = subprocess.run(["git", "status", "--porcelain"], cwd=path, capture_output=True, text=True, timeout=5)
        dirty = len(r.stdout.strip().split("\n")) if r.stdout.strip() else 0
        if dirty > 10:
            issues.append(f"{dirty} uncommitted files")
    except Exception:
        pass

    # Check for TODO/FIXME in source
    try:
        r = subprocess.run(["git", "grep", "-c", "TODO\\|FIXME", "--", "*.ts", "*.tsx", "*.py"],
            cwd=path, capture_output=True, text=True, timeout=10)
        if r.stdout.strip():
            todo_count = sum(int(line.split(":")[-1]) for line in r.stdout.strip().split("\n") if ":" in line)
            if todo_count > 5:
                issues.append(f"{todo_count} TODO/FIXME comments")
    except Exception:
        pass

    # Check if tests exist
    has_tests = any(os.path.exists(os.path.join(path, d)) for d in ["tests", "test", "__tests__", "src/__tests__"])
    if not has_tests and os.path.exists(pkg_json):
        issues.append("No test directory found")

    if issues:
        findings.append({"project": proj, "issues": issues})
        print(f"\n  {proj}:")
        for issue in issues:
            print(f"    - {issue}")

if not findings:
    print("\n  All projects look healthy!")
else:
    print(f"\n  Found issues in {len(findings)}/{len(SCAN_PROJECTS)} projects")
