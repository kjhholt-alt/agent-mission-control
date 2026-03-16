"""
Nexus Morning Briefing — 7am daily Discord post

Gathers: overnight task results, project health, git activity,
session costs, executor status, and recommended actions.

Usage:
    python scripts/ops/morning-briefing.py          # Run and post to Discord
    python scripts/ops/morning-briefing.py --dry-run # Print without posting
"""

import json
import os
import subprocess
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

# ── Config ────────────────────────────────────────────────────────────

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwi"
    "cm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0."
    "A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"
)
DISCORD_WEBHOOK = os.environ.get(
    "DISCORD_WEBHOOK_URL",
    "https://discord.com/api/webhooks/1477500882529554624/"
    "Cumn_pkEtvf6NU5jOvFfVy33jJ9_ePOpSnIfm9aBRAQUr4JMZwxhqoytRIAWQM4sJ7FW"
)
PROJECTS_ROOT = "C:/Users/Kruz/Desktop/Projects"

# Key projects to check git activity for
KEY_PROJECTS = [
    "agent-mission-control",
    "MoneyPrinter",
    "buildkit-services",
    "pc-bottleneck-analyzer",
    "ai-finance-brief",
    "BarrelHouseCRM",
    "email-finder-app",
    "admin-dashboard",
    "automation-playground",
]


# ── Supabase helpers ─────────────────────────────────────────────────

def sb_get(path):
    """Fetch from Supabase REST API."""
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"},
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=10).read())
    except Exception as e:
        print(f"  Supabase error: {e}")
        return []


# ── Data gatherers ───────────────────────────────────────────────────

def get_session_stats():
    """Get sessions from the last 24 hours."""
    yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
    sessions = sb_get(f"nexus_sessions?last_activity=gte.{yesterday}")

    total = len(sessions)
    total_cost = sum(float(s.get("cost_usd") or 0) for s in sessions)
    total_tools = sum(s.get("tool_count") or 0 for s in sessions)
    total_input = sum(s.get("input_tokens") or 0 for s in sessions)
    total_output = sum(s.get("output_tokens") or 0 for s in sessions)
    total_cache_read = sum(s.get("cache_read_tokens") or 0 for s in sessions)
    projects = sorted(set(s.get("project_name") or "unknown" for s in sessions))
    active = sum(1 for s in sessions if s.get("status") == "active")

    return {
        "total": total,
        "active": active,
        "cost": total_cost,
        "tools": total_tools,
        "input_tokens": total_input,
        "output_tokens": total_output,
        "cache_read": total_cache_read,
        "projects": projects,
    }


def get_task_stats():
    """Get task queue status."""
    yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
    recent = sb_get(f"swarm_tasks?updated_at=gte.{yesterday}")
    queued = sb_get("swarm_tasks?status=eq.queued")

    completed = sum(1 for t in recent if t.get("status") == "completed")
    failed = sum(1 for t in recent if t.get("status") == "failed")

    # Get failed task titles for the briefing
    failed_tasks = [t.get("title", "Untitled") for t in recent if t.get("status") == "failed"]

    return {
        "completed": completed,
        "failed": failed,
        "queued": len(queued),
        "failed_titles": failed_tasks[:3],  # Top 3 failures
    }


def get_executor_status():
    """Check if the executor worker is alive."""
    workers = sb_get("swarm_workers?tier=eq.executor")

    if not workers:
        return {"online": False, "last_heartbeat": None}

    w = workers[0]
    last_hb = w.get("last_heartbeat")
    status = w.get("status", "unknown")

    # Consider stale if last heartbeat > 5 minutes ago
    stale = False
    if last_hb:
        hb_time = datetime.fromisoformat(last_hb.replace("Z", "+00:00"))
        stale = (datetime.now(timezone.utc) - hb_time) > timedelta(minutes=5)

    return {
        "online": status != "dead" and not stale,
        "status": status,
        "stale": stale,
        "last_heartbeat": last_hb,
        "tasks_completed": w.get("tasks_completed", 0),
        "tasks_failed": w.get("tasks_failed", 0),
    }


def get_git_activity():
    """Get git commit counts for key projects (last 24h)."""
    activity = {}
    for project in KEY_PROJECTS:
        project_dir = os.path.join(PROJECTS_ROOT, project)
        if not os.path.isdir(os.path.join(project_dir, ".git")):
            continue
        try:
            result = subprocess.run(
                ["git", "log", "--oneline", "--since=24 hours ago"],
                cwd=project_dir,
                capture_output=True,
                text=True,
                timeout=5,
            )
            commits = [l for l in result.stdout.strip().split("\n") if l.strip()]
            if commits:
                activity[project] = len(commits)
        except Exception:
            continue

    return activity


def get_n8n_status():
    """Check n8n workflow health (basic ping)."""
    try:
        req = urllib.request.Request(
            "https://automation-playground-production.up.railway.app/healthz",
            method="GET",
        )
        resp = urllib.request.urlopen(req, timeout=5)
        return {"healthy": resp.status == 200}
    except Exception:
        return {"healthy": False}


# ── Briefing builder ─────────────────────────────────────────────────

def format_tokens(n):
    """Format token count for display."""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


def build_briefing():
    """Build the morning briefing content."""
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%A, %B %d")

    sessions = get_session_stats()
    tasks = get_task_stats()
    executor = get_executor_status()
    git = get_git_activity()
    n8n = get_n8n_status()

    # ── Header ──
    lines = [f"Good morning! Here's your briefing for **{date_str}**.\n"]

    # ── Sessions & Cost ──
    cost_str = f"${sessions['cost']:.2f}" if sessions["cost"] > 0 else "$0.00 (no cost data yet)"
    lines.append("**Sessions (24h)**")
    lines.append(f"  Sessions: {sessions['total']} ({sessions['active']} active)")
    lines.append(f"  Cost: {cost_str}")
    lines.append(f"  Tools used: {sessions['tools']:,}")
    if sessions["input_tokens"] > 0:
        lines.append(
            f"  Tokens: {format_tokens(sessions['input_tokens'])} in / "
            f"{format_tokens(sessions['output_tokens'])} out / "
            f"{format_tokens(sessions['cache_read'])} cached"
        )
    lines.append("")

    # ── Tasks ──
    lines.append("**Task Queue**")
    lines.append(
        f"  Completed: {tasks['completed']} | "
        f"Failed: {tasks['failed']} | "
        f"Queued: {tasks['queued']}"
    )
    if tasks["failed_titles"]:
        for title in tasks["failed_titles"]:
            short = title[:50] + "..." if len(title) > 50 else title
            lines.append(f"  Failed: {short}")
    lines.append("")

    # ── Executor ──
    executor_icon = "ONLINE" if executor["online"] else "OFFLINE"
    lines.append("**Infrastructure**")
    lines.append(f"  Executor: {executor_icon}")
    if executor["online"]:
        lines.append(
            f"  Stats: {executor.get('tasks_completed', 0)} completed, "
            f"{executor.get('tasks_failed', 0)} failed"
        )
    elif executor.get("stale"):
        lines.append("  Executor heartbeat stale — may need restart")
    lines.append(f"  n8n: {'HEALTHY' if n8n['healthy'] else 'DOWN'}")
    lines.append("")

    # ── Git Activity ──
    if git:
        lines.append("**Git Activity (24h)**")
        for project, count in sorted(git.items(), key=lambda x: -x[1]):
            lines.append(f"  {project}: {count} commit{'s' if count != 1 else ''}")
        total_commits = sum(git.values())
        lines.append(f"  Total: {total_commits} commits across {len(git)} projects")
    else:
        lines.append("**Git Activity:** No commits in the last 24h")
    lines.append("")

    # ── Recommendations ──
    recs = []
    if not executor["online"]:
        recs.append("Start the executor: `wscript executor-hidden.vbs`")
    if tasks["queued"] > 5:
        recs.append(f"{tasks['queued']} tasks queued — executor may be falling behind")
    if tasks["failed"] > 0:
        recs.append(f"Review {tasks['failed']} failed task(s)")
    if not n8n["healthy"]:
        recs.append("n8n is down — check Railway deployment")
    if sessions["cost"] == 0 and sessions["total"] > 0:
        recs.append("Session costs are $0.00 — cost tracking hook may not be active yet")
    if not git:
        recs.append("No git activity — quiet day or hooks not collecting?")

    if recs:
        lines.append("**Action Items**")
        for r in recs:
            lines.append(f"  - {r}")
    else:
        lines.append("**Status:** All systems nominal. No action needed.")

    return "\n".join(lines)


# ── Discord posting ──────────────────────────────────────────────────

def post_to_discord(content):
    """Post the briefing to Discord as an embed."""
    now = datetime.now(timezone.utc)

    # Truncate if too long for Discord embed (max 4096 chars)
    if len(content) > 4000:
        content = content[:3990] + "\n..."

    payload = {
        "username": "NEXUS",
        "embeds": [{
            "title": f"Morning Briefing - {now.strftime('%B %d, %Y')}",
            "description": content,
            "color": 440516,
            "footer": {"text": "NEXUS | Automated Daily Briefing"},
            "timestamp": now.isoformat(),
        }],
    }

    data = json.dumps(payload, ensure_ascii=True).encode("utf-8")

    req = urllib.request.Request(
        DISCORD_WEBHOOK,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "NexusBriefing/1.0",
        },
        method="POST",
    )
    resp = urllib.request.urlopen(req, timeout=10)
    print(f"  Posted to Discord (HTTP {resp.status})")


# ── Main ─────────────────────────────────────────────────────────────

def main():
    print("\n  ========================================")
    print("      NEXUS Morning Briefing")
    print("  ========================================\n")

    briefing = build_briefing()
    print(briefing)

    if "--dry-run" not in sys.argv:
        try:
            post_to_discord(briefing)
        except Exception as e:
            print(f"\n  Discord post failed: {e}")
    else:
        print("\n  (dry-run — not posting to Discord)")


if __name__ == "__main__":
    main()
