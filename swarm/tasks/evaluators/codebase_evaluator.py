"""
Codebase evaluator: analyzes a project and suggests improvement tasks.
"""

import json
import logging
import os
import subprocess
from typing import Any

import anthropic

from swarm.config import ANTHROPIC_API_KEY, PROJECTS

logger = logging.getLogger("swarm.evaluator")

EVAL_SYSTEM = """You are a senior software engineer evaluating a codebase for an autonomous improvement swarm.
Analyze the provided codebase context and return a structured JSON assessment.

Return JSON with this exact structure:
{
  "summary": "1-2 sentence project summary",
  "health_score": 7,  // 1-10
  "strengths": ["list of things done well"],
  "weaknesses": ["list of things that need improvement"],
  "suggested_tasks": [
    {
      "task_type": "refactor|build|test",
      "title": "specific task title",
      "description": "detailed description of what to do",
      "cost_tier": "light|heavy",
      "priority": 5,
      "estimated_complexity": "low|medium|high"
    }
  ]
}

Guidelines:
- Be specific and actionable in suggestions
- Suggest 2-3 tasks maximum
- Prioritize: tests > bugs > refactoring > features
- Consider the project type when evaluating
- No markdown, just JSON"""


class CodebaseEvaluator:
    """Evaluates a project codebase and suggests improvement tasks."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def evaluate(self, project_key: str) -> dict[str, Any]:
        """Evaluate a project and return structured assessment.

        Args:
            project_key: Key from config.PROJECTS

        Returns:
            Assessment dict with summary, health_score, strengths, weaknesses, suggested_tasks
        """
        if project_key not in PROJECTS:
            raise ValueError(f"Unknown project: {project_key}. Known: {list(PROJECTS.keys())}")

        config = PROJECTS[project_key]
        project_dir = config["dir"]

        if not os.path.isdir(project_dir):
            raise FileNotFoundError(f"Project directory not found: {project_dir}")

        # Gather codebase context
        context = self._gather_context(project_dir, config["type"])

        prompt = f"""Evaluate this {config['type']} project: {project_key}

Directory: {project_dir}

{context}

Provide your assessment as JSON."""

        logger.info("Evaluating project: %s", project_key)

        response = self.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=EVAL_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                response_text += block.text

        try:
            text = response_text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(
                    lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                )
            assessment = json.loads(text)
        except json.JSONDecodeError as e:
            logger.error("Failed to parse evaluation response: %s", e)
            assessment = {
                "summary": "Evaluation failed to parse",
                "health_score": 0,
                "strengths": [],
                "weaknesses": ["Could not parse evaluation response"],
                "suggested_tasks": [],
                "raw_response": response_text[:2000],
            }

        assessment["project"] = project_key
        assessment["project_type"] = config["type"]
        return assessment

    def _gather_context(self, project_dir: str, project_type: str) -> str:
        """Gather codebase context for evaluation.

        Reads key files and runs git commands to build a context string.
        """
        sections = []

        # File structure (top-level)
        try:
            entries = os.listdir(project_dir)
            entries = [e for e in entries if not e.startswith(".git") and e != "node_modules" and e != "__pycache__"]
            sections.append(f"## File structure (top-level)\n{chr(10).join(sorted(entries))}")
        except Exception as e:
            sections.append(f"## File structure\nError: {e}")

        # Key files to read
        key_files = ["README.md", "CLAUDE.md", "package.json", "pyproject.toml", "requirements.txt", "setup.py"]
        for fname in key_files:
            fpath = os.path.join(project_dir, fname)
            if os.path.isfile(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read(3000)  # First 3K chars
                    sections.append(f"## {fname}\n```\n{content}\n```")
                except Exception as e:
                    sections.append(f"## {fname}\nError reading: {e}")

        # Recent git log
        try:
            result = subprocess.run(
                ["git", "log", "--oneline", "-20"],
                cwd=project_dir,
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0 and result.stdout.strip():
                sections.append(f"## Recent git history\n```\n{result.stdout.strip()}\n```")
        except Exception:
            pass

        # Source file count by extension
        try:
            ext_counts: dict[str, int] = {}
            for root, dirs, files in os.walk(project_dir):
                # Skip common non-source dirs
                dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "__pycache__", ".next", "dist", "build", "venv", ".venv"}]
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext:
                        ext_counts[ext] = ext_counts.get(ext, 0) + 1
            top_exts = sorted(ext_counts.items(), key=lambda x: -x[1])[:15]
            ext_summary = "\n".join(f"  {ext}: {count}" for ext, count in top_exts)
            sections.append(f"## File type distribution\n{ext_summary}")
        except Exception:
            pass

        return "\n\n".join(sections)
