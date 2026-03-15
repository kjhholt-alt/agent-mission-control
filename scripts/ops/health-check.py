"""
Nexus Health Check — Full system health monitoring

Checks: Supabase, Vercel, executor heartbeat, n8n, Discord webhook,
task queue depth, active workers. Posts Discord alert on any failure.

Usage:
    python scripts/ops/health-check.py             # Run once, alert on failure
    python scripts/ops/health-check.py --quiet      # Only output on failure
    python scripts/ops/health-check.py --no-alert   # Don't post to Discord
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

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

quiet = "--quiet" in sys.argv
no_alert = "--no-alert" in sys.argv

checks = []


def check(name, fn):
    start = time.time()
    try:
        result = fn()
        ms = int((time.time() - start) * 1000)
        checks.append((name, "PASS", f"{result} ({ms}ms)"))
        if not quiet:
            print(f"  PASS  {name:40s} {result} ({ms}ms)")
    except Exception as e:
        ms = int((time.time() - start) * 1000)
        checks.append((name, "FAIL", str(e)[:100]))
        print(f"  FAIL  {name:40s} {e} ({ms}ms)")


def sb_request(path):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"},
    )
    return json.loads(urllib.request.urlopen(req, timeout=5).read())


# ── Check functions ──────────────────────────────────────────────────

def sb_sessions():
    sb_request("nexus_sessions?limit=1")
    return "readable"


def sb_tasks():
    sb_request("swarm_tasks?limit=1&select=status")
    return "readable"


def vercel_site():
    req = urllib.request.Request(
        "https://nexus.buildkit.store",
        headers={"User-Agent": "NexusHealthCheck/1.0"},
    )
    r = urllib.request.urlopen(req, timeout=10)
    return f"HTTP {r.getcode()}"


def executor_heartbeat():
    """Check if executor worker has a recent heartbeat (< 5 min)."""
    workers = sb_request("swarm_workers?id=eq.executor-spaceship")
    if not workers:
        raise Exception("No executor worker registered")
    w = workers[0]
    hb = w.get("last_heartbeat")
    if not hb:
        raise Exception("No heartbeat recorded")
    hb_time = datetime.fromisoformat(hb.replace("Z", "+00:00"))
    age = datetime.now(timezone.utc) - hb_time
    if age > timedelta(minutes=5):
        raise Exception(f"Stale heartbeat ({int(age.total_seconds())}s ago)")
    return f"alive ({int(age.total_seconds())}s ago)"


def n8n_health():
    req = urllib.request.Request(
        "https://automation-playground-production.up.railway.app/healthz",
        headers={"User-Agent": "NexusHealthCheck/1.0"},
    )
    r = urllib.request.urlopen(req, timeout=5)
    return f"HTTP {r.getcode()}"


def discord_webhook():
    req = urllib.request.Request(
        DISCORD_WEBHOOK,
        headers={"User-Agent": "NexusHealthCheck/1.0"},
    )
    r = urllib.request.urlopen(req, timeout=5)
    return f"HTTP {r.getcode()}"


def task_queue():
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/swarm_tasks?status=eq.queued&select=id",
        headers={
            "apikey": SB_KEY,
            "Authorization": f"Bearer {SB_KEY}",
            "Prefer": "count=exact",
        },
    )
    resp = urllib.request.urlopen(req, timeout=5)
    count = resp.headers.get("content-range", "*/0").split("/")[-1]
    return f"{count} queued"


def active_workers():
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/swarm_workers?status=neq.dead&select=id",
        headers={
            "apikey": SB_KEY,
            "Authorization": f"Bearer {SB_KEY}",
            "Prefer": "count=exact",
        },
    )
    resp = urllib.request.urlopen(req, timeout=5)
    count = resp.headers.get("content-range", "*/0").split("/")[-1]
    return f"{count} alive"


def vercel_sites():
    """Check all key Vercel deployments."""
    sites = [
        "https://pcbottleneck.buildkit.store",
        "https://services.buildkit.store",
        "https://admin.buildkit.store",
    ]
    results = []
    for url in sites:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NexusHealthCheck/1.0"})
            r = urllib.request.urlopen(req, timeout=8)
            results.append(f"{r.getcode()}")
        except Exception:
            results.append("DOWN")
    down = [s for s, r in zip(sites, results) if r == "DOWN"]
    if down:
        raise Exception(f"{len(down)} site(s) down")
    return f"{len(sites)} sites OK"


# ── Alert ────────────────────────────────────────────────────────────

def alert_discord(failures):
    """Post a Discord alert for health check failures."""
    if no_alert or not failures:
        return

    now = datetime.now(timezone.utc)
    failure_list = "\n".join(f"- **{name}**: {detail}" for name, _, detail in failures)

    data = json.dumps({
        "username": "NEXUS Health Alert",
        "embeds": [{
            "title": "Health Check FAILED",
            "description": f"{len(failures)} check(s) failed:\n\n{failure_list}",
            "color": 0xef4444,
            "footer": {"text": "NEXUS | Automated Health Check"},
            "timestamp": now.isoformat(),
        }],
    }, ensure_ascii=True).encode("utf-8")

    try:
        req = urllib.request.Request(
            DISCORD_WEBHOOK,
            data=data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "NexusHealthCheck/1.0",
            },
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
        print("  Alert posted to Discord")
    except Exception as e:
        print(f"  Failed to alert Discord: {e}")


# ── Main ─────────────────────────────────────────────────────────────

if not quiet:
    print("\n  === NEXUS HEALTH CHECK ===\n")

check("Supabase (sessions)", sb_sessions)
check("Supabase (tasks)", sb_tasks)
check("Vercel (nexus.buildkit.store)", vercel_site)
check("Vercel (other sites)", vercel_sites)
check("Executor heartbeat", executor_heartbeat)
check("n8n automation hub", n8n_health)
check("Discord webhook", discord_webhook)
check("Task queue depth", task_queue)
check("Active workers", active_workers)

passed = sum(1 for _, s, _ in checks if s == "PASS")
failures = [(n, s, d) for n, s, d in checks if s == "FAIL"]

if not quiet or failures:
    print(f"\n  {passed}/{len(checks)} healthy")

if failures:
    alert_discord(failures)

sys.exit(0 if not failures else 1)
