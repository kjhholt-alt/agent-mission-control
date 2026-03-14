"""
Nexus Hive Discord Bot — bidirectional swarm control from Discord.

Commands:
  !nexus status   — show swarm status
  !nexus deploy   — fire a new swarm goal
  !nexus budget   — show today's budget
  !nexus workers  — list active workers
  !nexus stop     — stop all workers
  !nexus oracle   — get latest briefing
  !nexus tasks    — show active tasks

Usage:
  pip install discord.py
  Set DISCORD_BOT_TOKEN in .env
  python -m swarm.discord_bot
  (or use scripts/nexus-discord.bat)
"""

import asyncio
import os
from datetime import datetime, timezone

import discord
from discord.ext import commands
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://ytvtaorgityczrdhhzqv.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!nexus ", intents=intents)


@bot.event
async def on_ready():
    print(f"Nexus Bot connected as {bot.user}")


@bot.command(name="status")
async def swarm_status(ctx: commands.Context):
    """Show swarm status: workers, tasks, budget."""
    try:
        workers = sb.table("swarm_workers").select("id, worker_type, status").neq("status", "dead").execute()
        tasks_running = sb.table("swarm_tasks").select("id").eq("status", "running").execute()
        tasks_queued = sb.table("swarm_tasks").select("id").eq("status", "queued").execute()

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        budget = sb.table("swarm_budgets").select("*").eq("budget_date", today).limit(1).execute()
        budget_row = budget.data[0] if budget.data else None

        active_workers = [w for w in (workers.data or []) if w["status"] in ("idle", "working")]

        embed = discord.Embed(
            title="Nexus Hive Status",
            color=0x00FFAA,
            timestamp=datetime.now(timezone.utc),
        )
        embed.add_field(name="Workers", value=f"{len(active_workers)} active", inline=True)
        embed.add_field(name="Running Tasks", value=str(len(tasks_running.data or [])), inline=True)
        embed.add_field(name="Queued Tasks", value=str(len(tasks_queued.data or [])), inline=True)

        if budget_row:
            spent = budget_row.get("api_spent_cents", 0) / 100
            limit = budget_row.get("daily_api_budget_cents", 500) / 100
            embed.add_field(name="Budget", value=f"${spent:.2f} / ${limit:.2f}", inline=True)

        await ctx.send(embed=embed)
    except Exception as e:
        await ctx.send(f"Error fetching status: {e}")


@bot.command(name="deploy")
async def deploy_goal(ctx: commands.Context, *, goal: str = ""):
    """Fire a new swarm goal. Usage: !nexus deploy Improve the PL Engine"""
    if not goal:
        await ctx.send("Usage: `!nexus deploy <goal description>`")
        return

    try:
        import uuid
        now = datetime.now(timezone.utc).isoformat()
        task = {
            "id": str(uuid.uuid4()),
            "title": goal,
            "project": "general",
            "priority": 50,
            "status": "queued",
            "task_type": "goal",
            "tier": "light",
            "input_data": {
                "prompt": goal,
                "source": "discord",
                "user": str(ctx.author),
            },
            "created_at": now,
            "retry_count": 0,
            "max_retries": 3,
        }

        result = sb.table("swarm_tasks").insert(task).execute()
        if result.data:
            await ctx.send(f"Goal queued: **{goal}**\nTask ID: `{task['id'][:8]}`")
        else:
            await ctx.send("Failed to queue goal.")
    except Exception as e:
        await ctx.send(f"Error: {e}")


@bot.command(name="budget")
async def show_budget(ctx: commands.Context):
    """Show today's budget."""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        result = sb.table("swarm_budgets").select("*").eq("budget_date", today).limit(1).execute()

        if not result.data:
            await ctx.send("No budget data for today.")
            return

        b = result.data[0]
        spent = b.get("api_spent_cents", 0) / 100
        limit = b.get("daily_api_budget_cents", 500) / 100
        pct = (spent / limit * 100) if limit > 0 else 0
        completed = b.get("tasks_completed", 0)
        failed = b.get("tasks_failed", 0)

        embed = discord.Embed(title="Budget Report", color=0xFFAA00)
        embed.add_field(name="API Spend", value=f"${spent:.2f} / ${limit:.2f} ({pct:.1f}%)", inline=False)
        embed.add_field(name="Tasks Completed", value=str(completed), inline=True)
        embed.add_field(name="Tasks Failed", value=str(failed), inline=True)
        await ctx.send(embed=embed)
    except Exception as e:
        await ctx.send(f"Error: {e}")


@bot.command(name="workers")
async def list_workers(ctx: commands.Context):
    """List active workers."""
    try:
        result = sb.table("swarm_workers").select(
            "id, worker_name, worker_type, status, current_task_id, last_heartbeat, tasks_completed, xp"
        ).neq("status", "dead").execute()

        workers = result.data or []
        if not workers:
            await ctx.send("No active workers.")
            return

        embed = discord.Embed(title="Active Workers", color=0x00AAFF)
        for w in workers[:10]:
            status_icon = {"idle": "⏸️", "working": "⚙️"}.get(w["status"], "❓")
            embed.add_field(
                name=f"{status_icon} {w['worker_name']}",
                value=f"Type: {w['worker_type']} | XP: {w.get('xp', 0)} | Tasks: {w.get('tasks_completed', 0)}",
                inline=False,
            )
        await ctx.send(embed=embed)
    except Exception as e:
        await ctx.send(f"Error: {e}")


@bot.command(name="stop")
async def stop_workers(ctx: commands.Context):
    """Stop all workers (mark as dead)."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        result = sb.table("swarm_workers").update(
            {"status": "dead", "died_at": now}
        ).neq("status", "dead").execute()

        count = len(result.data or [])
        await ctx.send(f"Stopped {count} worker(s). They will not pick up new tasks.")
    except Exception as e:
        await ctx.send(f"Error: {e}")


@bot.command(name="oracle")
async def oracle_briefing(ctx: commands.Context):
    """Get latest Oracle briefing."""
    try:
        result = sb.table("oracle_briefings").select("*").eq(
            "briefing_type", "briefing"
        ).order("created_at", desc=True).limit(1).execute()

        if not result.data:
            await ctx.send("No Oracle briefings found.")
            return

        row = result.data[0]
        data = row.get("data", {})
        if isinstance(data, str):
            import json
            data = json.loads(data)

        summary = data.get("summary", "No summary available.")
        greeting = data.get("greeting", "")

        embed = discord.Embed(
            title="Oracle Briefing",
            description=f"{greeting}\n\n{summary}",
            color=0xAA00FF,
        )

        # Add highlights if present
        highlights = data.get("highlights", [])
        if highlights:
            hl_text = "\n".join(
                f"• [{h.get('project', '?')}] {h.get('title', 'Untitled')}"
                for h in highlights[:5]
            )
            embed.add_field(name="Recent Highlights", value=hl_text, inline=False)

        await ctx.send(embed=embed)
    except Exception as e:
        await ctx.send(f"Error: {e}")


@bot.command(name="tasks")
async def list_tasks(ctx: commands.Context):
    """Show active and queued tasks."""
    try:
        running = sb.table("swarm_tasks").select(
            "id, title, project, priority, started_at"
        ).eq("status", "running").order("started_at", desc=True).limit(5).execute()

        queued = sb.table("swarm_tasks").select(
            "id, title, project, priority"
        ).eq("status", "queued").order("priority").limit(5).execute()

        embed = discord.Embed(title="Swarm Tasks", color=0x00FFAA)

        if running.data:
            r_text = "\n".join(
                f"• `{t['id'][:8]}` [{t.get('project', '?')}] {t['title']}"
                for t in running.data
            )
            embed.add_field(name=f"Running ({len(running.data)})", value=r_text, inline=False)
        else:
            embed.add_field(name="Running", value="None", inline=False)

        if queued.data:
            q_text = "\n".join(
                f"• `{t['id'][:8]}` [{t.get('project', '?')}] {t['title']} (p{t.get('priority', 50)})"
                for t in queued.data
            )
            embed.add_field(name=f"Queued ({len(queued.data)})", value=q_text, inline=False)
        else:
            embed.add_field(name="Queued", value="None", inline=False)

        await ctx.send(embed=embed)
    except Exception as e:
        await ctx.send(f"Error: {e}")


if __name__ == "__main__":
    if not DISCORD_BOT_TOKEN:
        print("ERROR: DISCORD_BOT_TOKEN not set. Add it to .env")
        exit(1)
    bot.run(DISCORD_BOT_TOKEN)
