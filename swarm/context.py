"""
Context injection: gathers project context for intelligent task execution.

Reads CLAUDE.md, recent git history, and file structure from a project directory
to inject as context before task prompts.
"""

import logging
import os
import subprocess
from typing import Optional

logger = logging.getLogger("swarm.context")

# Max chars for CLAUDE.md content
CLAUDE_MD_MAX_CHARS = 2000
# Max total context string length (rough proxy for ~4000 tokens)
MAX_CONTEXT_CHARS = 8000


def gather_project_context(project_dir: str, project_key: str = "") -> str:
    """Gather context from a project directory for injection into task prompts.

    Reads:
    - CLAUDE.md (first 2000 chars)
    - Last 10 git commits
    - File tree (top-level dirs + key source files)

    Args:
        project_dir: Absolute path to the project directory
        project_key: Optional project key to check against BLOCKED_PROJECTS

    Returns:
        Formatted context string, or empty string if project dir doesn't exist,
        project is blocked, or any error occurs during gathering.
    """
    from swarm.config import BLOCKED_PROJECTS, PROJECTS

    # Check if project is blocked
    if project_key and project_key in BLOCKED_PROJECTS:
        logger.debug("Project %s is blocked, skipping context", project_key)
        return ""

    # If project_key given but not in PROJECTS registry, return empty (don't crash)
    if project_key and project_key not in PROJECTS:
        logger.debug("Project %s not in PROJECTS registry, skipping context", project_key)
        return ""

    if not project_dir or not os.path.isdir(project_dir):
        logger.debug("Project dir does not exist: %s", project_dir)
        return ""

    try:
        sections: list[str] = []

        # 1. Read CLAUDE.md
        claude_md = _read_claude_md(project_dir)
        if claude_md:
            sections.append(f"## Project Instructions (CLAUDE.md)\n{claude_md}")

        # 2. Recent git commits
        git_log = _get_git_log(project_dir)
        if git_log:
            sections.append(f"## Recent Commits\n{git_log}")

        # 3. File structure
        file_tree = _get_file_tree(project_dir)
        if file_tree:
            sections.append(f"## File Structure\n{file_tree}")

        if not sections:
            return ""

        context = f"--- PROJECT CONTEXT ({os.path.basename(project_dir)}) ---\n\n"
        context += "\n\n".join(sections)
        context += "\n\n--- END PROJECT CONTEXT ---"

        # Enforce max length
        if len(context) > MAX_CONTEXT_CHARS:
            context = context[:MAX_CONTEXT_CHARS] + "\n[...context truncated...]"

        return context
    except Exception as e:
        logger.warning("Failed to gather context for %s: %s", project_dir, e)
        return ""


def _read_claude_md(project_dir: str) -> Optional[str]:
    """Read CLAUDE.md from the project root, truncated to CLAUDE_MD_MAX_CHARS."""
    for filename in ("CLAUDE.md", "claude.md"):
        filepath = os.path.join(project_dir, filename)
        if os.path.isfile(filepath):
            try:
                with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read(CLAUDE_MD_MAX_CHARS)
                if len(content) >= CLAUDE_MD_MAX_CHARS:
                    content += "\n[...truncated...]"
                return content.strip()
            except Exception as e:
                logger.debug("Failed to read %s: %s", filepath, e)
    return None


def _get_git_log(project_dir: str, count: int = 10) -> Optional[str]:
    """Get the last N git commits as one-line summaries."""
    try:
        result = subprocess.run(
            ["git", "log", f"--oneline", f"-{count}"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except Exception as e:
        logger.debug("Failed to get git log from %s: %s", project_dir, e)
    return None


def _get_file_tree(project_dir: str, max_files: int = 50) -> Optional[str]:
    """Get a summary of the project file structure.

    Lists top-level directories and finds key source files (.py, .ts, .tsx).
    Works cross-platform (no reliance on `find` command).
    """
    try:
        # Top-level entries
        entries = sorted(os.listdir(project_dir))
        dirs = []
        files = []
        for entry in entries:
            full = os.path.join(project_dir, entry)
            if entry.startswith(".") or entry in ("node_modules", "__pycache__", ".next", "dist", "build", ".git"):
                continue
            if os.path.isdir(full):
                dirs.append(f"  {entry}/")
            else:
                files.append(f"  {entry}")

        lines = ["Top-level:"]
        lines.extend(dirs[:20])
        lines.extend(files[:10])

        # Find key source files (walk, limited depth)
        source_files: list[str] = []
        source_exts = {".py", ".ts", ".tsx", ".js", ".jsx"}
        skip_dirs = {"node_modules", "__pycache__", ".next", "dist", "build", ".git", ".venv", "venv"}

        for root, subdirs, filenames in os.walk(project_dir):
            # Skip unwanted directories
            subdirs[:] = [d for d in subdirs if d not in skip_dirs]
            # Limit depth to 4 levels
            depth = root[len(project_dir):].count(os.sep)
            if depth > 4:
                subdirs.clear()
                continue
            for fname in filenames:
                if os.path.splitext(fname)[1] in source_exts:
                    rel = os.path.relpath(os.path.join(root, fname), project_dir)
                    source_files.append(f"  {rel}")
                    if len(source_files) >= max_files:
                        break
            if len(source_files) >= max_files:
                break

        if source_files:
            lines.append("\nSource files:")
            lines.extend(source_files)

        return "\n".join(lines)
    except Exception as e:
        logger.debug("Failed to get file tree from %s: %s", project_dir, e)
    return None
