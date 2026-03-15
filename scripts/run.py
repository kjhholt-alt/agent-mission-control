"""Master script runner — list and run any Nexus script by name or number."""
import os, sys, subprocess, glob

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
CATEGORIES = ["testing", "scaling", "ops", "features", "dx"]

def find_scripts():
    scripts = []
    for cat in CATEGORIES:
        cat_dir = os.path.join(SCRIPTS_DIR, cat)
        if not os.path.isdir(cat_dir): continue
        for f in sorted(os.listdir(cat_dir)):
            if f.endswith((".py", ".sh", ".sql")):
                scripts.append({"name": f, "category": cat, "path": os.path.join(cat_dir, f)})
    return scripts

def list_scripts(scripts):
    print(f"\n  === NEXUS SCRIPTS ({len(scripts)} available) ===\n")
    for cat in CATEGORIES:
        cat_scripts = [s for s in scripts if s["category"] == cat]
        if not cat_scripts: continue
        print(f"  --- {cat.upper()} ---")
        for i, s in enumerate(scripts):
            if s["category"] == cat:
                print(f"  {i+1:3d}. {s['name']:40s}  [{cat}]")
        print()

def run_script(script):
    path = script["path"]
    name = script["name"]
    print(f"\n  Running: {name}")
    print(f"  {'='*60}\n")

    if name.endswith(".py"):
        subprocess.run([sys.executable, path], cwd=os.path.dirname(os.path.dirname(SCRIPTS_DIR)))
    elif name.endswith(".sh"):
        subprocess.run(["bash", path])
    elif name.endswith(".sql"):
        print(f"  SQL file — paste into Supabase SQL Editor:")
        with open(path) as f:
            print(f.read()[:500])

scripts = find_scripts()

if len(sys.argv) < 2:
    list_scripts(scripts)
    print("  Usage:")
    print("    python scripts/run.py <number>       — run by number")
    print("    python scripts/run.py <name>          — run by filename")
    print("    python scripts/run.py smoke-test      — partial name match")
    print("    python scripts/run.py all-testing     — run all in category")
    sys.exit(0)

arg = sys.argv[1]

# Run all in a category
if arg.startswith("all-"):
    cat = arg[4:]
    cat_scripts = [s for s in scripts if s["category"] == cat]
    print(f"\n  Running all {len(cat_scripts)} {cat} scripts\n")
    for s in cat_scripts:
        if s["name"].endswith(".py"):
            run_script(s)
    sys.exit(0)

# Run by number
try:
    idx = int(arg) - 1
    if 0 <= idx < len(scripts):
        run_script(scripts[idx])
        sys.exit(0)
except ValueError:
    pass

# Run by name match
matches = [s for s in scripts if arg in s["name"]]
if len(matches) == 1:
    run_script(matches[0])
elif len(matches) > 1:
    print(f"  Multiple matches for '{arg}':")
    for s in matches:
        print(f"    {s['name']}")
else:
    print(f"  No script matching '{arg}'")
