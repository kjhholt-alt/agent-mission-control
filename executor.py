"""
Nexus Executor — picks up queued tasks and runs them via Claude Code CLI.

Usage:
    python executor.py              # Run one task and exit
    python executor.py --loop       # Poll continuously (daemon mode)
    python executor.py --loop --interval 30   # Poll every 30 seconds

This is the bridge between the Nexus dashboard and actual work.
When you click "New Mission" on the dashboard, the task goes into swarm_tasks.
This script picks it up and runs it.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://ytvtaorgityczrdhhzqv.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk",
)
NEXUS_URL = os.environ.get("NEXUS_URL", "http://localhost:3000")
DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", "")
CLAUDE_CLI = os.environ.get("CLAUDE_CLI_PATH", "C:/nvm4w/nodejs/claude.cmd")
PROJECTS_ROOT = "C:/Users/Kruz/Desktop/Projects"
TASK_TIMEOUT = 600  # 10 minutes max per task

# Project → directory mapping
PROJECT_DIRS = {
    "nexus": f"{PROJECTS_ROOT}/nexus",
    "MoneyPrinter": f"{PROJECTS_ROOT}/MoneyPrinter",
    "ai-finance-brief": f"{PROJECTS_ROOT}/ai-finance-brief",
    "ai-chess-coach": f"{PROJECTS_ROOT}/ai-chess-coach",
    "trade-journal": f"{PROJECTS_ROOT}/trade-journal",
    "buildkit-services": f"{PROJECTS_ROOT}/buildkit-services",
    "pc-bottleneck-analyzer": f"{PROJECTS_ROOT}/pc-bottleneck-analyzer",
    "outdoor-crm": f"{PROJECTS_ROOT}/outdoor-crm",
    "BarrelHouseCRM": f"{PROJECTS_ROOT}/BarrelHouseCRM",
    "email-finder-app": f"{PROJECTS_ROOT}/email-finder-app",
    "admin-dashboard": f"{PROJECTS_ROOT}/admin-dashboard",
    "n16-soccer": f"{PROJECTS_ROOT}/n16-soccer",
    "portfolio": f"{PROJECTS_ROOT}/portfolio",
    "mcp-servers": f"{PROJECTS_ROOT}/mcp-servers",
    "lead-tracker": f"{PROJECTS_ROOT}/lead-tracker",
    "wavefront": f"{PROJECTS_ROOT}/wavefront",
    "stock-breakout-alerts": f"{PROJECTS_ROOT}/stock-breakout-alerts",
    "municipal-crm": f"{PROJECTS_ROOT}/municipal-crm",
}


# ── Supabase helpers ──────────────────────────────────────────────────

def supabase_request(method, path, data=None):
    """Make a request to Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else str(e)
        print(f"  Supabase error {e.code}: {err_body}")
        return None
    except Exception as e:
        print(f"  Supabase request failed: {e}")
        return None


def fetch_next_task():
    """Get the highest-priority queued task."""
    result = supabase_request(
        "GET",
        "swarm_tasks?status=eq.queued&order=priority.asc&limit=1"
    )
    if result and len(result) > 0:
        return result[0]
    return None


def update_task(task_id, updates):
    """Update a task in Supabase."""
    supabase_request("PATCH", f"swarm_tasks?id=eq.{task_id}", updates)


def log_task_event(task_id, event_type, title, project="", details=""):
    """Log an event to swarm_task_log."""
    supabase_request("POST", "swarm_task_log", {
        "task_id": task_id,
        "event": event_type,
        "details": f"[{project}] {title}" + (f"\n{details}" if details else ""),
    })


def send_heartbeat(agent_name, project, status, step, steps_done=0, total=1, output=None):
    """Send heartbeat to Nexus dashboard."""
    try:
        data = json.dumps({
            "agent_id": f"executor-{os.getpid()}",
            "agent_name": agent_name,
            "project": project,
            "status": status,
            "current_step": step,
            "steps_completed": steps_done,
            "total_steps": total,
            "output": output,
        }).encode()

        req = urllib.request.Request(
            f"{NEXUS_URL}/api/heartbeat",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=3)
    except Exception:
        pass  # Non-critical


def notify_discord(message, color=0x06b6d4):
    """Send a notification to Discord."""
    if not DISCORD_WEBHOOK:
        return
    try:
        data = json.dumps({
            "username": "NEXUS Executor",
            "embeds": [{
                "description": message,
                "color": color,
                "footer": {"text": "NEXUS Executor"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }],
        }).encode()
        req = urllib.request.Request(
            DISCORD_WEBHOOK,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass


# ── Task execution ────────────────────────────────────────────────────

def execute_task(task):
    """Execute a single task via Claude Code CLI."""
    task_id = task["id"]
    title = task.get("title", "Untitled")
    project = task.get("project", "general")
    prompt = task.get("description") or task.get("title", "")

    # Resolve working directory
    cwd = PROJECT_DIRS.get(project, PROJECTS_ROOT)
    if not os.path.isdir(cwd):
        cwd = PROJECTS_ROOT

    print(f"\n{'='*60}")
    print(f"  EXECUTING: {title}")
    print(f"  Project:   {project}")
    print(f"  Directory: {cwd}")
    print(f"  Task ID:   {task_id[:8]}...")
    print(f"{'='*60}\n")

    # Mark task as running
    now = datetime.now(timezone.utc).isoformat()
    update_task(task_id, {
        "status": "running",
        "started_at": now,
        "updated_at": now,
    })
    log_task_event(task_id, "started", f"Executor started: {title}", project)
    send_heartbeat(f"Executor: {title[:40]}", project, "running", "Starting Claude Code...", 0, 3)

    # Build Claude Code command
    cmd = [CLAUDE_CLI, "-p", prompt, "--output-format", "text"]

    try:
        start = time.time()
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=TASK_TIMEOUT,
            shell=True,
            encoding="utf-8",
            errors="replace",
        )
        duration = round(time.time() - start, 1)

        stdout = result.stdout or ""
        stderr = result.stderr or ""

        # Truncate if huge
        if len(stdout) > 15000:
            stdout = stdout[:5000] + f"\n\n[...truncated {len(stdout) - 10000} chars...]\n\n" + stdout[-5000:]

        if result.returncode == 0:
            # Success
            print(f"\n  COMPLETED in {duration}s")
            print(f"  Output: {stdout[:200]}...")

            update_task(task_id, {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "output_data": json.dumps({
                    "response": stdout,
                    "duration_seconds": duration,
                    "exit_code": 0,
                }),
            })
            log_task_event(task_id, "completed", f"Completed in {duration}s: {title}", project)
            send_heartbeat(f"Executor: {title[:40]}", project, "completed", "Done!", 3, 3, stdout[:500])
            notify_discord(f"**Mission Complete:** {title}\nProject: {project} | Duration: {duration}s", 0x10b981)
            return True
        else:
            # Non-zero exit
            error_msg = stderr[:500] or f"Exit code {result.returncode}"
            print(f"\n  FAILED (exit {result.returncode}) in {duration}s")
            print(f"  Error: {error_msg}")

            update_task(task_id, {
                "status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "error_message": error_msg,
                "output_data": json.dumps({
                    "stdout": stdout[:5000],
                    "stderr": stderr[:5000],
                    "duration_seconds": duration,
                    "exit_code": result.returncode,
                }),
            })
            log_task_event(task_id, "failed", f"Failed: {title}", project, error_msg)
            send_heartbeat(f"Executor: {title[:40]}", project, "failed", error_msg, 3, 3)
            notify_discord(f"**Mission Failed:** {title}\nProject: {project}\nError: {error_msg[:200]}", 0xef4444)
            return False

    except subprocess.TimeoutExpired:
        duration = round(time.time() - start, 1)
        print(f"\n  TIMED OUT after {TASK_TIMEOUT}s")

        update_task(task_id, {
            "status": "failed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "error_message": f"Timed out after {TASK_TIMEOUT}s",
        })
        log_task_event(task_id, "timeout", f"Timed out: {title}", project)
        send_heartbeat(f"Executor: {title[:40]}", project, "failed", f"Timed out after {TASK_TIMEOUT}s")
        notify_discord(f"**Mission Timeout:** {title}\nProject: {project}", 0xe8a019)
        return False

    except Exception as e:
        print(f"\n  ERROR: {e}")
        update_task(task_id, {
            "status": "failed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "error_message": str(e)[:500],
        })
        log_task_event(task_id, "error", f"Error: {title}", project, str(e))
        send_heartbeat(f"Executor: {title[:40]}", project, "failed", str(e)[:200])
        return False


# ── Main ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Nexus Executor — runs queued missions via Claude Code")
    parser.add_argument("--loop", action="store_true", help="Poll continuously (daemon mode)")
    parser.add_argument("--interval", type=int, default=15, help="Poll interval in seconds (default: 15)")
    args = parser.parse_args()

    print("""
    ========================================
        NEXUS EXECUTOR v1.0
        Picks up missions, runs them.
    ========================================
    """)
    print(f"  Claude CLI: {CLAUDE_CLI}")
    print(f"  Nexus URL:  {NEXUS_URL}")
    print(f"  Mode:       {'Daemon (loop)' if args.loop else 'Single run'}")
    print()

    if args.loop:
        print(f"  Polling every {args.interval}s for queued tasks...")
        print("  Press Ctrl+C to stop.\n")

        try:
            while True:
                task = fetch_next_task()
                if task:
                    execute_task(task)
                else:
                    sys.stdout.write(".")
                    sys.stdout.flush()
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n\n  Executor stopped.")
    else:
        task = fetch_next_task()
        if task:
            success = execute_task(task)
            sys.exit(0 if success else 1)
        else:
            print("  No queued tasks found.")
            sys.exit(0)


if __name__ == "__main__":
    main()
