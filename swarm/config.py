"""
Swarm configuration: project registry, budget defaults, worker limits, model costs.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://ytvtaorgityczrdhhzqv.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk",
)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
NEXUS_URL = os.environ.get(
    "NEXUS_URL",
    os.environ.get("MISSION_CONTROL_URL", "https://nexus.buildkit.store"),
)
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

# ── Project registry ─────────────────────────────────────────────────────────
PROJECTS = {
    "pl-engine": {
        "dir": "C:/Users/Kruz/Desktop/Projects/pl-engine-ARCHIVED-2026-03-01",
        "type": "python",
        "default_worker": "builder",
        "eval_interval_minutes": 120,
    },
    "buildkit-services": {
        "dir": "C:/Users/Kruz/Desktop/Projects/buildkit-services",
        "type": "nextjs",
        "default_worker": "builder",
        "eval_interval_minutes": 180,
    },
    "nexus": {
        "dir": "C:/Users/Kruz/Desktop/Projects/nexus",
        "type": "nextjs",
        "default_worker": "builder",
        "eval_interval_minutes": 120,
    },
    "email-finder": {
        "dir": "C:/Users/Kruz/Desktop/Projects/buildkit-services/email-finder",
        "type": "python",
        "default_worker": "miner",
        "eval_interval_minutes": 240,
    },
    "mcp-servers": {
        "dir": "C:/Users/Kruz/Desktop/Projects/mcp-servers",
        "type": "typescript",
        "default_worker": "builder",
        "eval_interval_minutes": 240,
    },
}

# ── Budget defaults ───────────────────────────────────────────────────────────
BUDGET_DEFAULTS = {
    "daily_api_budget_cents": 500,  # $5/day
    "daily_claude_code_minutes": 480,  # 8 hours
}

# ── Worker limits ─────────────────────────────────────────────────────────────
WORKER_LIMITS = {
    "light_max": 15,
    "heavy_max": 3,
}

# ── Model costs (cents per 1K tokens) ────────────────────────────────────────
MODEL_COSTS = {
    "claude-haiku-4-5-20251001": {"input": 0.025, "output": 0.125},
    "claude-sonnet-4-5-20250514": {"input": 0.3, "output": 1.5},
}

# ── Quality gate ──────────────────────────────────────────────────────────────
ENABLE_QUALITY_GATE = True

# ── Worker type matching ─────────────────────────────────────────────────────
WORKER_TYPE_PREFERENCES = {
    "builder": ["build", "implement", "refactor"],
    "inspector": ["eval", "review", "test"],
    "miner": ["mine", "prospect", "enrich"],
    "scout": ["eval", "plan", "research"],
}

# ── Orchestrator timing ──────────────────────────────────────────────────────
ORCHESTRATOR_LOOP_SECONDS = 10
WORKER_HEARTBEAT_TIMEOUT_SECONDS = 600  # 10 minutes
HEAVY_WORKER_TASK_TIMEOUT_SECONDS = 1800  # 30 minutes
