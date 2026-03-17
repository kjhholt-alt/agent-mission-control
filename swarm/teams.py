"""
Agent Teams: coordinate multiple workers on a shared goal.

A team has a leader (typically cc_light for planning) and members (heavy/light workers).
The leader decomposes the goal, creates subtasks with DAG dependencies,
and monitors progress. Members execute in isolated worktrees.

Schema (swarm_teams):
  id (uuid), name (text), goal (text), project (text),
  status (text: planning/active/completed/failed),
  leader_task_id (uuid), member_task_ids (uuid[]),
  worktree_paths (jsonb), created_at, completed_at,
  cost_cents (int), tasks_total (int), tasks_completed (int)
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from swarm.config import PROJECTS, SUPABASE_KEY, SUPABASE_URL
from swarm.goal_decomposer import GoalDecomposer
from swarm.tasks.task_manager import TaskManager
from swarm.worktree import create_worktree, cleanup_worktree, commit_worktree_changes

logger = logging.getLogger("swarm.teams")

TEAMS_TABLE = "swarm_teams"


class AgentTeam:
    """Coordinates a team of agents working toward a shared goal."""

    def __init__(self):
        from supabase import create_client

        self.sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.task_manager = TaskManager()
        self.decomposer = GoalDecomposer()

    def create_team(
        self,
        goal: str,
        project: str,
        name: Optional[str] = None,
        max_workers: int = 3,
        use_worktrees: bool = True,
    ) -> dict[str, Any]:
        """Create a new agent team and decompose the goal into tasks.

        Args:
            goal: High-level goal description
            project: Project key from config.PROJECTS
            name: Optional team name (auto-generated if not provided)
            max_workers: Maximum concurrent workers for this team
            use_worktrees: Whether to use git worktree isolation

        Returns:
            Team record with decomposed tasks
        """
        team_id = str(uuid.uuid4())
        short_id = team_id[:8]

        if not name:
            name = f"team-{short_id}"

        now = datetime.now(timezone.utc).isoformat()

        # Create team record
        team_row = {
            "id": team_id,
            "name": name,
            "goal": goal,
            "project": project,
            "status": "planning",
            "max_workers": max_workers,
            "use_worktrees": use_worktrees,
            "worktree_paths": {},
            "created_at": now,
            "tasks_total": 0,
            "tasks_completed": 0,
            "cost_cents": 0,
        }

        try:
            self.sb.table(TEAMS_TABLE).insert(team_row).execute()
        except Exception as e:
            logger.error("Failed to create team record: %s", e)
            # Continue even if table doesn't exist — we'll use tasks directly
            team_row["_no_table"] = True

        logger.info("Created team %s: %s", short_id, goal[:80])

        # Decompose the goal into tasks
        try:
            tasks = self.decomposer.decompose(goal)
            task_ids = [t["id"] for t in tasks]

            # Tag all tasks with team_id in input_data
            for task in tasks:
                if task.get("task_type") == "meta":
                    continue
                input_data = task.get("input_data", {})
                if isinstance(input_data, str):
                    input_data = json.loads(input_data)
                input_data["team_id"] = team_id
                input_data["use_worktree"] = use_worktrees

                self.sb.table("swarm_tasks").update({
                    "input_data": input_data,
                }).eq("id", task["id"]).execute()

            # Update team with task info
            non_meta = [t for t in tasks if t.get("task_type") != "meta"]
            update = {
                "status": "active",
                "leader_task_id": tasks[0]["id"] if tasks else None,
                "member_task_ids": [t["id"] for t in non_meta],
                "tasks_total": len(non_meta),
            }

            if "_no_table" not in team_row:
                self.sb.table(TEAMS_TABLE).update(update).eq("id", team_id).execute()

            team_row.update(update)
            team_row["tasks"] = tasks

            logger.info(
                "Team %s active: %d tasks decomposed from goal",
                short_id,
                len(non_meta),
            )

        except Exception as e:
            logger.error("Failed to decompose goal for team %s: %s", short_id, e)
            if "_no_table" not in team_row:
                self.sb.table(TEAMS_TABLE).update({
                    "status": "failed",
                }).eq("id", team_id).execute()
            team_row["status"] = "failed"
            team_row["error"] = str(e)

        return team_row

    def get_team_status(self, team_id: str) -> dict[str, Any]:
        """Get the current status of a team including task progress.

        Args:
            team_id: Team UUID

        Returns:
            Team status with task breakdown
        """
        try:
            resp = self.sb.table(TEAMS_TABLE).select("*").eq("id", team_id).execute()
            if not resp.data:
                return {"error": "Team not found"}
            team = resp.data[0]
        except Exception:
            return {"error": "Teams table not available"}

        # Get task statuses
        member_ids = team.get("member_task_ids", [])
        if member_ids:
            task_resp = (
                self.sb.table("swarm_tasks")
                .select("id, title, status, task_type, assigned_worker_id, actual_cost_cents")
                .in_("id", member_ids)
                .execute()
            )
            tasks = task_resp.data or []
        else:
            tasks = []

        completed = sum(1 for t in tasks if t["status"] == "completed")
        failed = sum(1 for t in tasks if t["status"] == "failed")
        running = sum(1 for t in tasks if t["status"] == "running")
        queued = sum(1 for t in tasks if t["status"] == "queued")
        blocked = sum(1 for t in tasks if t["status"] == "blocked")
        total_cost = sum(t.get("actual_cost_cents", 0) or 0 for t in tasks)

        # Update team progress
        all_done = completed + failed == len(tasks) and len(tasks) > 0
        if all_done:
            team_status = "completed" if failed == 0 else "failed"
        elif running > 0 or queued > 0:
            team_status = "active"
        else:
            team_status = team.get("status", "unknown")

        try:
            self.sb.table(TEAMS_TABLE).update({
                "status": team_status,
                "tasks_completed": completed,
                "cost_cents": total_cost,
                "completed_at": datetime.now(timezone.utc).isoformat() if all_done else None,
            }).eq("id", team_id).execute()
        except Exception:
            pass

        return {
            "id": team_id,
            "name": team.get("name"),
            "goal": team.get("goal"),
            "project": team.get("project"),
            "status": team_status,
            "progress": {
                "total": len(tasks),
                "completed": completed,
                "failed": failed,
                "running": running,
                "queued": queued,
                "blocked": blocked,
                "pct": round(completed / len(tasks) * 100) if tasks else 0,
            },
            "cost_cents": total_cost,
            "tasks": tasks,
            "created_at": team.get("created_at"),
            "completed_at": team.get("completed_at"),
        }

    def list_teams(
        self,
        status: Optional[str] = None,
        project: Optional[str] = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """List teams with optional filtering.

        Args:
            status: Filter by status (planning/active/completed/failed)
            project: Filter by project key
            limit: Maximum number of teams to return

        Returns:
            List of team records
        """
        try:
            query = (
                self.sb.table(TEAMS_TABLE)
                .select("*")
                .order("created_at", desc=True)
                .limit(limit)
            )
            if status:
                query = query.eq("status", status)
            if project:
                query = query.eq("project", project)

            resp = query.execute()
            return resp.data or []
        except Exception as e:
            logger.warning("Failed to list teams: %s", e)
            return []

    def cancel_team(self, team_id: str) -> bool:
        """Cancel a team and all its pending tasks.

        Args:
            team_id: Team UUID

        Returns:
            True if cancelled successfully
        """
        try:
            resp = self.sb.table(TEAMS_TABLE).select("*").eq("id", team_id).execute()
            if not resp.data:
                return False
            team = resp.data[0]

            # Cancel all non-completed tasks
            member_ids = team.get("member_task_ids", [])
            if member_ids:
                now = datetime.now(timezone.utc).isoformat()
                self.sb.table("swarm_tasks").update({
                    "status": "failed",
                    "error_message": "Team cancelled",
                    "completed_at": now,
                    "updated_at": now,
                }).in_("id", member_ids).in_(
                    "status", ["queued", "blocked", "pending"]
                ).execute()

            # Update team status
            self.sb.table(TEAMS_TABLE).update({
                "status": "failed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", team_id).execute()

            # Clean up worktrees
            worktree_paths = team.get("worktree_paths", {})
            project_config = PROJECTS.get(team.get("project", ""), {})
            project_dir = project_config.get("dir", "")
            if project_dir:
                for task_id, wt_path in worktree_paths.items():
                    cleanup_worktree(project_dir, wt_path, task_id, delete_branch=True)

            logger.info("Cancelled team %s", team_id[:8])
            return True

        except Exception as e:
            logger.error("Failed to cancel team %s: %s", team_id[:8], e)
            return False
