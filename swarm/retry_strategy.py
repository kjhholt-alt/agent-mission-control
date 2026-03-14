"""
Adaptive retry strategy: modifies prompts based on previous failures
to help Claude try different approaches on each attempt.
"""

import logging
from typing import Optional

logger = logging.getLogger("swarm.retry")


class AdaptiveRetry:
    """Enhances prompts after failures to guide Claude toward different approaches."""

    MAX_ATTEMPTS = 3

    def enhance_prompt_after_failure(
        self,
        original_prompt: str,
        error: str,
        attempt: int,
        previous_errors: Optional[list[str]] = None,
    ) -> str:
        """Modify the prompt based on previous failure(s).

        Args:
            original_prompt: The original task prompt
            error: The most recent error message
            attempt: Current attempt number (1-based, so attempt=1 means first retry)
            previous_errors: All errors from prior attempts

        Returns:
            Enhanced prompt that steers Claude away from the failed approach
        """
        if attempt == 1:
            logger.info("Retry attempt 2: injecting failure context")
            return (
                f"{original_prompt}\n\n"
                f"IMPORTANT: A previous attempt at this task failed with: {error}\n"
                f"Avoid this issue and try a completely different approach."
            )
        elif attempt == 2:
            all_errors = "\n".join(
                f"  - Attempt {i + 1}: {e}"
                for i, e in enumerate(previous_errors or [error])
            )
            logger.info("Retry attempt 3: simplified prompt with full error history")
            return (
                f"RETRY ATTEMPT 3. Previous approaches failed:\n"
                f"{all_errors}\n\n"
                f"Simplify your approach. Focus on the most basic, achievable "
                f"version of this task:\n{original_prompt}"
            )

        # Should not reach here (attempt >= 3 means permanently failed)
        return original_prompt

    def should_escalate_model(self, attempt: int) -> bool:
        """Whether we should try a more detailed prompt (pseudo-escalation).

        On attempt 2, if the errors are different, we escalate the prompt
        complexity rather than changing the model (since we're on Haiku).

        Args:
            attempt: Current attempt number (1-based)

        Returns:
            True if the prompt should be escalated
        """
        return attempt >= 2

    def build_escalation_system_prompt(self, base_system: str) -> str:
        """Build an escalated system prompt with more detailed instructions.

        Args:
            base_system: The original system prompt

        Returns:
            Enhanced system prompt with extra guidance
        """
        return (
            f"{base_system}\n\n"
            "ADDITIONAL GUIDANCE (this is a retry with escalated instructions):\n"
            "- Break the problem into smaller steps\n"
            "- Validate each assumption before proceeding\n"
            "- If the task seems impossible, return a partial result with "
            "an explanation of what blocked full completion\n"
            "- Prefer simple, proven approaches over clever solutions"
        )
