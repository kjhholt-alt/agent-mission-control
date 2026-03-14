"""
Light worker: uses Anthropic Python SDK to call Claude API directly.
"""

import json
import logging
from typing import Any

import anthropic

from swarm.budget.cost_calculator import calculate_cost
from swarm.config import ANTHROPIC_API_KEY, PROJECTS
from swarm.context import gather_project_context
from swarm.workers.base import BaseWorker

logger = logging.getLogger("swarm.worker.light")

# Default models for light workers
DEFAULT_MODEL = "claude-haiku-4-5-20251001"
SONNET_MODEL = "claude-haiku-4-5-20251001"


class LightWorker(BaseWorker):
    """Worker that calls Claude API directly for fast, cheap tasks."""

    def __init__(self, worker_type: str = "light"):
        super().__init__(worker_type=worker_type, tier="light")
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def _build_prompt_with_context(self, task: dict[str, Any], prompt: str) -> str:
        """Inject project context before the task prompt if a project is specified.

        Args:
            task: Task row from Supabase
            prompt: Original task prompt

        Returns:
            Prompt with project context prepended, or original prompt
        """
        project_key = task.get("project", "")
        if not project_key:
            return prompt

        project_config = PROJECTS.get(project_key)
        if not project_config:
            return prompt

        project_dir = project_config.get("dir", "")
        if not project_dir:
            return prompt

        context = gather_project_context(project_dir)
        if not context:
            return prompt

        logger.info(
            "Injected %d chars of project context for %s",
            len(context),
            project_key,
        )
        return f"{context}\n\n{prompt}"

    def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """Execute a task by calling the Claude API.

        Args:
            task: Task row from Supabase. input_data should contain:
                - prompt: The prompt to send
                - model (optional): Model override
                - max_tokens (optional): Max tokens override
                - system (optional): System prompt

        Returns:
            Output data with response, model, and cost info
        """
        input_data = task.get("input_data", {})
        if isinstance(input_data, str):
            input_data = json.loads(input_data)

        prompt = input_data.get("prompt", "")
        if not prompt:
            raise ValueError("Task input_data must contain a 'prompt' field")

        # Inject project context before the prompt
        prompt = self._build_prompt_with_context(task, prompt)

        # Select model based on task type
        model = input_data.get("model", DEFAULT_MODEL)
        if task.get("task_type") in ("meta", "eval"):
            model = input_data.get("model", SONNET_MODEL)

        max_tokens = input_data.get("max_tokens", 4096)
        system_prompt = input_data.get("system", "You are an autonomous agent worker in a swarm system. Complete the task precisely and return structured output.")

        logger.info(
            "Calling %s for task %s: %s",
            model,
            task["id"][:8],
            task["title"],
        )

        response = self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )

        # Extract response text
        response_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                response_text += block.text

        # Calculate cost
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost_cents = calculate_cost(model, input_tokens, output_tokens)

        # Record spend
        self.budget_manager.record_spend(
            cents=cost_cents,
            tokens=input_tokens + output_tokens,
        )

        logger.info(
            "Task %s: %d in / %d out tokens, $%.4f",
            task["id"][:8],
            input_tokens,
            output_tokens,
            cost_cents / 100,
        )

        return {
            "response": response_text,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_cents": cost_cents,
            "stop_reason": response.stop_reason,
        }
