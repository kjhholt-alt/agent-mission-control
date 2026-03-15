"""Script 44: Live tail daemon stdout/stderr with color formatting."""
import subprocess, sys, os, signal

EXECUTOR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "executor.py")

print("\n  === NEXUS DAEMON TAIL ===")
print("  Press Ctrl+C to stop\n")

try:
    proc = subprocess.Popen(
        [sys.executable, EXECUTOR, "--loop", "--interval", "15"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace",
        bufsize=1
    )

    for line in proc.stdout:
        line = line.rstrip()
        if "COMPLETED" in line or "OK" in line:
            print(f"  \033[32m{line}\033[0m")  # Green
        elif "FAILED" in line or "ERROR" in line or "TIMED OUT" in line:
            print(f"  \033[31m{line}\033[0m")  # Red
        elif "EXECUTING" in line:
            print(f"  \033[36m{line}\033[0m")  # Cyan
        elif line.strip() == ".":
            print(".", end="", flush=True)
        else:
            print(f"  {line}")

except KeyboardInterrupt:
    print("\n\n  Tail stopped")
    if proc.poll() is None:
        proc.terminate()
