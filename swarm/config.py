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
# ANTHROPIC_API_KEY no longer needed — all workers use Claude Code CLI (free on Max plan)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")  # Kept for backward compat only
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

# ── Blocked projects (on hold — never assign tasks) ──────────────────────
BLOCKED_PROJECTS = ["MoneyPrinter", "moneyprinter", "moneyprinter-hud"]

# ── Budget defaults ───────────────────────────────────────────────────────────
# All workers now use Claude Code CLI (free on Max plan). Budget is kept for
# observability but no real API spend should occur.
BUDGET_DEFAULTS = {
    "daily_api_budget_cents": 0,  # $0/day — everything routes through CLI now
}

# ── Worker limits ─────────────────────────────────────────────────────────────
# All workers now use Claude Code CLI. Light workers have shorter timeouts.
WORKER_LIMITS = {
    "light_max": 8,        # Claude Code CLI workers (fast tasks, 2min timeout)
    "cc_light_max": 5,     # Claude Code CLI workers (eval, scout, planning, 5min timeout)
    "heavy_max": 5,        # Claude Code CLI workers (code writing, PRs, 30min timeout)
    "browser_max": 3,      # Playwright browser workers (scraping, screenshots)
}

# ── Model costs (cents per 1K tokens) ────────────────────────────────────────
# Kept for historical tracking. All workers now use CLI (cost = 0).
MODEL_COSTS = {
    "claude-haiku-4-5-20251001": {"input": 0.025, "output": 0.125},
    "claude-sonnet-4-5-20250514": {"input": 0.3, "output": 1.5},
}

# ── Quality gate ──────────────────────────────────────────────────────────────
# Now uses free heuristic checks (output length, error detection) instead of Haiku API
ENABLE_QUALITY_GATE = True

# ── Worker type matching ─────────────────────────────────────────────────────
WORKER_TYPE_PREFERENCES = {
    "builder": ["build", "implement", "refactor"],
    "inspector": ["eval", "review", "test"],
    "miner": ["mine", "prospect", "enrich"],
    "scout": ["eval", "plan", "research"],
    "browser": ["screenshot", "health_check", "scrape", "research", "check_deploy", "video_analysis"],
}

# ── Orchestrator timing ──────────────────────────────────────────────────────
ORCHESTRATOR_LOOP_SECONDS = 10
WORKER_HEARTBEAT_TIMEOUT_SECONDS = 600  # 10 minutes
HEAVY_WORKER_TASK_TIMEOUT_SECONDS = 1800  # 30 minutes

# ── Auto-merge settings ─────────────────────────────────────────────────────
AUTO_MERGE_ENABLED = True
AUTO_MERGE_MAX_FILES_CHANGED = 10
AUTO_MERGE_MIN_QUALITY_SCORE = 7

# ── Model routing ─────────────────────────────────────────────────────
# All tiers now route through Claude Code CLI (Opus on Max plan). No API spend.
MODEL_ROUTING = {
    "light": "cli",      # Was Haiku API, now Claude Code CLI
    "cc_light": "cli",   # Claude Code CLI (unchanged)
    "heavy": "cli",      # Claude Code CLI (unchanged)
    "browser": "cli",    # Was Haiku API for summaries, now CLI
}

# Task type sets kept for routing logic (light vs cc_light vs heavy timeout)
HAIKU_TASK_TYPES = {"eval", "check", "health", "status", "ping"}
SONNET_TASK_TYPES = {
    "build", "scout", "builder", "implement", "fix", "refactor",
    "review", "analyze", "plan", "research", "audit", "inspector", "miner",
}

# ── Claude Code CLI path ────────────────────────────────────────────────
CLAUDE_CLI_PATH = os.environ.get("CLAUDE_CLI_PATH", "C:/nvm4w/nodejs/claude.cmd")

PROTECTED_PATHS = [
    "railway.json",
    "vercel.json",
    "Procfile",
    ".env",
    ".env.local",
    ".env.production",
    "**/payment/**",
    "**/auth/**",
    "**/checkout/**",
    "supabase/migrations/**",
]
