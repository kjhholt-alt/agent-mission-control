"""
Git worktree manager: isolates agent work into separate worktrees
so multiple agents can work on the same repo simultaneously.

Each heavy/cc_light worker gets a temporary worktree branch.
On completion, changes are committed to a branch ready for merge.
"""

import logging
import os
import re
import subprocess
import shutil
from pathlib import Path
from typing import Optional

logger = logging.getLogger("swarm.worktree")

# Base directory for all agent worktrees
WORKTREE_BASE = Path("C:/Users/Kruz/Desktop/Projects/.worktrees")


def _run_git(args: list[str], cwd: str, timeout: int = 30) -> subprocess.CompletedProcess:
    """Run a git command and return the result."""
    cmd = ["git"] + args
    startupinfo = None
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE

    return subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
        startupinfo=startupinfo,
    )


def create_worktree(
    project_dir: str,
    task_id: str,
    base_branch: str = "main",
) -> Optional[str]:
    """Create an isolated git worktree for a task.

    Creates a new branch and worktree so the agent can make changes
    without conflicting with other agents working on the same repo.

    Args:
        project_dir: Path to the main project repo
        task_id: Task UUID (used to name the worktree and branch)
        base_branch: Branch to base the worktree on (default: main)

    Returns:
        Path to the worktree directory, or None if creation failed
    """
    # Validate task_id format (defensive — prevents path traversal via crafted IDs)
    if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', task_id):
        logger.error("Invalid task_id format: %s", task_id[:40])
        return None

    short_id = task_id[:8]
    branch_name = f"agent/{short_id}"
    worktree_path = str(WORKTREE_BASE / short_id)

    # Ensure base directory exists
    WORKTREE_BASE.mkdir(parents=True, exist_ok=True)

    # Check if this is a git repo
    result = _run_git(["rev-parse", "--git-dir"], cwd=project_dir)
    if result.returncode != 0:
        logger.warning("Not a git repo: %s", project_dir)
        return None

    # Determine the base ref — try the specified branch, fall back to HEAD
    result = _run_git(["rev-parse", "--verify", base_branch], cwd=project_dir)
    if result.returncode != 0:
        # Try master if main doesn't exist
        result = _run_git(["rev-parse", "--verify", "master"], cwd=project_dir)
        if result.returncode != 0:
            base_branch = "HEAD"
        else:
            base_branch = "master"

    # Create the worktree with a new branch — let git be the lock (no TOCTOU race)
    result = _run_git(
        ["worktree", "add", "-b", branch_name, worktree_path, base_branch],
        cwd=project_dir,
    )

    if result.returncode != 0:
        # Branch may already exist — try without -b
        result = _run_git(
            ["worktree", "add", worktree_path, branch_name],
            cwd=project_dir,
        )
        if result.returncode != 0:
            # Worktree may exist from a previous run — reuse if path exists
            if os.path.exists(worktree_path):
                logger.warning("Worktree already exists at %s, reusing", worktree_path)
                return worktree_path
            logger.error(
                "Failed to create worktree for task %s: %s",
                short_id,
                result.stderr.strip(),
            )
            return None

    logger.info("Created worktree at %s (branch: %s)", worktree_path, branch_name)
    return worktree_path


def commit_worktree_changes(
    worktree_path: str,
    task_id: str,
    task_title: str,
    worker_name: str = "agent",
) -> Optional[str]:
    """Commit any changes made in the worktree.

    Args:
        worktree_path: Path to the worktree directory
        task_id: Task UUID for the commit message
        task_title: Human-readable task title for the commit message
        worker_name: Name of the worker that made the changes

    Returns:
        The commit SHA if changes were committed, or None if no changes
    """
    if not os.path.exists(worktree_path):
        return None

    # Check for changes
    result = _run_git(["status", "--porcelain"], cwd=worktree_path)
    if not result.stdout.strip():
        logger.info("No changes in worktree %s", worktree_path)
        return None

    # Stage all changes
    _run_git(["add", "-A"], cwd=worktree_path)

    # Commit
    short_id = task_id[:8]
    commit_msg = (
        f"[{worker_name}] {task_title}\n\n"
        f"Task: {task_id}\n"
        f"Worker: {worker_name}\n"
        f"Auto-committed by Nexus swarm agent"
    )
    result = _run_git(
        ["commit", "-m", commit_msg, "--author", "Nexus Agent <nexus@buildkit.store>"],
        cwd=worktree_path,
    )

    if result.returncode != 0:
        logger.warning("Failed to commit in worktree %s: %s", short_id, result.stderr.strip())
        return None

    # Get the commit SHA
    sha_result = _run_git(["rev-parse", "HEAD"], cwd=worktree_path)
    sha = sha_result.stdout.strip() if sha_result.returncode == 0 else None

    logger.info("Committed changes in worktree %s: %s", short_id, sha[:8] if sha else "???")
    return sha


def merge_worktree(
    project_dir: str,
    worktree_path: str,
    task_id: str,
    target_branch: str = "main",
    auto_merge: bool = False,
) -> dict:
    """Merge worktree changes back into the target branch.

    Args:
        project_dir: Path to the main project repo
        worktree_path: Path to the worktree directory
        task_id: Task UUID
        target_branch: Branch to merge into
        auto_merge: If True, attempt automatic merge. If False, just push the branch.

    Returns:
        Dict with merge status: {merged, branch, sha, conflict}
    """
    short_id = task_id[:8]
    branch_name = f"agent/{short_id}"

    # First commit any uncommitted changes
    commit_worktree_changes(worktree_path, task_id, "Final changes", "agent")

    if not auto_merge:
        # Just push the branch — let the user/PR handle merging
        result = _run_git(
            ["push", "origin", branch_name],
            cwd=worktree_path,
            timeout=60,
        )
        pushed = result.returncode == 0
        return {
            "merged": False,
            "pushed": pushed,
            "branch": branch_name,
            "error": result.stderr.strip() if not pushed else None,
        }

    # Save current branch so we can restore on failure
    original_ref = _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=project_dir)
    original_branch = original_ref.stdout.strip() if original_ref.returncode == 0 else None

    # Auto-merge: switch to target branch in main repo and merge
    _run_git(["checkout", target_branch], cwd=project_dir)
    result = _run_git(
        ["merge", branch_name, "--no-ff", "-m", f"Merge agent/{short_id}"],
        cwd=project_dir,
    )

    if result.returncode != 0:
        # Merge conflict — abort and restore original branch
        _run_git(["merge", "--abort"], cwd=project_dir)
        if original_branch and original_branch != target_branch:
            _run_git(["checkout", original_branch], cwd=project_dir)
        logger.warning("Merge conflict for agent/%s, branch preserved", short_id)
        return {
            "merged": False,
            "pushed": False,
            "branch": branch_name,
            "conflict": True,
            "error": result.stderr.strip(),
        }

    sha_result = _run_git(["rev-parse", "HEAD"], cwd=project_dir)
    sha = sha_result.stdout.strip() if sha_result.returncode == 0 else None

    # Restore original branch if different from target
    if original_branch and original_branch != target_branch:
        _run_git(["checkout", original_branch], cwd=project_dir)

    logger.info("Merged agent/%s into %s: %s", short_id, target_branch, sha[:8] if sha else "???")
    return {
        "merged": True,
        "pushed": False,
        "branch": branch_name,
        "sha": sha,
        "conflict": False,
    }


def cleanup_worktree(
    project_dir: str,
    worktree_path: str,
    task_id: str,
    delete_branch: bool = False,
) -> bool:
    """Remove a worktree and optionally its branch.

    Args:
        project_dir: Path to the main project repo
        worktree_path: Path to the worktree directory
        task_id: Task UUID
        delete_branch: If True, also delete the agent branch

    Returns:
        True if cleanup succeeded
    """
    short_id = task_id[:8]
    branch_name = f"agent/{short_id}"

    # Remove the worktree
    result = _run_git(["worktree", "remove", worktree_path, "--force"], cwd=project_dir)
    if result.returncode != 0:
        # Fallback: manually remove the directory
        try:
            if os.path.exists(worktree_path):
                shutil.rmtree(worktree_path, ignore_errors=True)
            # Prune stale worktree entries
            _run_git(["worktree", "prune"], cwd=project_dir)
        except Exception as e:
            logger.warning("Failed to clean up worktree %s: %s", short_id, e)
            return False

    # Optionally delete the branch
    if delete_branch:
        _run_git(["branch", "-D", branch_name], cwd=project_dir)
        logger.debug("Deleted branch %s", branch_name)

    logger.info("Cleaned up worktree for task %s", short_id)
    return True


def list_worktrees(project_dir: str) -> list[dict]:
    """List all active worktrees for a project.

    Args:
        project_dir: Path to the main project repo

    Returns:
        List of dicts with worktree info: {path, branch, head}
    """
    result = _run_git(["worktree", "list", "--porcelain"], cwd=project_dir)
    if result.returncode != 0:
        return []

    worktrees = []
    current: dict = {}
    for line in result.stdout.strip().split("\n"):
        if line.startswith("worktree "):
            if current:
                worktrees.append(current)
            current = {"path": line.split(" ", 1)[1]}
        elif line.startswith("HEAD "):
            current["head"] = line.split(" ", 1)[1]
        elif line.startswith("branch "):
            current["branch"] = line.split(" ", 1)[1]
        elif line == "":
            if current:
                worktrees.append(current)
                current = {}
    if current:
        worktrees.append(current)

    # Filter to only agent worktrees
    return [w for w in worktrees if "agent/" in w.get("branch", "")]


def cleanup_stale_worktrees(project_dir: str, max_age_hours: int = 24) -> int:
    """Remove worktrees older than max_age_hours.

    Args:
        project_dir: Path to the main project repo
        max_age_hours: Maximum age in hours before cleanup

    Returns:
        Number of worktrees cleaned up
    """
    import time

    worktrees = list_worktrees(project_dir)
    cleaned = 0

    for wt in worktrees:
        path = wt.get("path", "")
        if not os.path.exists(path):
            continue

        # Check directory age
        mtime = os.path.getmtime(path)
        age_hours = (time.time() - mtime) / 3600

        if age_hours > max_age_hours:
            # Extract task_id from branch name (agent/XXXXXXXX)
            branch = wt.get("branch", "")
            short_id = branch.split("/")[-1] if "/" in branch else ""
            if short_id:
                cleanup_worktree(project_dir, path, short_id, delete_branch=True)
                cleaned += 1

    if cleaned:
        logger.info("Cleaned up %d stale worktrees in %s", cleaned, project_dir)
    return cleaned
