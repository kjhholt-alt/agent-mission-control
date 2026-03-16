"""
Weekly Retrospective — auto-generated agent performance report.

Analyzes the last 7 days of task history and generates a performance
report comparing to the previous week. Posts to Discord.

Usage:
    python scripts/ops/weekly-retrospective.py
"""

import json
import os
import urllib.request
from datetime import datetime, timezone, timedelta

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"
DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", "")


def sb_get(path):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{path}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    return json.loads(urllib.request.urlopen(req, timeout=15).read())


def post_discord(embeds):
    if not DISCORD_WEBHOOK:
        print("  No Discord webhook configured")
        return
    data = json.dumps({"username": "NEXUS Intelligence", "embeds": embeds}).encode()
    req = urllib.request.Request(DISCORD_WEBHOOK, data,
        headers={"Content-Type": "application/json"}, method="POST")
    urllib.request.urlopen(req, timeout=10)


def main():
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    two_weeks_ago = (now - timedelta(days=14)).isoformat()

    print("  Generating weekly retrospective...\n")

    # This week's tasks
    this_week = sb_get(f"swarm_tasks?created_at=gte.{week_ago}&select=project,task_type,status,created_at,output_data,error_message")
    # Last week's tasks
    last_week = sb_get(f"swarm_tasks?created_at=gte.{two_weeks_ago}&created_at=lt.{week_ago}&select=project,task_type,status")
    # Specializations
    specs = sb_get("agent_specializations?order=last_updated.desc&limit=20")

    # This week aggregates
    tw_completed = len([t for t in this_week if t["status"] == "completed"])
    tw_failed = len([t for t in this_week if t["status"] == "failed"])
    tw_total = len(this_week)
    tw_rate = round((tw_completed / tw_total * 100)) if tw_total > 0 else 0

    # Last week aggregates
    lw_completed = len([t for t in last_week if t["status"] == "completed"])
    lw_failed = len([t for t in last_week if t["status"] == "failed"])
    lw_total = len(last_week)
    lw_rate = round((lw_completed / lw_total * 100)) if lw_total > 0 else 0

    # By project
    projects = {}
    for t in this_week:
        p = t.get("project", "?")
        if p not in projects:
            projects[p] = {"completed": 0, "failed": 0, "total": 0}
        projects[p]["total"] += 1
        if t["status"] == "completed":
            projects[p]["completed"] += 1
        elif t["status"] == "failed":
            projects[p]["failed"] += 1

    # Common errors
    errors = {}
    for t in this_week:
        if t["status"] == "failed" and t.get("error_message"):
            err = t["error_message"][:100]
            errors[err] = errors.get(err, 0) + 1
    top_errors = sorted(errors.items(), key=lambda x: -x[1])[:3]

    # Trends
    delta_tasks = tw_total - lw_total
    delta_rate = tw_rate - lw_rate
    trend_emoji = "📈" if delta_tasks > 0 else "📉" if delta_tasks < 0 else "➡️"
    rate_emoji = "✅" if delta_rate > 0 else "⚠️" if delta_rate < 0 else "➡️"

    # Build report
    report_lines = [
        f"**Weekly Retrospective** ({now.strftime('%b %d')})\n",
        f"**This Week:** {tw_total} tasks | {tw_completed} completed | {tw_failed} failed | {tw_rate}% success",
        f"**Last Week:** {lw_total} tasks | {lw_completed} completed | {lw_failed} failed | {lw_rate}% success",
        f"**Trends:** {trend_emoji} {'+' if delta_tasks >= 0 else ''}{delta_tasks} tasks | {rate_emoji} {'+' if delta_rate >= 0 else ''}{delta_rate}% success rate\n",
    ]

    # Project breakdown
    if projects:
        report_lines.append("**By Project:**")
        for p, data in sorted(projects.items(), key=lambda x: -x[1]["total"]):
            rate = round((data["completed"] / data["total"]) * 100) if data["total"] > 0 else 0
            report_lines.append(f"  • {p}: {data['total']} tasks ({rate}% success)")

    # Top errors
    if top_errors:
        report_lines.append("\n**Top Errors:**")
        for err, count in top_errors:
            report_lines.append(f"  • ({count}x) {err}")

    # Specialization insights
    if specs:
        report_lines.append("\n**Agent Intelligence:**")
        for s in specs[:5]:
            total = (s.get("success_count") or 0) + (s.get("fail_count") or 0)
            if total > 0:
                rate = round((s["success_count"] / total) * 100)
                avg = round(s.get("avg_duration_seconds") or 0)
                report_lines.append(f"  • {s['project']}/{s['task_type']}: {rate}% success, avg {avg}s ({total} tasks)")

    report = "\n".join(report_lines)
    print(report)

    # Post to Discord
    post_discord([{
        "title": f"📊 Weekly Retrospective — {now.strftime('%b %d, %Y')}",
        "description": report,
        "color": 0x8b5cf6,
        "footer": {"text": "NEXUS Intelligence v3"},
        "timestamp": now.isoformat(),
    }])

    print("\n  Posted to Discord ✓")


if __name__ == "__main__":
    main()
