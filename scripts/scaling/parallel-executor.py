"""Script 16: Run N executors in parallel for faster queue drain."""
import subprocess, sys, os, time, signal

N = int(sys.argv[1]) if len(sys.argv) > 1 else 3
EXECUTOR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "executor.py")

print(f"\n  Starting {N} parallel executors\n")

procs = []
for i in range(N):
    p = subprocess.Popen(
        [sys.executable, EXECUTOR, "--loop", "--interval", "20"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace"
    )
    procs.append(p)
    print(f"  Executor {i+1} started (PID {p.pid})")

def cleanup(sig=None, frame=None):
    print(f"\n  Stopping {len(procs)} executors...")
    for p in procs:
        p.terminate()
    for p in procs:
        p.wait(timeout=10)
    print("  All executors stopped")
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

print(f"\n  All {N} executors running. Press Ctrl+C to stop.\n")

# Monitor loop
try:
    while True:
        alive = sum(1 for p in procs if p.poll() is None)
        if alive == 0:
            print("  All executors exited")
            break
        time.sleep(10)
except KeyboardInterrupt:
    cleanup()
