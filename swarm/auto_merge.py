"""
Auto-merge capability for heavy workers.

Automatically merges PRs that pass safety checks. PRs touching protected
paths or classified as risky task types are flagged for human review instead.
"""

import logging
import re
import subprocess
from typing import Any

from swarm.config import (
    AUTO_MERGE_ENABLED,
    AUTO_MERGE_MAX_FILES_CHANGED,
    AUTO_MERGE_MIN_QUALITY_SCORE,
    PROTECTED_PATHS,
)

logger = logging.getLogger("swarm.auto_merge")


class AutoMerger:
    """Automatically merges PRs that pass safety checks."""

    SAFE_TASK_TYPES = ["test", "docs", "refactor", "type_hints", "style", "eval"]
    REVIEW_REQUIRED_TYPES = ["deploy", "auth", "payment", "config", "breaking"]

    def should_auto_merge(
        self, task: dict[str, Any], pr_info: dict[str, Any]
    ) -> tuple[bool, str]:
        """Decide if a PR should be auto-merged.

        Args:
            task: The swarm task dict (must have 'type' or 'tags').
            pr_info: PR metadata with keys: repo, pr_number, files_changed,
                     checks_passed, base_branch, quality_score.

        Returns:
            (should_merge, reason) — True with explanation if safe, False with
            the reason review is needed.
        """
        if not AUTO_MERGE_ENABLED:
            return False, "Auto-merge is disabled in config"

        task_type = task.get("type", task.get("tags", ["unknown"])[0] if task.get("tags") else "unknown")
        files_changed: list[str] = pr_info.get("files_changed", [])
        checks_passed: bool = pr_info.get("checks_passed", False)
        base_branch: str = pr_info.get("base_branch", "main")
        quality_score: int = pr_info.get("quality_score", 0)

        # 1. CI checks must pass
        if not checks_passed:
            return False, "CI checks have not passed"

        # 2. Task type must not require review
        if task_type in self.REVIEW_REQUIRED_TYPES:
            return False, f"Task type '{task_type}' requires human review"

        # 3. Check protected paths
        for filepath in files_changed:
            if self._matches_protected_path(filepath):
                return False, f"File '{filepath}' matches a protected path pattern"

        # 4. File count limit
        if len(files_changed) > AUTO_MERGE_MAX_FILES_CHANGED:
            return (
                False,
                f"Too many files changed ({len(files_changed)} > {AUTO_MERGE_MAX_FILES_CHANGED})",
            )

        # 5. Quality score threshold
        if quality_score < AUTO_MERGE_MIN_QUALITY_SCORE:
            return (
                False,
                f"Quality score too low ({quality_score} < {AUTO_MERGE_MIN_QUALITY_SCORE})",
            )

        # 6. Warn if merging to main/master of a production service
        if base_branch in ("main", "master"):
            # Still allow if task type is safe — the other checks already passed
            if task_type not in self.SAFE_TASK_TYPES:
                return (
                    False,
                    f"Merging to '{base_branch}' with task type '{task_type}' requires review",
                )

        return True, f"All checks passed (type={task_type}, files={len(files_changed)})"

    def merge_pr(self, repo: str, pr_number: int) -> bool:
        """Merge a PR using gh CLI.

        Args:
            repo: GitHub repo in 'owner/name' format.
            pr_number: The PR number to merge.

        Returns:
            True if merge succeeded, False otherwise.
        """
        logger.info("Auto-merging PR #%d in %s", pr_number, repo)
        try:
            result = subprocess.run(
                [
                    "gh",
                    "pr",
                    "merge",
                    str(pr_number),
                    "--repo",
                    repo,
                    "--merge",
                    "--delete-branch",
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode == 0:
                logger.info("PR #%d merged successfully", pr_number)
                return True
            else:
                logger.error(
                    "Failed to merge PR #%d: %s", pr_number, result.stderr.strip()
                )
                return False
        except Exception as exc:
            logger.error("Error merging PR #%d: %s", pr_number, exc)
            return False

    def flag_for_review(self, repo: str, pr_number: int, reason: str) -> bool:
        """Add a comment explaining why human review is needed.

        Args:
            repo: GitHub repo in 'owner/name' format.
            pr_number: The PR number to comment on.
            reason: Explanation of why review is required.

        Returns:
            True if comment was posted, False otherwise.
        """
        comment = (
            f"**Auto-merge blocked** — flagged for human review.\n\n"
            f"Reason: {reason}\n\n"
            f"Please review and merge manually when ready."
        )
        logger.info("Flagging PR #%d for review: %s", pr_number, reason)
        try:
            result = subprocess.run(
                [
                    "gh",
                    "pr",
                    "comment",
                    str(pr_number),
                    "--repo",
                    repo,
                    "--body",
                    comment,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0
        except Exception as exc:
            logger.error("Error commenting on PR #%d: %s", pr_number, exc)
            return False

    def get_pr_info(self, repo: str, pr_number: int) -> dict[str, Any]:
        """Fetch PR metadata via gh CLI.

        Returns dict with files_changed, checks_passed, base_branch.
        """
        info: dict[str, Any] = {
            "repo": repo,
            "pr_number": pr_number,
            "files_changed": [],
            "checks_passed": False,
            "base_branch": "main",
            "quality_score": 10,  # Default optimistic for safe tasks
        }

        try:
            # Get changed files
            files_result = subprocess.run(
                ["gh", "pr", "diff", str(pr_number), "--repo", repo, "--name-only"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if files_result.returncode == 0:
                info["files_changed"] = [
                    f.strip()
                    for f in files_result.stdout.strip().splitlines()
                    if f.strip()
                ]

            # Get base branch
            base_result = subprocess.run(
                [
                    "gh",
                    "pr",
                    "view",
                    str(pr_number),
                    "--repo",
                    repo,
                    "--json",
                    "baseRefName",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if base_result.returncode == 0:
                import json

                data = json.loads(base_result.stdout)
                info["base_branch"] = data.get("baseRefName", "main")

            # Check CI status
            checks_result = subprocess.run(
                [
                    "gh",
                    "pr",
                    "checks",
                    str(pr_number),
                    "--repo",
                    repo,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            # If no checks configured or all pass, consider it passed
            if checks_result.returncode == 0 or "no checks" in checks_result.stderr.lower():
                info["checks_passed"] = True

        except Exception as exc:
            logger.warning("Error fetching PR info for #%d: %s", pr_number, exc)

        return info

    @staticmethod
    def parse_pr_number(output: str) -> int | None:
        """Extract a PR number from Claude Code output.

        Looks for patterns like 'PR #123', '#123', or github.com/.../pull/123.
        """
        # Try GitHub URL first
        url_match = re.search(r"github\.com/[^/]+/[^/]+/pull/(\d+)", output)
        if url_match:
            return int(url_match.group(1))

        # Try "PR #N" or just "#N" near PR-related words
        pr_match = re.search(r"(?:PR|pull request)\s*#(\d+)", output, re.IGNORECASE)
        if pr_match:
            return int(pr_match.group(1))

        return None

    @staticmethod
    def parse_repo_from_output(output: str) -> str | None:
        """Extract repo (owner/name) from a GitHub URL in output."""
        match = re.search(r"github\.com/([^/]+/[^/]+)/pull/", output)
        if match:
            return match.group(1)
        return None

    @staticmethod
    def _matches_protected_path(filepath: str) -> bool:
        """Check if a filepath matches any protected path pattern."""
        import fnmatch

        for pattern in PROTECTED_PATHS:
            if fnmatch.fnmatch(filepath, pattern):
                return True
            # Also check just the filename against patterns without directory parts
            if "/" not in pattern and fnmatch.fnmatch(filepath.split("/")[-1], pattern):
                return True
        return False
