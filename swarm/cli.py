"""
CLI entry point for the swarm system.

Usage:
    python -m swarm "Improve the PL Engine continuously"
    python -m swarm --status
    python -m swarm --stop
    python -m swarm --budget
    python -m swarm --workers
    python -m swarm --tasks
"""

import argparse
import logging
import sys

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

console = Console()

# ── Logging setup ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)


def show_status():
    """Display swarm status."""
    from swarm.orchestrator import SwarmOrchestrator

    try:
        orch = SwarmOrchestrator()
        status = orch.get_status()
    except Exception as e:
        console.print(f"[red]Error connecting to swarm: {e}[/red]")
        return

    # Workers table
    w = status["workers"]
    workers_table = Table(title="Workers", show_lines=True)
    workers_table.add_column("Metric", style="cyan")
    workers_table.add_column("Value", style="green")
    workers_table.add_row("Total Active", str(w["total"]))
    workers_table.add_row("Light Workers", str(w["light"]))
    workers_table.add_row("CC Light Workers", str(w.get("cc_light", 0)))
    workers_table.add_row("Heavy Workers", str(w["heavy"]))

    # Tasks summary
    t = status["tasks"]
    tasks_table = Table(title="Tasks", show_lines=True)
    tasks_table.add_column("Status", style="cyan")
    tasks_table.add_column("Count", style="green")
    tasks_table.add_row("Queued", str(t["queued"]))
    tasks_table.add_row("Running", str(t["running"]))
    tasks_table.add_row("Blocked", str(t["blocked"]))
    tasks_table.add_row("Pending", str(t["pending"]))

    # Budget
    b = status["budget"]
    budget_table = Table(title="Budget", show_lines=True)
    budget_table.add_column("Metric", style="cyan")
    budget_table.add_column("Value", style="green")
    budget_table.add_row(
        "API Spend",
        f"${b['api_spent_cents']/100:.2f} / ${b['daily_api_budget_cents']/100:.2f} ({b['api_pct']:.1f}%)",
    )
    budget_table.add_row(


    )
    budget_table.add_row(
        "Tasks Today",
        f"{b['tasks_completed']} completed / {b['tasks_failed']} failed",
    )

    console.print()
    console.print(Panel(Text("SWARM STATUS", style="bold white"), style="blue"))
    console.print(workers_table)
    console.print(tasks_table)
    console.print(budget_table)
    console.print()


def show_budget():
    """Display budget details."""
    from swarm.budget.budget_manager import BudgetManager

    try:
        bm = BudgetManager()
        b = bm.get_status()
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        return

    table = Table(title=f"Budget for {b['date']}", show_lines=True)
    table.add_column("Metric", style="cyan")
    table.add_column("Used", style="yellow")
    table.add_column("Limit", style="green")
    table.add_column("Pct", style="red" if b["api_pct"] > 80 else "green")

    table.add_row(
        "API Spend",
        f"${b['api_spent_cents']/100:.2f}",
        f"${b['daily_api_budget_cents']/100:.2f}",
        f"{b['api_pct']:.1f}%",
    )
    table.add_row(



        f"{b['cc_pct']:.1f}%",
    )
    table.add_row(
        "Tasks",
        f"{b['tasks_completed']} OK / {b['tasks_failed']} fail",
        "-",
        "-",
    )

    console.print()
    console.print(table)
    console.print()


def show_workers():
    """List active workers."""
    from swarm.orchestrator import SwarmOrchestrator

    try:
        orch = SwarmOrchestrator()
        workers = orch._get_active_workers()
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        return

    if not workers:
        console.print("[yellow]No active workers[/yellow]")
        return

    table = Table(title="Active Workers", show_lines=True)
    table.add_column("ID", style="cyan", max_width=8)
    table.add_column("Name", style="white")
    table.add_column("Type", style="green")
    table.add_column("Tier", style="blue")
    table.add_column("Status", style="yellow")
    table.add_column("Tasks", style="magenta")
    table.add_column("XP", style="green")
    table.add_column("PID")

    for w in workers:
        table.add_row(
            w["id"][:8],
            w.get("worker_name", "?"),
            w.get("worker_type", "?"),
            w.get("tier", "?"),
            w.get("status", "?"),
            f"{w.get('tasks_completed', 0)}/{w.get('tasks_failed', 0)}",
            str(w.get("xp", 0)),
            str(w.get("pid", "?")),
        )

    console.print()
    console.print(table)
    console.print()


def show_tasks():
    """List pending tasks."""
    from swarm.tasks.task_manager import TaskManager

    try:
        tm = TaskManager()
        tasks = tm.get_all_active()
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        return

    if not tasks:
        console.print("[yellow]No active tasks[/yellow]")
        return

    table = Table(title="Active Tasks", show_lines=True)
    table.add_column("ID", style="cyan", max_width=8)
    table.add_column("Type", style="green")
    table.add_column("Title", style="white", max_width=40)
    table.add_column("Project", style="blue")
    table.add_column("Tier", style="magenta")
    table.add_column("Priority", style="yellow")
    table.add_column("Status", style="red")

    for t in tasks:
        table.add_row(
            t["id"][:8],
            t.get("task_type", "?"),
            (t.get("title") or "?")[:40],
            t.get("project", "?"),
            t.get("cost_tier", "?"),
            str(t.get("priority", "?")),
            t.get("status", "?"),
        )

    console.print()
    console.print(table)
    console.print()


def stop_swarm():
    """Stop all workers."""
    from swarm.orchestrator import SwarmOrchestrator

    try:
        orch = SwarmOrchestrator()
        orch.shutdown_all()
        console.print("[green]All workers stopped[/green]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


def run_goal(goal: str):
    """Decompose a goal into tasks and optionally start the orchestrator."""
    from swarm.goal_decomposer import GoalDecomposer

    console.print(f"\n[bold blue]Decomposing goal:[/bold blue] {goal}\n")

    try:
        decomposer = GoalDecomposer()
        tasks = decomposer.decompose(goal)
    except Exception as e:
        console.print(f"[red]Error decomposing goal: {e}[/red]")
        return

    console.print(f"[green]Created {len(tasks)} tasks:[/green]\n")

    table = Table(show_lines=True)
    table.add_column("ID", style="cyan", max_width=8)
    table.add_column("Type", style="green")
    table.add_column("Title", style="white", max_width=50)
    table.add_column("Tier", style="magenta")
    table.add_column("Priority", style="yellow")
    table.add_column("Status", style="blue")

    for t in tasks:
        table.add_row(
            t["id"][:8],
            t.get("task_type", "?"),
            (t.get("title") or "?")[:50],
            t.get("cost_tier", "?"),
            str(t.get("priority", "?")),
            t.get("status", "?"),
        )

    console.print(table)
    console.print(
        "\n[dim]Tasks created. Run 'python -m swarm --run' to start the orchestrator.[/dim]\n"
    )


def run_orchestrator():
    """Start the swarm orchestrator (foreground, stops on Ctrl+C)."""
    from swarm.orchestrator import SwarmOrchestrator

    console.print("[bold green]Starting swarm orchestrator...[/bold green]")
    orch = SwarmOrchestrator()
    orch.run()


def run_daemon():
    """Start the Nexus Hive as a persistent 24/7 daemon."""
    from swarm.daemon import run_daemon as _run_daemon

    _run_daemon()


def analyze_video(url: str, frames: int = 8, deep: bool = False, playwright: bool = False):
    """Analyze a Twitter/X video."""
    import importlib.util
    from pathlib import Path

    tools_dir = Path(__file__).parent.parent / "tools"
    spec = importlib.util.spec_from_file_location("twitter_video", tools_dir / "twitter-video.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    model = "claude-sonnet-4-5-20250514" if deep else "claude-haiku-4-5-20251001"

    result = mod.analyze_video(
        url=url,
        num_frames=frames,
        model=model,
        use_playwright=playwright,
    )

    console.print()
    console.print(Panel(Text("VIDEO ANALYSIS", style="bold white"), style="blue"))
    console.print(f"[cyan]Source:[/cyan]  {result['url']}")
    console.print(f"[cyan]Author:[/cyan] @{result['author']}")
    console.print(f"[cyan]Title:[/cyan]  {result['title']}")
    console.print(f"[cyan]Method:[/cyan] {result['method']}")
    console.print()
    console.print(result["analysis"])
    console.print()

    # Store in swarm memory if available
    try:
        from swarm.memory import SwarmMemory
        from supabase import create_client
        from swarm.config import SUPABASE_URL, SUPABASE_KEY

        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        memory = SwarmMemory(supabase_client=sb)
        memory.store(
            project="nexus",
            task_title=f"Video analysis: {url}",
            output=result["analysis"],
            task_type="video_analysis",
            tokens_used=0,
        )
        console.print("[dim]Analysis saved to swarm memory.[/dim]")
    except Exception:
        pass


def main():
    parser = argparse.ArgumentParser(
        description="Swarm: autonomous agent system",
        usage="python -m swarm [goal] [options]",
    )
    parser.add_argument("goal", nargs="?", help="Goal to decompose into tasks")
    parser.add_argument("--status", action="store_true", help="Show swarm status")
    parser.add_argument("--stop", action="store_true", help="Stop all workers")
    parser.add_argument("--budget", action="store_true", help="Show budget status")
    parser.add_argument("--workers", action="store_true", help="List active workers")
    parser.add_argument("--tasks", action="store_true", help="List pending tasks")
    parser.add_argument("--run", action="store_true", help="Start the orchestrator")
    parser.add_argument("--daemon", action="store_true", help="Start the Hive as a persistent 24/7 daemon")
    parser.add_argument("--video", metavar="URL", help="Analyze a Twitter/X video URL")
    parser.add_argument("--frames", type=int, default=8, help="Number of frames to extract (default: 8)")
    parser.add_argument("--deep", action="store_true", help="Use Sonnet for deeper video analysis")
    parser.add_argument("--playwright", action="store_true", help="Use Playwright for video capture")

    args = parser.parse_args()

    if args.daemon:
        run_daemon()
    elif args.status:
        show_status()
    elif args.stop:
        stop_swarm()
    elif args.budget:
        show_budget()
    elif args.workers:
        show_workers()
    elif args.tasks:
        show_tasks()
    elif args.run:
        run_orchestrator()
    elif args.video:
        analyze_video(args.video, frames=args.frames, deep=args.deep, playwright=args.playwright)
    elif args.goal:
        run_goal(args.goal)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
