"""
Nexus Executor — picks up queued tasks and runs them via Claude Code CLI.

Usage:
    python executor.py              # Run one task and exit
    python executor.py --loop       # Poll continuously (daemon mode)
    python executor.py --loop --interval 30   # Poll every 30 seconds

This is the bridge between the Nexus dashboard and actual work.
When you click "New Mission" on the dashboard, the task goes into swarm_tasks.
This script picks it up and runs it.

The executor registers itself as a swarm_worker in Supabase so it appears
in the 3D factory visualization. It sends heartbeats every poll cycle
and updates its status when running tasks.
"""

import argparse
import json
import os
import platform
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

# Stable worker ID — survives restarts, unique per machine
HOSTNAME = platform.node().lower().replace(" ", "-")[:16]
WORKER_ID = f"executor-{HOSTNAME}"
WORKER_NAME = f"heavy-{HOSTNAME[:8]}"

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
    """Get the highest-priority queued or approved task."""
    # Check for approved tasks first (they've been waiting)
    result = supabase_request(
        "GET",
        "swarm_tasks?status=eq.approved&order=priority.asc&limit=1"
    )
    if result and len(result) > 0:
        return result[0]

    # Then check for queued tasks
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


# ── Worker self-registration ─────────────────────────────────────────

# Tracks cumulative stats across the session
_session_stats = {"completed": 0, "failed": 0, "xp": 0}


def register_worker():
    """Register/update executor as a swarm_worker so it appears in the 3D factory."""
    now = datetime.now(timezone.utc).isoformat()
    worker_data = {
        "id": WORKER_ID,
        "worker_name": WORKER_NAME,
        "worker_type": "heavy",
        "tier": "executor",
        "status": "idle",
        "current_task_id": None,
        "last_heartbeat": now,
        "pid": os.getpid(),
        "tasks_completed": _session_stats["completed"],
        "tasks_failed": _session_stats["failed"],
        "total_cost_cents": 0,
        "total_tokens": 0,
        "xp": _session_stats["xp"],
        "spawned_at": now,
        "died_at": None,
    }

    # Try PATCH first (worker already exists from previous run)
    result = supabase_request("PATCH", f"swarm_workers?id=eq.{WORKER_ID}", {
        "status": "idle",
        "last_heartbeat": now,
        "pid": os.getpid(),
        "died_at": None,
    })

    if result is None or (isinstance(result, list) and len(result) == 0):
        # Worker doesn't exist yet, create it
        supabase_request("POST", "swarm_workers", worker_data)
        print(f"  Registered as worker: {WORKER_ID}")
    else:
        print(f"  Reconnected as worker: {WORKER_ID}")


def update_worker(status="idle", task_id=None, project=None):
    """Update worker status in swarm_workers table."""
    update = {
        "status": status,
        "current_task_id": task_id,
        "last_heartbeat": datetime.now(timezone.utc).isoformat(),
        "tasks_completed": _session_stats["completed"],
        "tasks_failed": _session_stats["failed"],
        "xp": _session_stats["xp"],
    }
    supabase_request("PATCH", f"swarm_workers?id=eq.{WORKER_ID}", update)


def deregister_worker():
    """Mark worker as idle on clean shutdown (don't delete — keeps history)."""
    supabase_request("PATCH", f"swarm_workers?id=eq.{WORKER_ID}", {
        "status": "idle",
        "current_task_id": None,
        "last_heartbeat": datetime.now(timezone.utc).isoformat(),
    })
    print(f"  Worker {WORKER_ID} marked idle")


# ── Task execution ────────────────────────────────────────────────────

MAX_FILE_SIZE = 100 * 1024  # 100KB per file
OUTPUT_DIR = f"{PROJECTS_ROOT}/nexus/output"
CONTEXTS_DIR = f"{PROJECTS_ROOT}/nexus/contexts"


def read_xlsx(file_path):
    """Read an Excel file and return its contents as CSV-like text."""
    try:
        import openpyxl
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        parts = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            rows = []
            for row in ws.iter_rows(values_only=True):
                rows.append(",".join(str(c) if c is not None else "" for c in row))
            if rows:
                parts.append(f"=== Sheet: {sheet_name} ({len(rows)} rows) ===\n" + "\n".join(rows[:500]))
        wb.close()
        return "\n\n".join(parts)
    except ImportError:
        return "[openpyxl not installed — cannot read .xlsx]"
    except Exception as e:
        return f"[Error reading xlsx: {e}]"


def read_pdf(file_path):
    """Read a PDF file and return its text content."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        pages = []
        for i, page in enumerate(reader.pages[:50]):  # Max 50 pages
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"--- Page {i+1} ---\n{text}")
        return "\n\n".join(pages) if pages else "[PDF has no extractable text]"
    except ImportError:
        return "[PyPDF2 not installed — cannot read .pdf]"
    except Exception as e:
        return f"[Error reading pdf: {e}]"


def save_output(task_id, project, content):
    """Save task output to a file in the output directory."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"{project}_{task_id[:8]}_{timestamp}.md"
    filepath = os.path.join(OUTPUT_DIR, filename)
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Output saved: {filepath}")
        return filepath
    except Exception as e:
        print(f"  Failed to save output: {e}")
        return None


def load_context_files(project, task_type=None):
    """Auto-load relevant context files from the contexts directory."""
    if not os.path.isdir(CONTEXTS_DIR):
        return ""

    context_parts = []
    for filename in sorted(os.listdir(CONTEXTS_DIR)):
        if not filename.endswith('.md'):
            continue

        # Load global context files (no prefix) and project-specific ones
        name_lower = filename.lower()
        is_global = not any(name_lower.startswith(p) for p in [
            "nexus-", "moneyprinter-", "deere-", "buildkit-", "finance-"])
        is_project = name_lower.startswith(f"{project.lower()}-") or name_lower.startswith("deere-")
        is_finance = name_lower.startswith("finance-") and task_type in ("scout", "inspector", "miner")

        if is_global or is_project or is_finance:
            filepath = os.path.join(CONTEXTS_DIR, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                if len(content) > 10000:
                    content = content[:10000] + "\n[...truncated...]"
                context_parts.append(f"--- CONTEXT: {filename} ---\n{content}\n--- END CONTEXT ---")
            except Exception:
                pass

    if context_parts:
        return "\n\n".join(context_parts) + "\n\n"
    return ""


def read_input_files(input_data):
    """Read files specified in input_data and return their contents as context."""
    files = input_data.get("files", [])
    if not files:
        return ""

    context_parts = []
    for file_path in files:
        try:
            if not os.path.isfile(file_path):
                context_parts.append(f"[File not found: {file_path}]")
                continue
            size = os.path.getsize(file_path)
            if size > MAX_FILE_SIZE:
                context_parts.append(f"[File too large ({size} bytes): {file_path}]")
                continue
            ext = os.path.splitext(file_path)[1].lower()

            # Excel files
            if ext in ('.xlsx', '.xls'):
                content = read_xlsx(file_path)
                context_parts.append(f"--- SPREADSHEET: {file_path} ---\n{content}\n--- END SPREADSHEET ---")
                continue

            # PDF files
            if ext == '.pdf':
                content = read_pdf(file_path)
                context_parts.append(f"--- PDF: {file_path} ---\n{content}\n--- END PDF ---")
                continue

            # Text-based files
            if ext not in ('.txt', '.csv', '.json', '.md', '.py', '.ts', '.tsx', '.js', '.sql', '.yaml', '.yml', '.toml', '.env', '.log', '.html', '.xml'):
                context_parts.append(f"[Unsupported file type: {file_path}]")
                continue
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            context_parts.append(f"--- FILE: {file_path} ---\n{content}\n--- END FILE ---")
        except Exception as e:
            context_parts.append(f"[Error reading {file_path}: {e}]")

    if context_parts:
        return "\n\n".join(context_parts) + "\n\n"
    return ""


def check_approval_gate(task):
    """Check if a task needs approval before execution. Returns True if approved/not needed."""
    # Check if this task has the approval flag via its metadata or depends_on chain
    input_data = task.get("input_data") or {}
    if isinstance(input_data, str):
        try:
            input_data = json.loads(input_data)
        except Exception:
            input_data = {}

    needs_approval = input_data.get("wait_for_approval", False)

    # Also check if the task title contains [APPROVAL] marker (set by workflow engine)
    title = task.get("title", "")
    if "[approval]" in title.lower():
        needs_approval = True

    if not needs_approval:
        return True  # No approval needed

    # Check if already approved
    if task.get("status") == "approved":
        return True

    # Set to pending_approval and notify
    task_id = task["id"]
    project = task.get("project", "general")

    update_task(task_id, {
        "status": "pending_approval",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    log_task_event(task_id, "approval_pending", f"Awaiting approval: {title}", project)

    # Send Discord notification with approval info
    notify_discord(
        f"**Approval Required**\n"
        f"Task: {title}\n"
        f"Project: {project}\n\n"
        f"Approve via dashboard or API:\n"
        f"`POST /api/tasks/approve` with `{{\"task_id\": \"{task_id}\"}}`",
        0xe8a019,  # amber
    )

    print(f"  APPROVAL REQUIRED: {title} — waiting for approval via API or dashboard")
    return False  # Don't execute yet


def execute_task(task):
    """Execute a single task via Claude Code CLI."""
    task_id = task["id"]
    title = task.get("title", "Untitled")
    project = task.get("project", "general")
    task_type = task.get("task_type", "builder")
    prompt = task.get("description") or task.get("title", "")

    # Check approval gate
    if not check_approval_gate(task):
        return True  # Not a failure, just waiting

    # Auto-load context files for the project
    context = load_context_files(project, task_type)
    if context:
        prompt = f"Reference context (use as background knowledge):\n\n{context}\n\nTask:\n{prompt}"

    # Read input files if specified
    input_data = task.get("input_data") or {}
    if isinstance(input_data, str):
        try:
            input_data = json.loads(input_data)
        except Exception:
            input_data = {}

    file_context = read_input_files(input_data)
    if file_context:
        prompt = f"Context from input files:\n\n{file_context}\n\n{prompt}"

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
        "assigned_worker_id": WORKER_ID,
    })
    log_task_event(task_id, "started", f"Executor started: {title}", project)
    send_heartbeat(f"Executor: {title[:40]}", project, "running", "Starting Claude Code...", 0, 3)

    # Update swarm_worker status to busy
    update_worker("busy", task_id, project)

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

            _session_stats["completed"] += 1
            _session_stats["xp"] += 10  # +10 XP per completed task

            # Save output to file
            output_path = save_output(task_id, project, stdout) if len(stdout) > 100 else None

            update_task(task_id, {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "output_data": json.dumps({
                    "response": stdout,
                    "duration_seconds": duration,
                    "exit_code": 0,
                    "output_file": output_path,
                }),
            })
            log_task_event(task_id, "completed", f"Completed in {duration}s: {title}", project)
            send_heartbeat(f"Executor: {title[:40]}", project, "completed", "Done!", 3, 3, stdout[:500])
            update_worker("idle")  # Back to idle after completing
            notify_discord(f"**Mission Complete:** {title}\nProject: {project} | Duration: {duration}s", 0x10b981)
            return True
        else:
            # Non-zero exit
            error_msg = stderr[:500] or f"Exit code {result.returncode}"
            print(f"\n  FAILED (exit {result.returncode}) in {duration}s")
            print(f"  Error: {error_msg}")

            _session_stats["failed"] += 1
            _session_stats["xp"] += 2  # +2 XP even for failed tasks (still did work)

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
            update_worker("idle")  # Back to idle after failure
            notify_discord(f"**Mission Failed:** {title}\nProject: {project}\nError: {error_msg[:200]}", 0xef4444)
            return False

    except subprocess.TimeoutExpired:
        duration = round(time.time() - start, 1)
        print(f"\n  TIMED OUT after {TASK_TIMEOUT}s")

        _session_stats["failed"] += 1

        update_task(task_id, {
            "status": "failed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "error_message": f"Timed out after {TASK_TIMEOUT}s",
        })
        log_task_event(task_id, "timeout", f"Timed out: {title}", project)
        send_heartbeat(f"Executor: {title[:40]}", project, "failed", f"Timed out after {TASK_TIMEOUT}s")
        update_worker("idle")
        notify_discord(f"**Mission Timeout:** {title}\nProject: {project}", 0xe8a019)
        return False

    except Exception as e:
        print(f"\n  ERROR: {e}")

        _session_stats["failed"] += 1

        update_task(task_id, {
            "status": "failed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "error_message": str(e)[:500],
        })
        log_task_event(task_id, "error", f"Error: {title}", project, str(e))
        send_heartbeat(f"Executor: {title[:40]}", project, "failed", str(e)[:200])
        update_worker("idle")
        return False


# ── Main ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Nexus Executor — runs queued missions via Claude Code")
    parser.add_argument("--loop", action="store_true", help="Poll continuously (daemon mode)")
    parser.add_argument("--interval", type=int, default=15, help="Poll interval in seconds (default: 15)")
    args = parser.parse_args()

    print("""
    ========================================
        NEXUS EXECUTOR v2.0
        Picks up missions, runs them.
        Self-registers as swarm_worker.
    ========================================
    """)
    print(f"  Claude CLI:  {CLAUDE_CLI}")
    print(f"  Nexus URL:   {NEXUS_URL}")
    print(f"  Worker ID:   {WORKER_ID}")
    print(f"  Mode:        {'Daemon (loop)' if args.loop else 'Single run'}")
    print()

    if args.loop:
        # Register as a persistent swarm worker
        register_worker()
        notify_discord(
            f"**Executor Online:** `{WORKER_ID}`\nPolling every {args.interval}s for missions.",
            0x06b6d4,
        )

        print(f"  Polling every {args.interval}s for queued tasks...")
        print("  Press Ctrl+C to stop.\n")

        heartbeat_counter = 0

        try:
            while True:
                task = fetch_next_task()
                if task:
                    execute_task(task)
                else:
                    sys.stdout.write(".")
                    sys.stdout.flush()

                # Send heartbeat every 4 poll cycles (~60s at default 15s interval)
                heartbeat_counter += 1
                if heartbeat_counter >= 4:
                    update_worker("idle")
                    heartbeat_counter = 0

                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n\n  Shutting down gracefully...")
            deregister_worker()
            notify_discord(f"**Executor Offline:** `{WORKER_ID}` — clean shutdown", 0xe8a019)
            print("  Executor stopped.")
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
