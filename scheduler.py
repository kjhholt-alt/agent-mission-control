"""
Nexus Scheduler — checks scheduled tasks every minute and spawns missions when due.

Usage:
    python scheduler.py              # Run once (check all schedules)
    python scheduler.py --loop       # Poll continuously (daemon mode)

Reads from nexus_schedules table in Supabase. When a schedule is due
(based on simple interval matching), spawns the mission via the executor.
"""

import json, os, sys, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"
API_KEY = "nexus-hive-2026"
NEXUS_LOCAL = "http://localhost:3000"
NEXUS_PROD = "https://nexus.buildkit.store"

# Simple cron patterns: "0 7 * * *" = 7:00 AM daily
# We only support: minute hour * * * (daily) or minute hour * * 1 (Monday)
def should_run(cron, last_run, now):
    """Check if a cron schedule is due."""
    parts = cron.strip().split()
    if len(parts) < 5:
        return False

    try:
        minute, hour = int(parts[0]), int(parts[1])
    except ValueError:
        return False

    day_of_week = parts[4]

    # Check if we're past the scheduled time today
    scheduled_today = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    # Day of week filter (0=Mon, 6=Sun in our convention, cron uses 0=Sun or 1=Mon)
    if day_of_week != "*":
        try:
            dow = int(day_of_week)
        except ValueError:
            return False  # Skip non-numeric day values
        # cron: 0=Sun,1=Mon... python: 0=Mon,6=Sun
        python_dow = (dow - 1) % 7
        if now.weekday() != python_dow:
            return False

    # Must be past the scheduled time
    if now < scheduled_today:
        return False

    # Must not have run today already (or within the last 23 hours)
    if last_run:
        last = datetime.fromisoformat(last_run.replace("Z", "+00:00"))
        if (now - last) < timedelta(hours=23):
            return False

    return True


def sb_get(path):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{path}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    return json.loads(urllib.request.urlopen(req, timeout=10).read())


def sb_patch(path, data):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{path}",
        json.dumps(data).encode(),
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"},
        method="PATCH")
    urllib.request.urlopen(req, timeout=10)


def spawn_mission(goal, project, worker_type, priority):
    """Spawn a mission via Nexus API (try local first, then prod)."""
    data = json.dumps({"goal": goal, "project": project, "priority": priority, "worker_type": worker_type}).encode()
    headers = {"Content-Type": "application/json", "x-nexus-key": API_KEY}

    for base in [NEXUS_LOCAL, NEXUS_PROD]:
        try:
            req = urllib.request.Request(f"{base}/api/spawn", data, headers)
            resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
            if resp.get("ok"):
                return resp
        except Exception:
            continue
    return None


def run_workflow(workflow_steps, workflow_name):
    """Run a multi-step workflow via Nexus API (try local first, then prod)."""
    data = json.dumps({
        "steps": workflow_steps,
        "workflow_name": workflow_name,
        "workflow_id": f"sched-{workflow_name.lower().replace(' ', '-')}",
    }).encode()
    headers = {"Content-Type": "application/json", "x-nexus-key": API_KEY}

    for base in [NEXUS_LOCAL, NEXUS_PROD]:
        try:
            req = urllib.request.Request(f"{base}/api/workflows", data, headers)
            resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
            if resp.get("ok"):
                return resp
        except Exception:
            continue
    return None


def check_schedules():
    """Check all enabled schedules and run any that are due."""
    now = datetime.now(timezone.utc)
    schedules = sb_get("nexus_schedules?enabled=eq.true")

    ran = 0
    for schedule in schedules:
        if should_run(schedule["cron_expression"], schedule.get("last_run_at"), now):
            print(f"  RUNNING: {schedule['name']}")

            # Workflow-type schedules have steps array
            workflow_steps = schedule.get("workflow_steps")
            if workflow_steps and isinstance(workflow_steps, list):
                result = run_workflow(workflow_steps, schedule["name"])
                if result:
                    step_count = result.get("steps_created", "?")
                    print(f"    Workflow started: {step_count} steps queued")
                else:
                    print(f"    Failed to start workflow")
                    continue
            else:
                result = spawn_mission(
                    schedule["goal"],
                    schedule.get("project", "nexus"),
                    schedule.get("worker_type", "scout"),
                    schedule.get("priority", 50),
                )
                if result:
                    print(f"    Spawned: {result.get('task_id', '?')[:8]}...")
                else:
                    print(f"    Failed to spawn")
                    continue

            sb_patch(f"nexus_schedules?id=eq.{schedule['id']}", {
                "last_run_at": now.isoformat(),
                "run_count": (schedule.get("run_count") or 0) + 1,
            })
            ran += 1

    return ran


def seed_defaults():
    """Seed default schedules if none exist."""
    existing = sb_get("nexus_schedules?select=id")
    if existing:
        return

    defaults = [
        {
            "name": "Morning Standup",
            "goal": "Morning standup workflow — git check, health check, daily brief",
            "project": "nexus",
            "worker_type": "scout",
            "priority": 40,
            "cron_expression": "0 7 * * *",
            "workflow_steps": [
                {
                    "template_name": "Git Activity Check",
                    "goal": "Check git log for all projects in the last 24 hours. List commits by project with authors and descriptions. Check https://api.github.com/users/kjhholt-alt/events for recent pushes.",
                    "project": "nexus",
                    "worker_type": "scout",
                    "priority": 40,
                    "use_previous_output": False,
                    "wait_for_approval": False,
                    "timeout_minutes": 5,
                },
                {
                    "template_name": "Health Check",
                    "goal": "Check the health of all deployed services: nexus.buildkit.store, services.buildkit.store, pcbottleneck.buildkit.store, emailfinder.buildkit.store. Report HTTP status of each. Check Supabase tables for recent activity.",
                    "project": "nexus",
                    "worker_type": "inspector",
                    "priority": 40,
                    "use_previous_output": False,
                    "wait_for_approval": False,
                    "timeout_minutes": 5,
                },
                {
                    "template_name": "Daily Brief",
                    "goal": "Based on the git activity and health status from previous steps, write a concise daily briefing (under 200 words). Include: key accomplishments, issues requiring attention, and top 3 priorities for today. Post the result to Discord.",
                    "project": "nexus",
                    "worker_type": "scout",
                    "priority": 30,
                    "use_previous_output": True,
                    "wait_for_approval": False,
                    "timeout_minutes": 5,
                },
            ],
        },
        {"name": "Weekly Status Report", "goal": "Generate a weekly status report: accomplishments this week, in-progress items, blockers, plan for next week. Pull from git commits and task completions across all projects (nexus, buildkit-services, pc-bottleneck-analyzer, MoneyPrinter, email-finder-app). Format as a structured report.", "project": "nexus", "worker_type": "scout", "priority": 50, "cron_expression": "0 8 * * 1"},
        {"name": "End-of-Day Digest", "goal": "Generate end-of-day digest: tasks completed today, costs incurred, any failures or issues. Check swarm_tasks for today's activity and nexus_sessions for cost tracking. Keep it brief.", "project": "nexus", "worker_type": "scout", "priority": 60, "cron_expression": "0 18 * * *"},
    ]

    for d in defaults:
        data = json.dumps(d).encode()
        req = urllib.request.Request(f"{SB_URL}/rest/v1/nexus_schedules",
            data, headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=10)
    print(f"  Seeded {len(defaults)} default schedules")


def predict_schedules():
    """Analyze task history and suggest recurring schedules (Feature 7)."""
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()

    # Fetch completed tasks from last 30 days
    tasks = sb_get(f"swarm_tasks?status=eq.completed&created_at=gte.{thirty_days_ago}&select=project,task_type,title,created_at")
    if not tasks:
        return 0

    # Group by project+task_type+day_of_week
    from collections import Counter
    day_counts = Counter()
    for t in tasks:
        try:
            created = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
            dow = created.weekday()  # 0=Mon, 6=Sun
            key = (t.get("project", "?"), t.get("task_type", "?"), dow)
            day_counts[key] += 1
        except Exception:
            pass

    # If a task type runs >3 times on the same day of week, suggest it
    suggested = 0
    for (project, task_type, dow), count in day_counts.items():
        if count < 3:
            continue

        # Check if we already have this exact combination scheduled
        predicted_name = f"[Predicted] {project}/{task_type}"
        existing = sb_get(f"nexus_schedules?name=eq.{urllib.parse.quote(predicted_name)}&select=name")
        if existing and len(existing) > 0:
            continue

        # Create a draft schedule (disabled)
        cron_dow = (dow + 1) % 7  # Python 0=Mon → cron 1=Mon
        schedule = {
            "name": f"[Predicted] {project}/{task_type}",
            "goal": f"Run {task_type} task for {project} (predicted from {count} occurrences on this day of week)",
            "project": project,
            "worker_type": task_type if task_type in ("scout", "inspector", "builder", "deployer") else "scout",
            "priority": 50,
            "cron_expression": f"0 9 * * {cron_dow}",
            "enabled": False,
            "source": "predicted",
        }

        data = json.dumps(schedule).encode()
        req = urllib.request.Request(f"{SB_URL}/rest/v1/nexus_schedules",
            data, headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"})
        try:
            urllib.request.urlopen(req, timeout=10)
            print(f"  PREDICTED: {project}/{task_type} on day {dow} ({count} occurrences)")
            suggested += 1
        except Exception:
            pass

    return suggested


def main():
    print("  ========================================")
    print("      NEXUS SCHEDULER v2")
    print("  ========================================\n")

    seed_defaults()

    loop = "--loop" in sys.argv

    if loop:
        print("  Running in daemon mode (checking every 60s)")
        print("  Press Ctrl+C to stop\n")
        predict_counter = 0
        try:
            while True:
                try:
                    ran = check_schedules()
                    if ran:
                        print(f"  [{datetime.now().strftime('%H:%M')}] Ran {ran} scheduled tasks")
                    else:
                        sys.stdout.write(".")
                        sys.stdout.flush()

                    # Run predictive scheduling every ~6 hours (360 cycles * 60s)
                    predict_counter += 1
                    if predict_counter >= 360:
                        suggested = predict_schedules()
                        if suggested:
                            print(f"  [{datetime.now().strftime('%H:%M')}] Predicted {suggested} new schedules")
                        predict_counter = 0

                except Exception as e:
                    print(f"\n  Error: {e}")
                time.sleep(60)
        except KeyboardInterrupt:
            print("\n\n  Scheduler stopped")
    else:
        ran = check_schedules()
        suggested = predict_schedules()
        print(f"\n  Checked schedules: {ran} tasks spawned, {suggested} predicted")


if __name__ == "__main__":
    main()
