"""Script 30: Check disk usage of key directories."""
import os, sys

DIRS = {
    "src-tauri/target": "Rust build artifacts",
    ".next": "Next.js build cache",
    "node_modules": "Node dependencies",
    "swarm": "Python swarm code",
    "src": "Frontend source",
    "scripts": "Scripts",
}

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def dir_size(path):
    total = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try: total += os.path.getsize(fp)
            except OSError: pass
    return total

print(f"\n  === DISK USAGE ===\n")
total = 0
for dirname, desc in sorted(DIRS.items()):
    path = os.path.join(ROOT, dirname)
    if os.path.isdir(path):
        size = dir_size(path)
        total += size
        gb = size / (1024**3)
        mb = size / (1024**2)
        if gb >= 1:
            print(f"  {gb:6.1f} GB  {dirname:25s}  {desc}")
        else:
            print(f"  {mb:6.0f} MB  {dirname:25s}  {desc}")
    else:
        print(f"  {'---':>6s}     {dirname:25s}  (not found)")

print(f"\n  Total: {total / (1024**3):.1f} GB")
if total > 5 * 1024**3:
    print("  WARNING: Over 5GB — consider running: cargo clean")
