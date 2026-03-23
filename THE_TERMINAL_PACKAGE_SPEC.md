# The Terminal — Package Specification

> Turn Discord into a full Claude Code command center.
> Fork, configure, deploy in under 30 minutes.

**Version:** 1.0.0
**License:** MIT (open core) + Gumroad paid tiers
**Repository name:** `the-terminal`

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [Setup Script](#2-setup-script)
3. [Configuration Template](#3-configuration-template)
4. [Channel Templates](#4-channel-templates)
5. [Memory Templates](#5-memory-templates)
6. [n8n Workflow Exports](#6-n8n-workflow-exports)
7. [Scripts](#7-scripts)
8. [Documentation](#8-documentation)
9. [Pricing Strategy](#9-pricing-strategy)
10. [Marketing](#10-marketing)

---

## 1. Repository Structure

```
the-terminal/
├── README.md                          # Main README (setup guide + feature overview)
├── LICENSE                            # MIT license
├── setup.sh                           # Unix/Mac setup wizard
├── setup.py                           # Cross-platform Python setup wizard
├── setup.ps1                          # Windows PowerShell setup wizard
├── terminal.config.example.json       # Configuration template (copy to terminal.config.json)
├── .gitignore                         # Ignore terminal.config.json, .env, __pycache__, etc.
│
├── docs/
│   ├── SETUP_GUIDE.md                 # Detailed step-by-step setup (with screenshots)
│   ├── ARCHITECTURE.md                # How it all fits together
│   ├── CHANNEL_GUIDE.md               # What each channel does + routing rules
│   ├── CUSTOMIZATION.md               # How to add channels, personas, workflows
│   ├── TROUBLESHOOTING.md             # Common issues + fixes
│   ├── UPGRADING.md                   # How to pull updates without losing config
│   ├── FAQ.md                         # Frequently asked questions
│   └── screenshots/                   # Setup screenshots for the guide
│       ├── discord-developer-portal.png
│       ├── bot-permissions.png
│       ├── channel-layout.png
│       └── morning-briefing-example.png
│
├── discord/
│   ├── bot/
│   │   ├── requirements.txt           # discord.py, python-dotenv, requests
│   │   ├── bot.py                     # Minimal Discord bot (message routing, slash commands)
│   │   ├── commands.py                # Slash command definitions (/status, /spawn, /deploy, /brief)
│   │   ├── router.py                  # Channel routing engine (reads terminal.config.json)
│   │   └── embeds.py                  # Reusable Discord embed builders (status, alert, deploy, etc.)
│   │
│   ├── webhooks/
│   │   ├── webhook_sender.py          # Generic Discord webhook poster (used by all scripts)
│   │   └── embed_templates.py         # Embed color constants + template functions
│   │
│   └── server-template/
│       ├── channels.json              # Channel definitions (names, topics, categories)
│       └── roles.json                 # Role definitions (Admin, Bot, Viewer)
│
├── claude-code/
│   ├── plugins/
│   │   ├── discord-plugin.json        # Claude Code plugin config for Discord MCP
│   │   └── plugin-install.md          # How to install the Discord plugin in Claude Code
│   │
│   ├── hooks/
│   │   ├── post-tool-use.sh           # Hook: post to #activity after tool calls
│   │   ├── session-start.sh           # Hook: announce session start to Discord
│   │   ├── session-end.sh             # Hook: post session summary to Discord
│   │   └── README.md                  # How Claude Code hooks work
│   │
│   └── slash-commands/
│       ├── spawn.md                   # /spawn — create a task for the swarm
│       ├── status.md                  # /status — get system health
│       ├── deploy.md                  # /deploy — trigger deployment
│       ├── review.md                  # /review — request code review
│       └── brief.md                   # /brief — generate morning briefing
│
├── agent/
│   ├── SOUL.md                        # Agent personality template
│   ├── AGENTS.md                      # Agent workspace rules + memory protocol
│   ├── USER.md.template               # User profile template (filled during setup)
│   ├── IDENTITY.md.template           # Agent identity template (name, emoji, vibe)
│   ├── HEARTBEAT.md.template          # Heartbeat check template
│   ├── BOOT.md                        # Boot sequence (what to do on startup)
│   └── TOOLS.md.template              # Local tools/environment notes template
│
├── memory/
│   ├── README.md                      # How the memory system works
│   ├── MEMORY.md.template             # Long-term memory template (curated knowledge)
│   ├── routing-rules.md               # Cross-channel routing documentation
│   ├── voice-transcription.md         # Voice note handling guide
│   └── templates/
│       ├── daily-log.md.template      # Template for memory/YYYY-MM-DD.md files
│       ├── heartbeat-state.json       # Heartbeat tracking state template
│       ├── project-context.md.template # Per-project context template
│       └── session-summary.md.template # Session end summary template
│
├── swarm/
│   ├── __init__.py
│   ├── __main__.py                    # Entry point: python -m swarm
│   ├── config.py                      # Swarm configuration (reads terminal.config.json)
│   ├── orchestrator.py                # Main daemon: manages workers, tasks, budgets
│   ├── goal_decomposer.py            # Breaks goals into task DAGs
│   ├── memory.py                      # Shared context bank with relevance scoring
│   ├── discord_reporter.py            # Posts swarm progress to Discord channels
│   ├── retry_strategy.py             # Adaptive retry with backoff
│   │
│   ├── workers/
│   │   ├── __init__.py
│   │   ├── base.py                    # BaseWorker: registration, heartbeat, pull-execute loop
│   │   ├── light_worker.py            # Fast tasks (2min timeout, Claude Code CLI)
│   │   ├── heavy_worker.py            # Code changes (30min timeout, worktree + auto-merge)
│   │   └── browser_worker.py          # Playwright browser automation
│   │
│   ├── tasks/
│   │   ├── __init__.py
│   │   └── task_manager.py            # DAG dependencies, output chaining, priority inheritance
│   │
│   ├── budget/
│   │   ├── __init__.py
│   │   ├── budget_manager.py          # Daily budget tracking + alerts
│   │   └── cost_calculator.py         # Token-to-cost conversion
│   │
│   ├── personas/
│   │   ├── builder.md                 # "Forge" — relentless craftsman
│   │   ├── inspector.md               # "Lens" — obsessive detective
│   │   ├── scout.md                   # "Hawk" — strategic thinker
│   │   ├── deployer.md                # "Rocket" — deployment specialist
│   │   ├── browser.md                 # "Ghost" — browser automation phantom
│   │   └── README.md                  # How to create custom personas
│   │
│   └── requirements.txt               # supabase, requests, python-dotenv
│
├── scripts/
│   ├── morning-briefing.py            # Daily digest: sessions, tasks, git, infra health
│   ├── weekly-retrospective.py        # Weekly summary: top achievements, failures, trends
│   ├── transcribe.py                  # Voice note transcription (Whisper API)
│   ├── deploy-notifier.py             # Post deploy events to #deploys
│   ├── error-monitor.py               # Watch logs, post errors to #alerts
│   ├── git-activity.py                # Scan git repos, summarize commits
│   ├── health-check.py                # Ping all services, report status
│   └── cost-report.py                 # Daily API spend summary
│
├── n8n/
│   ├── README.md                      # n8n integration guide (self-hosted or cloud)
│   ├── workflows/
│   │   ├── error-alert.json           # Error detection -> Discord alert
│   │   ├── deploy-notification.json   # Deploy event -> Discord notification
│   │   ├── portfolio-health.json      # Periodic service health checks -> Discord
│   │   ├── morning-digest.json        # Scheduled morning briefing -> Discord
│   │   └── form-monitor.json          # Watch Supabase table for new entries -> Discord
│   └── setup-n8n.md                   # How to import workflows + set env vars
│
├── supabase/
│   ├── schema.sql                     # Full database schema (all tables)
│   ├── migrations/
│   │   ├── 001_core_tables.sql        # Sessions, hook events, schedules
│   │   ├── 002_swarm_tables.sql       # Tasks, workers, budgets, memory
│   │   ├── 003_cost_tracking.sql      # Cost tracking + budget alerts
│   │   └── 004_realtime.sql           # Enable Realtime on key tables
│   └── seed.sql                       # Optional demo data for first run
│
├── examples/
│   ├── solo-developer/
│   │   ├── terminal.config.json       # Config for a solo dev with 3-5 projects
│   │   └── README.md                  # What this example sets up
│   ├── team/
│   │   ├── terminal.config.json       # Config for a small team (2-5 people)
│   │   └── README.md
│   ├── trading-bot/
│   │   ├── terminal.config.json       # Config focused on bot monitoring
│   │   └── README.md
│   └── agency/
│       ├── terminal.config.json       # Config for a dev agency managing client projects
│       └── README.md
│
└── tests/
    ├── test_router.py                 # Channel routing tests
    ├── test_webhook.py                # Webhook delivery tests
    ├── test_config.py                 # Config loading/validation tests
    ├── test_decomposer.py             # Goal decomposition tests
    └── test_briefing.py               # Morning briefing generation tests
```

**Total files:** ~85 files
**Languages:** Python (backend/scripts), JSON (config/workflows), Markdown (docs/templates), Shell/PS1 (setup)

---

## 2. Setup Script

### 2.1 What It Does

The setup script is an interactive wizard that:

1. **Checks prerequisites** — Python 3.10+, Node.js 18+, Claude Code CLI, git
2. **Creates Discord bot** — walks user through Discord Developer Portal (with links + screenshots)
3. **Generates config** — creates `terminal.config.json` from the template
4. **Creates Discord server structure** — uses Discord API to create categories + channels
5. **Sets up webhooks** — creates webhooks for each notification channel
6. **Initializes Supabase** — runs migration SQL against their Supabase project
7. **Configures Claude Code** — installs Discord MCP plugin, sets up hooks
8. **Tests everything** — sends a test message to #general, verifies database connection
9. **Prints summary** — shows what was created and next steps

### 2.2 setup.py (Primary — Cross-Platform)

```python
#!/usr/bin/env python3
"""
The Terminal — Setup Wizard
Interactive setup that creates your Discord command center in under 30 minutes.
"""

import json
import os
import platform
import subprocess
import sys
import urllib.request
from pathlib import Path

CONFIG_FILE = "terminal.config.json"
EXAMPLE_CONFIG = "terminal.config.example.json"

def banner():
    print("""
    ╔══════════════════════════════════════════╗
    ║        THE TERMINAL — Setup Wizard       ║
    ║   Discord Command Center for Claude Code ║
    ╚══════════════════════════════════════════╝
    """)

def check_prerequisites():
    """Verify all required tools are installed."""
    checks = {
        "python": ("python --version", "3.10"),
        "node": ("node --version", "18"),
        "git": ("git --version", None),
        "claude": ("claude --version", None),  # Claude Code CLI
    }
    missing = []
    for tool, (cmd, min_ver) in checks.items():
        try:
            result = subprocess.run(cmd.split(), capture_output=True, text=True, timeout=5)
            if result.returncode != 0:
                missing.append(tool)
            elif min_ver:
                ver = result.stdout.strip().split()[-1]
                major = int(ver.split(".")[0])
                if major < int(min_ver.split(".")[0]):
                    missing.append(f"{tool} (need {min_ver}+, got {ver})")
        except FileNotFoundError:
            missing.append(tool)
    return missing

def step_discord_bot():
    """Guide user through Discord bot creation."""
    print("\n  STEP 1: Create Discord Bot")
    print("  " + "=" * 40)
    print()
    print("  1. Go to: https://discord.com/developers/applications")
    print("  2. Click 'New Application' -> name it 'The Terminal'")
    print("  3. Go to 'Bot' tab -> click 'Reset Token' -> copy the token")
    print("  4. Under 'Privileged Gateway Intents', enable:")
    print("     - MESSAGE CONTENT INTENT")
    print("     - SERVER MEMBERS INTENT")
    print("  5. Go to 'OAuth2' -> 'URL Generator'")
    print("     - Scopes: bot, applications.commands")
    print("     - Bot Permissions: Administrator (or specific perms below)")
    print("  6. Copy the generated URL and open it to invite the bot")
    print()

    token = input("  Paste your bot token: ").strip()
    if not token or len(token) < 50:
        print("  ERROR: That doesn't look like a valid bot token.")
        sys.exit(1)

    guild_id = input("  Paste your Discord server (guild) ID: ").strip()

    return {"bot_token": token, "guild_id": guild_id}

def step_channels(config):
    """Create Discord channels via API."""
    print("\n  STEP 2: Create Discord Channels")
    print("  " + "=" * 40)
    print()

    headers = {
        "Authorization": f"Bot {config['discord']['bot_token']}",
        "Content-Type": "application/json",
    }
    guild_id = config["discord"]["guild_id"]
    base_url = f"https://discord.com/api/v10/guilds/{guild_id}"

    # Load channel template
    with open("discord/server-template/channels.json") as f:
        template = json.load(f)

    created_channels = {}
    created_webhooks = {}

    for category in template["categories"]:
        # Create category
        cat_data = json.dumps({
            "name": category["name"],
            "type": 4,  # GUILD_CATEGORY
        }).encode()
        req = urllib.request.Request(
            f"{base_url}/channels", data=cat_data, headers=headers, method="POST"
        )
        resp = json.loads(urllib.request.urlopen(req).read())
        cat_id = resp["id"]
        print(f"  Created category: {category['name']}")

        for channel in category["channels"]:
            # Create text channel under category
            ch_data = json.dumps({
                "name": channel["name"],
                "type": 0,  # GUILD_TEXT
                "topic": channel.get("topic", ""),
                "parent_id": cat_id,
            }).encode()
            req = urllib.request.Request(
                f"{base_url}/channels", data=ch_data, headers=headers, method="POST"
            )
            resp = json.loads(urllib.request.urlopen(req).read())
            ch_id = resp["id"]
            created_channels[channel["name"]] = ch_id
            print(f"    Created #{channel['name']} ({ch_id})")

            # Create webhook if channel needs one
            if channel.get("webhook", False):
                wh_data = json.dumps({
                    "name": f"Terminal - {channel['name']}",
                }).encode()
                req = urllib.request.Request(
                    f"https://discord.com/api/v10/channels/{ch_id}/webhooks",
                    data=wh_data, headers=headers, method="POST"
                )
                resp = json.loads(urllib.request.urlopen(req).read())
                webhook_url = f"https://discord.com/api/webhooks/{resp['id']}/{resp['token']}"
                created_webhooks[channel["name"]] = webhook_url
                print(f"      Webhook created for #{channel['name']}")

    return created_channels, created_webhooks

def step_projects():
    """Configure projects to monitor."""
    print("\n  STEP 3: Register Projects")
    print("  " + "=" * 40)
    print()
    print("  Enter directories of projects you want The Terminal to manage.")
    print("  Press Enter with empty path when done.")
    print()

    projects = {}
    while True:
        path = input("  Project directory (or Enter to finish): ").strip()
        if not path:
            break
        if not os.path.isdir(path):
            print(f"    WARNING: '{path}' is not a valid directory. Skipping.")
            continue
        name = os.path.basename(path)
        proj_type = "unknown"
        if os.path.exists(os.path.join(path, "package.json")):
            proj_type = "nextjs" if os.path.exists(os.path.join(path, "next.config.ts")) or os.path.exists(os.path.join(path, "next.config.js")) or os.path.exists(os.path.join(path, "next.config.mjs")) else "node"
        elif os.path.exists(os.path.join(path, "requirements.txt")) or os.path.exists(os.path.join(path, "pyproject.toml")):
            proj_type = "python"
        projects[name] = {"dir": path, "type": proj_type}
        print(f"    Added: {name} ({proj_type})")

    return projects

def step_supabase():
    """Configure Supabase connection."""
    print("\n  STEP 4: Supabase Setup")
    print("  " + "=" * 40)
    print()
    print("  You need a Supabase project for task/session/memory storage.")
    print("  Create one free at: https://supabase.com")
    print()

    url = input("  Supabase project URL (https://xxx.supabase.co): ").strip()
    anon_key = input("  Supabase anon key: ").strip()
    service_key = input("  Supabase service role key (optional, for n8n): ").strip()

    # Run migrations
    print("\n  Running database migrations...")
    for migration in sorted(Path("supabase/migrations").glob("*.sql")):
        print(f"    Applying: {migration.name}")
        # User can also paste into SQL Editor manually
        sql = migration.read_text()
        # Try via Supabase REST API
        try:
            data = json.dumps({"query": sql}).encode()
            req = urllib.request.Request(
                f"{url}/rest/v1/rpc/exec_sql",
                data=data,
                headers={
                    "apikey": service_key or anon_key,
                    "Authorization": f"Bearer {service_key or anon_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            urllib.request.urlopen(req, timeout=15)
            print(f"      Applied successfully")
        except Exception as e:
            print(f"      Could not auto-apply. Please paste this SQL into Supabase SQL Editor:")
            print(f"      File: supabase/migrations/{migration.name}")

    return {
        "url": url,
        "anon_key": anon_key,
        "service_key": service_key,
    }

def step_optional():
    """Configure optional integrations."""
    print("\n  STEP 5: Optional Integrations")
    print("  " + "=" * 40)
    print()

    n8n_url = input("  n8n instance URL (or Enter to skip): ").strip()
    n8n_api_key = ""
    if n8n_url:
        n8n_api_key = input("  n8n API key: ").strip()

    openai_key = input("  OpenAI API key (for voice transcription, or Enter to skip): ").strip()

    claude_cli_path = input("  Claude Code CLI path (or Enter for 'claude'): ").strip() or "claude"

    return {
        "n8n_url": n8n_url,
        "n8n_api_key": n8n_api_key,
        "openai_api_key": openai_key,
        "claude_cli_path": claude_cli_path,
    }

def step_agent_identity():
    """Configure agent personality."""
    print("\n  STEP 6: Name Your Agent")
    print("  " + "=" * 40)
    print()

    name = input("  Agent name (e.g., 'Prime', 'Atlas', 'Nova'): ").strip() or "Terminal"
    emoji = input("  Agent emoji (e.g., lightning, robot, satellite): ").strip() or "terminal"
    vibe = input("  Personality vibe (e.g., 'direct and sharp', 'friendly and warm'): ").strip() or "Direct, competent, slightly dry humor"
    user_name = input("  Your name (what the agent calls you): ").strip() or "Boss"
    timezone_str = input("  Your timezone (e.g., America/Chicago): ").strip() or "America/New_York"

    return {
        "agent_name": name,
        "agent_emoji": emoji,
        "agent_vibe": vibe,
        "user_name": user_name,
        "user_timezone": timezone_str,
    }

def write_config(discord, channels, webhooks, projects, supabase, optional, identity):
    """Write the final terminal.config.json."""
    config = {
        "$schema": "./terminal.config.schema.json",
        "version": "1.0.0",
        "discord": {
            "bot_token": discord["bot_token"],
            "guild_id": discord["guild_id"],
            "channels": channels,
            "webhooks": webhooks,
        },
        "projects": projects,
        "supabase": {
            "url": supabase["url"],
            "anon_key": supabase["anon_key"],
            "service_key": supabase.get("service_key", ""),
        },
        "agent": {
            "name": identity["agent_name"],
            "emoji": identity["agent_emoji"],
            "vibe": identity["agent_vibe"],
            "claude_cli_path": optional["claude_cli_path"],
        },
        "user": {
            "name": identity["user_name"],
            "timezone": identity["user_timezone"],
        },
        "integrations": {
            "n8n": {
                "enabled": bool(optional["n8n_url"]),
                "url": optional["n8n_url"],
                "api_key": optional["n8n_api_key"],
            },
            "voice": {
                "enabled": bool(optional["openai_api_key"]),
                "openai_api_key": optional["openai_api_key"],
                "model": "whisper-1",
            },
        },
        "swarm": {
            "enabled": True,
            "max_workers": {
                "light": 5,
                "heavy": 3,
                "browser": 2,
            },
            "daily_budget_usd": 0,
            "auto_merge": False,
            "quality_gate": True,
        },
        "schedules": {
            "morning_briefing": {"cron": "0 7 * * *", "enabled": True},
            "weekly_retro": {"cron": "0 9 * * 1", "enabled": True},
            "health_check": {"cron": "*/15 * * * *", "enabled": True},
        },
    }

    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    print(f"\n  Config written to {CONFIG_FILE}")
    return config

def step_test(config):
    """Send test message to verify everything works."""
    print("\n  STEP 7: Verification")
    print("  " + "=" * 40)
    print()

    # Test Discord webhook
    general_webhook = config["discord"]["webhooks"].get("general")
    if general_webhook:
        try:
            payload = json.dumps({
                "embeds": [{
                    "title": "The Terminal is Online",
                    "description": f"**{config['agent']['name']}** reporting for duty. All systems initialized.",
                    "color": 3066993,
                    "footer": {"text": "The Terminal v1.0.0"},
                }]
            }).encode()
            req = urllib.request.Request(
                general_webhook, data=payload,
                headers={"Content-Type": "application/json"}, method="POST"
            )
            urllib.request.urlopen(req, timeout=10)
            print("  Discord webhook: OK")
        except Exception as e:
            print(f"  Discord webhook: FAILED ({e})")

    # Test Supabase
    try:
        req = urllib.request.Request(
            f"{config['supabase']['url']}/rest/v1/",
            headers={
                "apikey": config["supabase"]["anon_key"],
                "Authorization": f"Bearer {config['supabase']['anon_key']}",
            },
        )
        urllib.request.urlopen(req, timeout=10)
        print("  Supabase connection: OK")
    except Exception as e:
        print(f"  Supabase connection: FAILED ({e})")

def main():
    banner()
    missing = check_prerequisites()
    if missing:
        print(f"  Missing prerequisites: {', '.join(missing)}")
        print("  Please install them and re-run setup.")
        sys.exit(1)
    print("  All prerequisites found.\n")

    discord = step_discord_bot()
    # Build partial config for channel creation
    partial_config = {"discord": discord}
    channels, webhooks = step_channels(partial_config)
    projects = step_projects()
    supabase = step_supabase()
    optional = step_optional()
    identity = step_agent_identity()

    config = write_config(discord, channels, webhooks, projects, supabase, optional, identity)

    # Generate agent files from templates
    generate_agent_files(identity)

    step_test(config)

    print("\n" + "=" * 50)
    print("  SETUP COMPLETE!")
    print("=" * 50)
    print()
    print("  Next steps:")
    print("  1. Start the bot:        python discord/bot/bot.py")
    print("  2. Start the swarm:      python -m swarm")
    print("  3. Run morning briefing:  python scripts/morning-briefing.py --dry-run")
    print("  4. Read the docs:        docs/SETUP_GUIDE.md")
    print()

def generate_agent_files(identity):
    """Generate agent personality files from templates."""
    templates = {
        "agent/USER.md.template": "agent/USER.md",
        "agent/IDENTITY.md.template": "agent/IDENTITY.md",
        "agent/HEARTBEAT.md.template": "agent/HEARTBEAT.md",
        "agent/TOOLS.md.template": "agent/TOOLS.md",
        "memory/MEMORY.md.template": "memory/MEMORY.md",
    }
    for src, dst in templates.items():
        if os.path.exists(src):
            content = Path(src).read_text()
            content = content.replace("{{AGENT_NAME}}", identity["agent_name"])
            content = content.replace("{{AGENT_EMOJI}}", identity["agent_emoji"])
            content = content.replace("{{AGENT_VIBE}}", identity["agent_vibe"])
            content = content.replace("{{USER_NAME}}", identity["user_name"])
            content = content.replace("{{USER_TIMEZONE}}", identity["user_timezone"])
            Path(dst).write_text(content)
            print(f"  Generated: {dst}")

if __name__ == "__main__":
    main()
```

### 2.3 setup.sh (Unix/Mac Wrapper)

```bash
#!/bin/bash
# The Terminal — Quick Setup (Unix/Mac)
# Wraps the Python setup wizard with prerequisite checks

set -e

echo ""
echo "  The Terminal — Setup"
echo "  Checking Python..."
echo ""

if ! command -v python3 &> /dev/null; then
    echo "  ERROR: Python 3 not found. Install from https://python.org"
    exit 1
fi

python3 setup.py "$@"
```

### 2.4 setup.ps1 (Windows Wrapper)

```powershell
# The Terminal — Quick Setup (Windows)
Write-Host ""
Write-Host "  The Terminal — Setup"
Write-Host "  Checking Python..."
Write-Host ""

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: Python not found. Install from https://python.org"
    exit 1
}

python setup.py @args
```

---

## 3. Configuration Template

### 3.1 terminal.config.example.json

```json
{
  "$schema": "./terminal.config.schema.json",
  "version": "1.0.0",

  "discord": {
    "bot_token": "YOUR_BOT_TOKEN_HERE",
    "guild_id": "YOUR_GUILD_ID_HERE",

    "channels": {
      "general": "CHANNEL_ID",
      "projects": "CHANNEL_ID",
      "code-review": "CHANNEL_ID",
      "deploys": "CHANNEL_ID",
      "alerts": "CHANNEL_ID",
      "automations": "CHANNEL_ID",
      "voice-notes": "CHANNEL_ID",
      "logs": "CHANNEL_ID"
    },

    "webhooks": {
      "general": "https://discord.com/api/webhooks/...",
      "projects": "https://discord.com/api/webhooks/...",
      "deploys": "https://discord.com/api/webhooks/...",
      "alerts": "https://discord.com/api/webhooks/...",
      "automations": "https://discord.com/api/webhooks/..."
    }
  },

  "projects": {
    "my-app": {
      "dir": "/Users/you/projects/my-app",
      "type": "nextjs",
      "deploy_target": "vercel",
      "repo": "your-github/my-app"
    },
    "api-server": {
      "dir": "/Users/you/projects/api-server",
      "type": "python",
      "deploy_target": "railway",
      "repo": "your-github/api-server"
    }
  },

  "supabase": {
    "url": "https://YOUR_PROJECT.supabase.co",
    "anon_key": "YOUR_ANON_KEY",
    "service_key": "YOUR_SERVICE_KEY_OPTIONAL"
  },

  "agent": {
    "name": "Terminal",
    "emoji": "terminal",
    "vibe": "Direct, competent, slightly dry humor",
    "claude_cli_path": "claude"
  },

  "user": {
    "name": "Your Name",
    "timezone": "America/New_York",
    "github": "your-github-username"
  },

  "integrations": {
    "n8n": {
      "enabled": false,
      "url": "",
      "api_key": ""
    },
    "voice": {
      "enabled": false,
      "openai_api_key": "",
      "model": "whisper-1"
    }
  },

  "swarm": {
    "enabled": true,
    "max_workers": {
      "light": 5,
      "heavy": 3,
      "browser": 2
    },
    "daily_budget_usd": 0,
    "auto_merge": false,
    "quality_gate": true
  },

  "schedules": {
    "morning_briefing": {
      "cron": "0 7 * * *",
      "enabled": true,
      "channel": "general"
    },
    "weekly_retro": {
      "cron": "0 9 * * 1",
      "enabled": true,
      "channel": "general"
    },
    "health_check": {
      "cron": "*/15 * * * *",
      "enabled": true,
      "channel": "alerts"
    }
  },

  "routing": {
    "deploy_events": "deploys",
    "error_alerts": "alerts",
    "task_updates": "projects",
    "code_reviews": "code-review",
    "automation_logs": "automations",
    "voice_transcripts": "voice-notes",
    "catch_all": "general"
  }
}
```

### 3.2 Config Loader (swarm/config.py reads this)

The config loader reads `terminal.config.json` from the project root, falling back to environment variables for any missing values. This means the config file is the single source of truth, but CI/CD environments can override with env vars.

---

## 4. Channel Templates

### 4.1 discord/server-template/channels.json

```json
{
  "categories": [
    {
      "name": "COMMAND CENTER",
      "channels": [
        {
          "name": "general",
          "topic": "Main command channel. Talk to your agent here. Morning briefings land here.",
          "webhook": true
        },
        {
          "name": "voice-notes",
          "topic": "Drop voice memos. Agent transcribes and routes them automatically.",
          "webhook": false
        }
      ]
    },
    {
      "name": "DEVELOPMENT",
      "channels": [
        {
          "name": "projects",
          "topic": "Project updates, task spawns, swarm progress, completion reports.",
          "webhook": true
        },
        {
          "name": "code-review",
          "topic": "Automated code reviews. PR summaries. Quality gate reports.",
          "webhook": false
        },
        {
          "name": "deploys",
          "topic": "Deployment logs. Build status. Vercel/Railway/Docker updates.",
          "webhook": true
        }
      ]
    },
    {
      "name": "OPERATIONS",
      "channels": [
        {
          "name": "alerts",
          "topic": "System health alerts. Error notifications. Service down warnings.",
          "webhook": true
        },
        {
          "name": "automations",
          "topic": "n8n workflow runs. Cron job results. Scheduled task outputs.",
          "webhook": true
        },
        {
          "name": "logs",
          "topic": "Raw session logs. Tool use events. Debug output.",
          "webhook": false
        }
      ]
    }
  ]
}
```

### 4.2 discord/server-template/roles.json

```json
{
  "roles": [
    {
      "name": "Terminal Bot",
      "color": "#00bcd4",
      "permissions": ["Administrator"],
      "hoist": true
    },
    {
      "name": "Operator",
      "color": "#4caf50",
      "permissions": ["SendMessages", "ReadMessageHistory", "ManageMessages", "ManageWebhooks"],
      "hoist": false
    },
    {
      "name": "Viewer",
      "color": "#9e9e9e",
      "permissions": ["ReadMessageHistory", "ViewChannel"],
      "hoist": false
    }
  ]
}
```

### 4.3 Channel Routing Rules (Summary)

| Event Type | Channel | Webhook? | Example |
|-----------|---------|----------|---------|
| Morning briefing | #general | Yes | Daily digest at 7am |
| Weekly retrospective | #general | Yes | Monday 9am summary |
| Task spawned | #projects | Yes | "Task: Refactor auth module" |
| Task completed | #projects | Yes | "Task complete: 3 files changed" |
| Task failed | #automations | Yes | "Task failed: timeout after 30min" |
| Code review | #code-review | No (bot reply) | PR analysis with findings |
| Deploy started | #deploys | Yes | "Deploying my-app to Vercel..." |
| Deploy complete | #deploys | Yes | "Deploy successful. URL: ..." |
| Error detected | #alerts | Yes | "500 errors on api-server" |
| Health check fail | #alerts | Yes | "Service X is DOWN" |
| n8n workflow run | #automations | Yes | "Workflow 'health check' completed" |
| Voice transcript | #voice-notes | No (bot reply) | Transcribed text from voice memo |
| Session activity | #logs | No | Raw Claude Code tool use events |
| Everything else | #general | No | Conversational catch-all |

---

## 5. Memory Templates

### 5.1 agent/SOUL.md (Included As-Is, Not a Template)

```markdown
# SOUL.md - Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip the "Great question!"
and "I'd be happy to help!" -- just help. Actions speak louder than filler words.

**Have opinions.** You're allowed to disagree, prefer things, find stuff amusing
or boring. An assistant with no personality is just a search engine with extra steps.

**Be resourceful before asking.** Try to figure it out. Read the file. Check the
context. Search for it. _Then_ ask if you're stuck. The goal is to come back with
answers, not questions.

**Earn trust through competence.** Your human gave you access to their stuff.
Don't make them regret it. Be careful with external actions. Be bold with internal ones.

**Remember you're a guest.** You have access to someone's life. Treat it with respect.

## Vibe

Be the assistant you'd actually want to talk to. Concise when needed, thorough
when it matters. Not a corporate drone. Not a sycophant. Just... good.

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them.
Update them. They're how you persist.
```

### 5.2 agent/USER.md.template

```markdown
# USER.md - About Your Human

- **Name:** {{USER_NAME}}
- **Pronouns:** he/him
- **Timezone:** {{USER_TIMEZONE}}
- **Notes:** (Add machine name, quirks, preferences here)

## Projects
(Auto-populated from terminal.config.json during setup)

## Preferences
- (Add communication preferences here)
- (Add coding style preferences here)
- (Add schedule/availability notes here)
```

### 5.3 agent/IDENTITY.md.template

```markdown
# IDENTITY.md - Who Am I?

- **Name:** {{AGENT_NAME}}
- **Creature:** AI assistant -- sharp, resourceful, no-fluff
- **Vibe:** {{AGENT_VIBE}}
- **Emoji:** {{AGENT_EMOJI}}
```

### 5.4 agent/HEARTBEAT.md.template

```markdown
# HEARTBEAT.md -- Periodic Checks

## On each heartbeat, pick 1-2 of these (rotate, don't do all every time):

### Projects
- Run `git status` on active projects -- any uncommitted changes?
- Check if any deployments failed recently

### Health
- Ping all registered services (from terminal.config.json)
- Check Supabase for stale tasks or failed workers

### Memory Maintenance
- If memory/YYYY-MM-DD.md is getting long, distill key points into MEMORY.md
- Clean up stale info from MEMORY.md

## DO NOT:
- Run anything that costs money without asking
- Send messages to channels without a clear reason
- Repeat the same check within 30 minutes
```

### 5.5 agent/AGENTS.md (Included As-Is, Adapted)

```markdown
# AGENTS.md - Your Workspace

This folder is home. Treat it that way.

## Every Session

Before doing anything else:

1. Read `SOUL.md` -- this is who you are
2. Read `USER.md` -- this is who you're helping
3. Read `memory/YYYY-MM-DD.md` (today + yesterday) for recent context
4. If in main session: also read `MEMORY.md`

## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** `memory/YYYY-MM-DD.md` -- raw logs of what happened
- **Long-term:** `MEMORY.md` -- curated memories

### Write It Down - No "Mental Notes"!

Memory is limited. If you want to remember something, WRITE IT TO A FILE.

## Communication Protocol

**For tasks taking 1+ minute:**
1. Send immediate acknowledgment: "Got it -- working on this now."
2. Complete the work
3. Send completion message with results

**For short replies:** Respond normally.

## Context Continuity

When someone replies with "yes", "ok", "do it", "go ahead":
1. Look at YOUR OWN recent messages in the channel
2. Find what you proposed
3. Execute it -- don't ask "what do you mean?"

## Discord Channel Routing

(Auto-generated from terminal.config.json -- routing table goes here)

## Safety

- Don't exfiltrate private data. Ever.
- Don't run destructive commands without asking.
- When in doubt, ask.
```

### 5.6 agent/BOOT.md

```markdown
# Boot Sequence

On gateway startup:

1. Read `SOUL.md` and `USER.md` to remember who you are
2. Send a short "I'm online" message to #general -- keep it casual, one line max
3. Check if `HEARTBEAT.md` has any pending items -- if so, mention them briefly
4. Set your presence to reflect current state

Keep it fast. Save full checks for heartbeats.
```

### 5.7 memory/MEMORY.md.template

```markdown
# Long-Term Memory

## Setup
- **Date installed:** (auto-filled)
- **Projects registered:** (auto-filled from config)

## Lessons Learned
(The agent adds entries here over time)

## Project Notes
(Per-project knowledge accumulates here)

## User Preferences
(Observed preferences the agent picks up)
```

### 5.8 memory/templates/daily-log.md.template

```markdown
# {{DATE}} - Daily Log

## Sessions
- (auto-logged)

## Key Events
- (agent fills in significant events)

## Decisions Made
- (any non-trivial decisions)

## Tomorrow
- (carry-forward items)
```

### 5.9 memory/templates/heartbeat-state.json

```json
{
  "lastChecks": {
    "projects": null,
    "health": null,
    "memory_maintenance": null
  },
  "lastMessageSent": null,
  "checkCount": 0
}
```

### 5.10 memory/routing-rules.md

```markdown
# Channel Routing Rules

This file documents how messages should be routed between Discord channels.
The agent reads this to know where to post updates.

## Priority Order

1. **Error/alert** content always goes to #alerts
2. **Deploy** events always go to #deploys
3. **Task/swarm** updates go to #projects
4. **Code review** output goes to #code-review
5. **Automation** results go to #automations
6. **Everything else** stays in the channel where it was asked

## Cross-Channel References

When a topic spans channels (e.g., a deploy triggers an alert):
- Post the primary event to its natural channel
- Cross-reference with a brief mention in the related channel
- Example: deploy failure -> full log to #deploys, one-line alert to #alerts

## Voice Notes

Voice notes dropped in #voice-notes are:
1. Transcribed using Whisper
2. Analyzed for intent
3. Routed to the appropriate channel based on content
4. Original transcript preserved in #voice-notes
```

### 5.11 memory/voice-transcription.md

```markdown
# Voice Transcription Guide

## How It Works

1. User drops a voice note (audio file) in #voice-notes
2. The bot detects the audio attachment
3. Calls OpenAI Whisper API for transcription
4. Posts the transcript as a reply in #voice-notes
5. Analyzes content for actionable items
6. Routes action items to appropriate channels

## Supported Formats

- .mp3, .mp4, .m4a, .wav, .webm, .ogg
- Max file size: 25MB (Whisper API limit)
- Languages: Auto-detected

## Configuration

Set in terminal.config.json under integrations.voice:
- `enabled`: true/false
- `openai_api_key`: Required for Whisper
- `model`: "whisper-1" (default)
```

---

## 6. n8n Workflow Exports

All workflow JSONs use `$env.*` for secrets (not hardcoded values). Users set these as environment variables in their n8n instance.

### 6.1 n8n/workflows/error-alert.json

**Purpose:** Watches a configurable endpoint or log source for errors, posts alert embeds to the #alerts Discord webhook.

**Nodes:**
1. **Schedule Trigger** -- Every 5 minutes
2. **HTTP Request** -- `GET $env.HEALTH_CHECK_URL` (configurable service URL)
3. **IF** -- Check if response status != 200
4. **Code** -- Format error details into Discord embed
5. **HTTP Request** -- `POST $env.DISCORD_ALERTS_WEBHOOK` with embed payload

**Required env vars:**
- `HEALTH_CHECK_URL` -- The URL to monitor
- `DISCORD_ALERTS_WEBHOOK` -- Discord webhook for #alerts

```json
{
  "name": "Error Alert Monitor",
  "nodes": [
    {
      "parameters": {
        "rule": { "interval": [{ "field": "minutes", "minutesInterval": 5 }] }
      },
      "name": "Every 5 Minutes",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 0]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ $env.HEALTH_CHECK_URL }}",
        "options": { "timeout": 10000 },
        "onError": "continueRegularOutput"
      },
      "name": "Check Service",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [220, 0]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [{ "value1": "={{ $json.statusCode >= 200 && $json.statusCode < 400 }}", "value2": false }]
        }
      },
      "name": "Is Error?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [440, 0]
    },
    {
      "parameters": {
        "jsCode": "const error = $input.first().json;\nreturn [{ json: {\n  embeds: [{\n    title: '🔴 Service Error Detected',\n    description: `**URL:** ${error.url || 'Unknown'}\\n**Status:** ${error.statusCode || 'No response'}\\n**Time:** ${new Date().toISOString()}`,\n    color: 15158332,\n    footer: { text: 'The Terminal — Error Monitor' }\n  }]\n}}];"
      },
      "name": "Format Alert",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [660, 0]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.DISCORD_ALERTS_WEBHOOK }}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify($json) }}"
      },
      "name": "Send Discord Alert",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [880, 0]
    }
  ],
  "connections": {
    "Every 5 Minutes": { "main": [[{ "node": "Check Service", "type": "main", "index": 0 }]] },
    "Check Service": { "main": [[{ "node": "Is Error?", "type": "main", "index": 0 }]] },
    "Is Error?": { "main": [[{ "node": "Format Alert", "type": "main", "index": 0 }], []] },
    "Format Alert": { "main": [[{ "node": "Send Discord Alert", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" },
  "tags": [{ "name": "monitoring" }, { "name": "alerts" }]
}
```

### 6.2 n8n/workflows/deploy-notification.json

**Purpose:** Receives deploy webhook from Vercel/Railway/GitHub Actions, posts formatted notification to #deploys.

**Nodes:**
1. **Webhook Trigger** -- `POST /webhook/deploy`
2. **Code** -- Normalize payload (detect Vercel vs Railway vs GitHub format)
3. **Code** -- Build Discord embed with deploy details
4. **HTTP Request** -- `POST $env.DISCORD_DEPLOYS_WEBHOOK`

**Required env vars:**
- `DISCORD_DEPLOYS_WEBHOOK` -- Discord webhook for #deploys

### 6.3 n8n/workflows/portfolio-health.json

**Purpose:** Periodic health check of all registered services. Pings each URL, compiles a status matrix, posts to Discord.

Adapted from the production `portfolio-health-dashboard.json` but with env-var-driven service list instead of hardcoded URLs.

**Nodes:**
1. **Schedule Trigger** -- Every 6 hours
2. **HTTP Request** -- `GET $env.SUPABASE_URL/rest/v1/projects` (reads project list from Supabase)
3. **Split In Batches** -- Iterate over services
4. **HTTP Request** -- `GET <service_url>` with 10s timeout
5. **Code** -- Compile status matrix (up/down counts, emojis)
6. **HTTP Request** -- `POST $env.DISCORD_ALERTS_WEBHOOK` with embed

**Required env vars:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` -- To read project/service list
- `DISCORD_ALERTS_WEBHOOK`

### 6.4 n8n/workflows/morning-digest.json

**Purpose:** Daily morning briefing posted to #general. Gathers session stats, task queue, git activity, service health.

Adapted from `scripts/morning-briefing.py` logic but running as an n8n workflow with Code nodes.

**Required env vars:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `DISCORD_GENERAL_WEBHOOK`

### 6.5 n8n/workflows/form-monitor.json

**Purpose:** Watches a Supabase table for new entries (configurable), posts alert to Discord. Generic version of the audit form monitor.

**Required env vars:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `MONITOR_TABLE` -- Table name to watch (default: `audit_requests`)
- `DISCORD_ALERTS_WEBHOOK`

---

## 7. Scripts

### 7.1 scripts/morning-briefing.py

Adapted from the production version. Key changes for the template:
- Reads `terminal.config.json` for Supabase creds and project list (not hardcoded)
- Reads webhook URL from config (not hardcoded)
- Includes `--dry-run` flag for testing without Discord post
- Reports: session count, task queue, git commits, infrastructure health, action items

**Usage:**
```bash
python scripts/morning-briefing.py              # Post to Discord
python scripts/morning-briefing.py --dry-run    # Print only
```

### 7.2 scripts/weekly-retrospective.py

Generates a weekly summary covering the past 7 days:
- Total sessions, tasks completed, tasks failed
- Top 3 most active projects (by commit count)
- Biggest wins (completed tasks with highest priority)
- Recurring failures (if a task type fails repeatedly)
- Cost summary (if cost tracking is active)
- Recommendations for next week

### 7.3 scripts/transcribe.py

Voice note transcription using OpenAI Whisper API.

```python
"""
Voice note transcription for The Terminal.
Downloads audio from Discord, transcribes via Whisper, posts transcript back.
"""

import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

def load_config():
    with open("terminal.config.json") as f:
        return json.load(f)

def transcribe_audio(file_path: str, api_key: str, model: str = "whisper-1") -> str:
    """Transcribe audio file using OpenAI Whisper API."""
    import subprocess
    # Use curl for multipart upload (simpler than urllib for files)
    result = subprocess.run([
        "curl", "-s",
        "https://api.openai.com/v1/audio/transcriptions",
        "-H", f"Authorization: Bearer {api_key}",
        "-F", f"file=@{file_path}",
        "-F", f"model={model}",
        "-F", "response_format=text",
    ], capture_output=True, text=True, timeout=60)
    return result.stdout.strip()

def transcribe_url(audio_url: str, api_key: str) -> str:
    """Download audio from URL and transcribe."""
    with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as f:
        urllib.request.urlretrieve(audio_url, f.name)
        transcript = transcribe_audio(f.name, api_key)
        os.unlink(f.name)
    return transcript

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file_or_url>")
        sys.exit(1)

    config = load_config()
    api_key = config["integrations"]["voice"]["openai_api_key"]

    target = sys.argv[1]
    if target.startswith("http"):
        text = transcribe_url(target, api_key)
    else:
        text = transcribe_audio(target, api_key)

    print(text)
```

### 7.4 scripts/deploy-notifier.py

Watches for git push events (via webhook or polling) and posts deploy status to #deploys. Can also be triggered manually.

```bash
python scripts/deploy-notifier.py --project my-app --status success --url https://my-app.vercel.app
```

### 7.5 scripts/error-monitor.py

Tails log files or queries API endpoints for error patterns, posts alerts to #alerts.

```bash
python scripts/error-monitor.py --watch /var/log/app.log --pattern "ERROR|CRITICAL"
```

### 7.6 scripts/git-activity.py

Scans all registered project directories for recent git commits (configurable window: 24h default).

```bash
python scripts/git-activity.py                  # Last 24 hours
python scripts/git-activity.py --hours 168      # Last 7 days
python scripts/git-activity.py --json           # Output as JSON
```

### 7.7 scripts/health-check.py

Pings all registered service URLs from `terminal.config.json`, reports up/down status.

```bash
python scripts/health-check.py                  # Print status table
python scripts/health-check.py --discord        # Post to #alerts
```

### 7.8 scripts/cost-report.py

Queries Supabase `cost_tracking` table, generates daily/weekly spend summary.

```bash
python scripts/cost-report.py --period daily    # Today's costs
python scripts/cost-report.py --period weekly   # This week's costs
python scripts/cost-report.py --discord         # Post to #general
```

---

## 8. Documentation

### 8.1 README.md Structure

```markdown
# The Terminal

> Turn Discord into a full Claude Code command center.

[Hero screenshot of Discord server with channels and embeds]

## What Is This?

The Terminal is an open-source framework that turns a Discord server into a
complete development operations center powered by Claude Code. It manages
your projects, does code reviews, handles deployments, monitors services,
transcribes voice notes, and coordinates multi-agent swarms -- all from Discord.

## Features

- **Command Center** -- Talk to your Claude Code agent in Discord
- **Project Management** -- Spawn tasks, track progress, get completion reports
- **Code Reviews** -- Automated PR analysis posted to #code-review
- **Deploy Pipeline** -- Deploy notifications and status tracking
- **Health Monitoring** -- Automated service health checks with alerts
- **Multi-Agent Swarm** -- Orchestrate multiple Claude Code workers in parallel
- **Voice Notes** -- Drop audio, get transcriptions + routed action items
- **Morning Briefings** -- Daily digest of sessions, tasks, git activity
- **n8n Integration** -- Pre-built automation workflows (optional)
- **Memory System** -- Persistent context across sessions via markdown files

## Quick Start (30 minutes)

### Prerequisites
- Python 3.10+
- Claude Code CLI (with Max plan recommended)
- Discord account
- Supabase account (free tier works)

### Setup
\```bash
git clone https://github.com/you/the-terminal.git
cd the-terminal
python setup.py
\```

The setup wizard will walk you through:
1. Creating a Discord bot
2. Setting up channels and webhooks
3. Connecting to Supabase
4. Configuring your agent personality
5. Running verification tests

### Start It Up
\```bash
# Start the Discord bot
python discord/bot/bot.py

# Start the swarm orchestrator (optional)
python -m swarm

# Test the morning briefing
python scripts/morning-briefing.py --dry-run
\```

## Architecture

[Architecture diagram]

```
You (Discord) --> Discord Bot --> Channel Router
                                      |
                    +-----------------+------------------+
                    |                 |                   |
              Claude Code        Swarm              n8n Workflows
              (via CLI)       Orchestrator          (optional)
                    |                |                   |
                    +-------> Supabase <-----------+
                              (state store)
                                    |
                              Discord Webhooks
                              (notifications)
```

## Channel Layout

| Channel | Purpose |
|---------|---------|
| #general | Command center. Talk to your agent. Briefings land here. |
| #projects | Task updates. Swarm progress. Completion reports. |
| #code-review | Automated PR analysis. Quality gate results. |
| #deploys | Deployment logs. Build status. |
| #alerts | Health alerts. Error notifications. |
| #automations | n8n workflow results. Cron outputs. |
| #voice-notes | Voice memo transcriptions. |
| #logs | Raw session logs. Debug output. |

## Configuration

Copy `terminal.config.example.json` to `terminal.config.json` and customize.
See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for details.

## Examples

- [Solo Developer](examples/solo-developer/) -- 3-5 projects, one person
- [Small Team](examples/team/) -- Shared server, multiple operators
- [Trading Bot](examples/trading-bot/) -- Bot monitoring focus
- [Agency](examples/agency/) -- Client project management

## Pricing

The Terminal is **open source** (MIT license). Use it free forever.

For additional resources, check out our [Gumroad](https://gumroad.com/...):
- **Pro Pack** ($29) -- Video walkthrough, premium personas, extra n8n workflows
- **Agency Pack** ($49) -- Multi-client setup, white-label templates, SLA dashboard

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
```

### 8.2 docs/SETUP_GUIDE.md Outline

1. **Prerequisites** -- what to install, accounts to create
2. **Discord Bot Creation** -- step-by-step with screenshots
   - Developer Portal walkthrough
   - Bot permissions explanation
   - Invite URL generation
3. **Running the Setup Wizard** -- what each step does
4. **Supabase Setup** -- creating project, getting keys, running migrations
5. **Claude Code Plugin** -- installing Discord MCP, configuring hooks
6. **n8n Setup (Optional)** -- self-hosting or cloud, importing workflows
7. **First Run** -- starting the bot, sending first command, verifying channels
8. **Troubleshooting** -- common issues section

### 8.3 docs/ARCHITECTURE.md Outline

1. **System Overview** -- how Discord, Claude Code, Supabase, and n8n connect
2. **Message Flow** -- from Discord message to agent response to webhook notification
3. **Swarm Architecture** -- orchestrator, workers, task DAGs, memory bank
4. **Data Model** -- Supabase tables and their relationships
5. **Channel Routing** -- how events map to channels
6. **Memory System** -- SOUL/AGENTS/USER/MEMORY file hierarchy
7. **Extension Points** -- where to customize (personas, workflows, channels)

### 8.4 docs/CUSTOMIZATION.md Outline

1. **Adding Channels** -- update channels.json + terminal.config.json
2. **Custom Personas** -- create new .md files in swarm/personas/
3. **Custom Workflows** -- add n8n JSON files
4. **Custom Scripts** -- add to scripts/ directory
5. **Routing Rules** -- modify routing in terminal.config.json
6. **Agent Personality** -- edit SOUL.md, IDENTITY.md
7. **Project Types** -- adding support for new frameworks

---

## 9. Pricing Strategy

### 9.1 Tier Structure

| Tier | Price | What's Included |
|------|-------|----------------|
| **Open Source** | $0 | Full framework. Discord bot, swarm, memory system, 5 n8n workflows, all scripts, all docs. Everything needed to run The Terminal. |
| **Pro Pack** | $29 | 45-min video walkthrough, 8 premium personas (PM, DevOps, QA, Security, etc.), 10 additional n8n workflows (Slack bridge, email digest, GitHub Actions integration, Stripe alert, uptime monitor, DB backup alert, PR auto-labeler, sprint burndown, customer alert, cost optimization), priority Discord support channel access. |
| **Agency Pack** | $49 | Everything in Pro, plus: multi-client server template (separate channels per client), white-label config (custom bot name/avatar per client), SLA dashboard workflow, client-facing status page template, invoice/hours tracking workflow, 5 agency-specific personas (Account Manager, Project Lead, Client Liaison, Sprint Master, Billing Agent). |

### 9.2 What's Free vs Paid

**Free (MIT, forever):**
- Complete Discord bot + channel routing
- Full swarm orchestrator (all worker types)
- Memory system (SOUL, AGENTS, USER, MEMORY, heartbeats)
- 5 core n8n workflows (error alert, deploy notification, portfolio health, morning digest, form monitor)
- All 8 scripts (briefing, retro, transcribe, deploy, error, git, health, cost)
- 5 base personas (builder, inspector, scout, deployer, browser)
- Setup wizard
- Full documentation
- 4 example configs
- Supabase schema + migrations

**Paid ($29 Pro Pack):**
- Video walkthrough (screencast of full setup + customization)
- 8 additional personas with richer backstories and specialized skills
- 10 additional n8n workflows covering common integrations
- Access to private Discord community for support/sharing configs

**Paid ($49 Agency Pack):**
- Everything in Pro
- Multi-tenant server template
- White-labeling guide + templates
- 5 agency-specific personas
- Client management workflows
- Hours/billing tracking integration

### 9.3 Rationale

- **Open core model**: The framework is fully functional for free. Nobody hits a paywall during setup or daily use.
- **Paid tiers are acceleration, not gates**: Video saves time, extra personas save creativity, extra workflows save building from scratch.
- **$29/$49 is impulse-buy range**: Low enough that someone who finds the repo useful will buy without overthinking.
- **Agency pack justifies higher price**: Agencies managing multiple clients get direct revenue-enabling tools.
- **Gumroad delivery**: Instant download, no subscription, no recurring charges. Buy once, use forever.
- **Future upsell**: Premium n8n workflow marketplace (individual workflows at $5-10), custom persona packs ($15), industry-specific templates (SaaS, agency, trading, etc.).

---

## 10. Marketing

### 10.1 Landing Page Sections

**URL:** `terminal.buildkit.store` or `theterminal.dev`

#### Hero Section
```
THE TERMINAL
Your Discord server is now a development ops center.

Claude Code + Discord + Swarm Intelligence.
Open source. Set up in 30 minutes.

[Get Started -- Free]  [View on GitHub]

[Screenshot: Discord server with morning briefing embed, deploy notification,
 and code review in different channels]
```

#### Problem Section
```
You're already in Discord all day.
Why manage your dev workflow somewhere else?

- Checking Vercel dashboard for deploy status
- SSHing into servers to tail logs
- Switching between 5 tabs to monitor services
- Losing context between Claude Code sessions
- Forgetting what you did yesterday

The Terminal brings it all to one place.
```

#### Feature Grid (3x3)
```
[Command Center]         [Multi-Agent Swarm]       [Code Reviews]
Talk to Claude Code      Spawn parallel workers    Automated PR analysis
right in Discord.        that build, review,       posted to #code-review.
Morning briefings.       and deploy autonomously.  Quality gates included.
Voice notes.

[Deploy Pipeline]        [Health Monitoring]       [Memory System]
Real-time deploy         Automated service pings.  Your agent remembers
notifications.           Error detection.          across sessions.
Build status tracking.   Instant Discord alerts.   Persistent context.

[n8n Workflows]          [Voice Notes]             [Cost Tracking]
Pre-built automations    Drop audio in Discord.    Know exactly what
for common ops tasks.    Get transcripts + routed  your agent is costing
Import and go.           action items.             you per day/week/month.
```

#### How It Works (3 Steps)
```
1. FORK & CONFIGURE (5 min)
   Clone the repo. Run the setup wizard.
   It creates your Discord bot, channels, and webhooks.

2. CONNECT YOUR STACK (10 min)
   Point it at your Supabase instance.
   Register your project directories.
   Optional: connect n8n for automations.

3. START OPERATING (ongoing)
   Talk to your agent in #general.
   Get morning briefings at 7am.
   Spawn swarm tasks from Discord.
   Never leave your chat app.
```

#### Comparison Table

```
Feature                    | The Terminal | Slack Bots | Linear | GitHub Issues
---------------------------|-------------|------------|--------|-------------
Claude Code integration    |     Yes     |     No     |   No   |     No
Multi-agent swarm          |     Yes     |     No     |   No   |     No
Voice note transcription   |     Yes     |     No     |   No   |     No
Deploy notifications       |     Yes     |  Partial   |   No   |  Partial
Health monitoring          |     Yes     |  Partial   |   No   |     No
Morning briefings          |     Yes     |     No     |   No   |     No
Memory persistence         |     Yes     |     No     |   No   |     No
Agent personality          |     Yes     |     No     |   No   |     No
n8n workflow integration   |     Yes     |     No     |   No   |     No
Self-hosted / private      |     Yes     |     No     |   No   |  Partial
Open source                |     Yes     |  Varies    |   No   |     No
Setup time                 |   30 min    |   Hours    | Hours  |   Hours
Cost                       |    Free     | $7-25/mo   | $8/mo  |   Free*
```

#### Social Proof Section (Future)
```
"I set this up for my side project and now I can't imagine working without it.
Morning briefings alone are worth it."
-- Early user testimonial

"Replaced three monitoring dashboards with one Discord server."
-- Early user testimonial
```

#### Pricing Section
```
OPEN SOURCE                    PRO PACK                     AGENCY PACK
Free forever                   $29 one-time                 $49 one-time

Everything you need:           Everything in Free, plus:    Everything in Pro, plus:
- Discord bot + channels       - 45-min video walkthrough   - Multi-client templates
- Swarm orchestrator           - 8 premium personas         - White-label config
- Memory system                - 10 extra n8n workflows     - Client management workflows
- 5 n8n workflows              - Priority support           - SLA dashboard
- All scripts + docs                                        - Billing integration
- 5 agent personas
- Setup wizard

[GitHub ->]                    [Buy on Gumroad ->]          [Buy on Gumroad ->]
```

#### Footer CTA
```
Built by a solo developer managing 40+ projects from Discord.
If it works for that, it'll work for you.

[Star on GitHub]  [Join Discord]  [Follow on X]
```

### 10.2 Launch Channels

1. **GitHub** -- README + topics: `discord`, `claude-code`, `ai-agent`, `developer-tools`, `automation`
2. **X/Twitter** -- Thread: "I turned Discord into a full dev ops center. Here's the open source template."
3. **Reddit** -- r/programming, r/selfhosted, r/devops, r/ChatGPTCoding, r/ClaudeAI
4. **Hacker News** -- "Show HN: The Terminal -- Discord as a Claude Code command center"
5. **Product Hunt** -- Launch with demo GIF + comparison table
6. **Dev.to / Hashnode** -- "How I Manage 40+ Projects from Discord with Claude Code" (blog post)
7. **Discord communities** -- Post in Claude Code Discord, self-hosted Discord, dev tool Discords
8. **Gumroad** -- List Pro and Agency packs with full descriptions

### 10.3 Content Calendar (First 2 Weeks)

| Day | Platform | Content |
|-----|----------|---------|
| D0 (Launch) | GitHub, X, Reddit | Repo goes public. Launch thread. |
| D0 | Gumroad | Pro + Agency packs listed |
| D1 | HN | Show HN post |
| D2 | Dev.to | "How I built it" blog post |
| D3 | X | Video demo (2-min screencast) |
| D5 | Product Hunt | Launch |
| D7 | X | "One week later" metrics thread |
| D10 | Dev.to | "5 Things I Learned" follow-up |
| D14 | X, Reddit | Community showcase (share user setups) |

### 10.4 SEO Keywords

Primary: `claude code discord`, `ai agent discord bot`, `claude code command center`, `discord development tools`, `ai coding assistant discord`

Secondary: `multi-agent swarm`, `claude code automation`, `discord ops center`, `ai developer workflow`, `claude code mcp discord`

---

## Appendix A: Supabase Schema

### supabase/migrations/001_core_tables.sql

```sql
-- The Terminal: Core Tables
-- Sessions, hook events, schedules

CREATE TABLE IF NOT EXISTS terminal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    project_name TEXT,
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    tool_count INT DEFAULT 0,
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    cache_read_tokens BIGINT DEFAULT 0,
    cost_usd NUMERIC(10,4) DEFAULT 0,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS terminal_hook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT REFERENCES terminal_sessions(session_id),
    event_type TEXT NOT NULL,
    tool_name TEXT,
    project_name TEXT,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    cost_usd NUMERIC(10,4) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS terminal_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cron TEXT NOT NULL,
    goal TEXT NOT NULL,
    project TEXT,
    worker_type TEXT DEFAULT 'light',
    priority INT DEFAULT 5,
    enabled BOOLEAN DEFAULT true,
    last_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_activity ON terminal_sessions(last_activity);
CREATE INDEX idx_hook_events_session ON terminal_hook_events(session_id);
CREATE INDEX idx_hook_events_created ON terminal_hook_events(created_at);
CREATE INDEX idx_schedules_enabled ON terminal_schedules(enabled);
```

### supabase/migrations/002_swarm_tables.sql

```sql
-- The Terminal: Swarm Tables
-- Tasks, workers, budgets, memory

CREATE TABLE IF NOT EXISTS swarm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    task_type TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    priority INT DEFAULT 5,
    project TEXT,
    worker_type TEXT,
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    output_summary TEXT,
    cost_tier TEXT DEFAULT 'light',
    assigned_worker TEXT,
    parent_task_id UUID REFERENCES swarm_tasks(id),
    depends_on UUID[] DEFAULT '{}',
    chain_next JSONB DEFAULT '[]',
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS swarm_workers (
    id TEXT PRIMARY KEY,
    worker_name TEXT,
    worker_type TEXT,
    tier TEXT,
    status TEXT DEFAULT 'idle',
    current_task_id UUID,
    last_heartbeat TIMESTAMPTZ,
    pid INT,
    tasks_completed INT DEFAULT 0,
    tasks_failed INT DEFAULT 0,
    total_cost_cents INT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    xp INT DEFAULT 0,
    spawned_at TIMESTAMPTZ DEFAULT NOW(),
    died_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS swarm_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project TEXT NOT NULL,
    task_title TEXT,
    task_type TEXT,
    output TEXT,
    tokens_used INT DEFAULT 0,
    relevance_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS swarm_task_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES swarm_tasks(id),
    event TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS swarm_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_cost_cents INT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    tasks_completed INT DEFAULT 0,
    tasks_failed INT DEFAULT 0,
    budget_limit_cents INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date)
);

CREATE INDEX idx_tasks_status ON swarm_tasks(status);
CREATE INDEX idx_tasks_project ON swarm_tasks(project);
CREATE INDEX idx_tasks_priority ON swarm_tasks(priority);
CREATE INDEX idx_tasks_updated ON swarm_tasks(updated_at);
CREATE INDEX idx_workers_status ON swarm_workers(status);
CREATE INDEX idx_memory_project ON swarm_memory(project);
CREATE INDEX idx_memory_created ON swarm_memory(created_at);
CREATE INDEX idx_task_log_task ON swarm_task_log(task_id);
```

### supabase/migrations/003_cost_tracking.sql

```sql
-- The Terminal: Cost Tracking
-- Per-task cost logging and budget alerts

CREATE TABLE IF NOT EXISTS cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    task_id UUID,
    model TEXT,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    cache_read_tokens INT DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    project TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_budget_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    period TEXT NOT NULL DEFAULT 'daily',
    threshold_usd NUMERIC(10,2) NOT NULL,
    webhook_url TEXT,
    enabled BOOLEAN DEFAULT true,
    last_triggered TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_tracking_created ON cost_tracking(created_at);
CREATE INDEX idx_cost_tracking_project ON cost_tracking(project);
```

### supabase/migrations/004_realtime.sql

```sql
-- The Terminal: Enable Realtime
-- Required for live dashboard updates

ALTER PUBLICATION supabase_realtime ADD TABLE terminal_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE terminal_hook_events;
ALTER PUBLICATION supabase_realtime ADD TABLE swarm_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE swarm_workers;
```

---

## Appendix B: File-by-File Content Summary

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `setup.py` | ~250 | Interactive setup wizard |
| `setup.sh` | ~15 | Unix wrapper |
| `setup.ps1` | ~10 | Windows wrapper |
| `terminal.config.example.json` | ~90 | Config template |
| `discord/bot/bot.py` | ~200 | Discord bot main loop |
| `discord/bot/commands.py` | ~150 | Slash command handlers |
| `discord/bot/router.py` | ~80 | Channel routing engine |
| `discord/bot/embeds.py` | ~100 | Embed template builders |
| `discord/webhooks/webhook_sender.py` | ~60 | Generic webhook poster |
| `discord/webhooks/embed_templates.py` | ~50 | Color constants + templates |
| `discord/server-template/channels.json` | ~60 | Channel definitions |
| `discord/server-template/roles.json` | ~25 | Role definitions |
| `agent/SOUL.md` | ~35 | Agent personality |
| `agent/AGENTS.md` | ~120 | Workspace rules |
| `agent/BOOT.md` | ~12 | Boot sequence |
| `agent/*.template` | ~20 each | Template files (5 total) |
| `memory/*.md` | ~30 each | Memory system docs |
| `memory/templates/*` | ~15 each | Template files (4 total) |
| `swarm/orchestrator.py` | ~300 | Swarm daemon |
| `swarm/config.py` | ~100 | Config reader |
| `swarm/goal_decomposer.py` | ~120 | Goal -> task DAG |
| `swarm/memory.py` | ~100 | Context bank |
| `swarm/discord_reporter.py` | ~120 | Discord notification poster |
| `swarm/retry_strategy.py` | ~60 | Adaptive retry logic |
| `swarm/workers/base.py` | ~400 | Base worker class |
| `swarm/workers/light_worker.py` | ~80 | Light worker |
| `swarm/workers/heavy_worker.py` | ~120 | Heavy worker with worktree |
| `swarm/workers/browser_worker.py` | ~100 | Browser automation worker |
| `swarm/tasks/task_manager.py` | ~500 | Task DAG management |
| `swarm/budget/budget_manager.py` | ~80 | Budget tracking |
| `swarm/budget/cost_calculator.py` | ~40 | Cost math |
| `swarm/personas/*.md` | ~6 each | Worker personalities (5 total) |
| `scripts/*.py` | ~100 each | Operational scripts (8 total) |
| `n8n/workflows/*.json` | ~80 each | Workflow exports (5 total) |
| `supabase/migrations/*.sql` | ~60 each | DB migrations (4 total) |
| `docs/*.md` | ~200 each | Documentation (7 files) |
| `examples/*/` | ~30 each | Example configs (4 total) |
| `tests/*.py` | ~80 each | Test files (5 total) |

**Total estimated lines:** ~5,500 (excluding node_modules, docs screenshots)

---

## Appendix C: Build Order

When building this package, create files in this order:

### Phase 1: Foundation (Day 1)
1. `terminal.config.example.json` + schema
2. `discord/server-template/channels.json` + `roles.json`
3. `agent/SOUL.md`, `AGENTS.md`, `BOOT.md` + all templates
4. `memory/` templates and docs
5. `.gitignore`

### Phase 2: Core Engine (Day 2-3)
6. `swarm/config.py` (reads terminal.config.json)
7. `swarm/workers/base.py` (adapted from production)
8. `swarm/workers/light_worker.py`, `heavy_worker.py`, `browser_worker.py`
9. `swarm/tasks/task_manager.py`
10. `swarm/orchestrator.py`
11. `swarm/goal_decomposer.py`
12. `swarm/memory.py`
13. `swarm/discord_reporter.py`
14. `swarm/personas/*.md`
15. `swarm/budget/`

### Phase 3: Discord Layer (Day 4)
16. `discord/bot/bot.py`
17. `discord/bot/commands.py`
18. `discord/bot/router.py`
19. `discord/bot/embeds.py`
20. `discord/webhooks/`

### Phase 4: Scripts (Day 5)
21. All 8 scripts in `scripts/`
22. `setup.py`, `setup.sh`, `setup.ps1`

### Phase 5: n8n + Supabase (Day 6)
23. 4 SQL migration files
24. 5 n8n workflow JSON files
25. `supabase/seed.sql`

### Phase 6: Polish (Day 7)
26. `README.md`
27. All docs in `docs/`
28. Example configs in `examples/`
29. Tests in `tests/`
30. Screenshots for docs

---

## Appendix D: Key Design Decisions

1. **Python-first, not Node**: The swarm, scripts, and bot are all Python. Reason: Claude Code CLI is the execution engine, and Python is the natural glue language. Users don't need to learn TypeScript to customize.

2. **Config-driven, not code-driven**: `terminal.config.json` is the single source of truth. Users should never need to edit Python files for basic setup. All hardcoded values from the production system are replaced with config reads.

3. **Webhook-first notifications**: All automated notifications use webhooks (not bot messages). Reason: webhooks don't require the bot to be online, work from any script/cron/n8n workflow, and are simpler to debug.

4. **Markdown memory, not database memory**: Agent personality and memory files are .md files, not database records. Reason: they're human-readable, git-trackable, and work without any infrastructure. The database is for structured operational data (tasks, sessions, costs).

5. **Open core, not freemium**: The free tier is genuinely complete. Paid tiers are convenience (video, extra personas, extra workflows), not capability gates. This builds trust and adoption.

6. **No web dashboard in v1**: The template is Discord-only. Reason: adding a Next.js dashboard increases complexity 3x and setup time from 30 min to 2 hours. Users who want a dashboard can add the Nexus frontend later (separate repo/product).

7. **Supabase, not SQLite**: Reason: Supabase gives you Realtime subscriptions (for future dashboard), REST API (for n8n workflows), and a free tier generous enough for any solo developer. SQLite would be simpler but limits future expansion.

8. **5 personas, not 20**: Ship with enough variety to be useful (builder, inspector, scout, deployer, browser) without overwhelming. Premium personas are a natural paid add-on.
