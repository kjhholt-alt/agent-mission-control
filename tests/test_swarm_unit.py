"""
Unit tests for swarm package — no Supabase required.

Tests pure logic: scoring, ranking, keyword extraction, cycle detection,
cost calculation, retry strategy, memory formatting, prompt injection.

Run: pytest tests/test_swarm_unit.py -v
"""

import json
import re
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Cost Calculator
# ═══════════════════════════════════════════════════════════════════════════════


class TestCostCalculator:
    """Tests for swarm.budget.cost_calculator."""

    def test_haiku_cost(self):
        from swarm.budget.cost_calculator import calculate_cost

        # Haiku: 0.025 cents/1K input, 0.125 cents/1K output
        cost = calculate_cost("claude-haiku-4-5-20251001", 10000, 5000)
        expected = (10000 / 1000) * 0.025 + (5000 / 1000) * 0.125
        assert abs(cost - expected) < 0.001

    def test_sonnet_cost(self):
        from swarm.budget.cost_calculator import calculate_cost

        # Sonnet: 0.3 cents/1K input, 1.5 cents/1K output
        cost = calculate_cost("claude-sonnet-4-5-20250514", 10000, 5000)
        expected = (10000 / 1000) * 0.3 + (5000 / 1000) * 1.5
        assert abs(cost - expected) < 0.001

    def test_unknown_model_raises(self):
        from swarm.budget.cost_calculator import calculate_cost

        with pytest.raises(ValueError, match="Unknown model"):
            calculate_cost("gpt-4", 100, 100)

    def test_zero_tokens(self):
        from swarm.budget.cost_calculator import calculate_cost

        assert calculate_cost("claude-haiku-4-5-20251001", 0, 0) == 0.0

    def test_cost_cents_rounds(self):
        from swarm.budget.cost_calculator import calculate_cost_cents

        # Small usage should round to 0
        result = calculate_cost_cents("claude-haiku-4-5-20251001", 10, 10)
        assert isinstance(result, int)
        assert result >= 0


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Retry Strategy
# ═══════════════════════════════════════════════════════════════════════════════


class TestRetryStrategy:
    """Tests for swarm.retry_strategy.AdaptiveRetry."""

    def setup_method(self):
        from swarm.retry_strategy import AdaptiveRetry
        self.retry = AdaptiveRetry()

    def test_first_retry_injects_error(self):
        result = self.retry.enhance_prompt_after_failure(
            "Build a widget", "ImportError: no module named foo", attempt=1
        )
        assert "ImportError" in result
        assert "Build a widget" in result
        assert "different approach" in result

    def test_second_retry_simplifies(self):
        result = self.retry.enhance_prompt_after_failure(
            "Build a widget", "Timeout", attempt=2,
            previous_errors=["ImportError", "Timeout"],
        )
        assert "RETRY ATTEMPT 3" in result
        assert "Simplify" in result

    def test_should_escalate_on_attempt_2(self):
        assert not self.retry.should_escalate_model(1)
        assert self.retry.should_escalate_model(2)
        assert self.retry.should_escalate_model(3)

    def test_escalation_prompt_adds_guidance(self):
        result = self.retry.build_escalation_system_prompt("You are an agent.")
        assert "You are an agent." in result
        assert "Break the problem" in result
        assert "retry" in result.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Goal Decomposer — Cycle Detection
# ═══════════════════════════════════════════════════════════════════════════════


class TestCycleDetection:
    """Tests for GoalDecomposer._has_cycle (DFS 3-color algorithm)."""

    def test_no_cycle_linear(self):
        from swarm.goal_decomposer import GoalDecomposer

        tasks = [
            {"depends_on_index": []},       # 0
            {"depends_on_index": [0]},      # 1 → 0
            {"depends_on_index": [1]},      # 2 → 1
        ]
        assert GoalDecomposer._has_cycle(tasks) is False

    def test_cycle_detected(self):
        from swarm.goal_decomposer import GoalDecomposer

        tasks = [
            {"depends_on_index": [2]},      # 0 → 2
            {"depends_on_index": [0]},      # 1 → 0
            {"depends_on_index": [1]},      # 2 → 1  (cycle: 0→2→1→0)
        ]
        assert GoalDecomposer._has_cycle(tasks) is True

    def test_self_loop(self):
        from swarm.goal_decomposer import GoalDecomposer

        tasks = [{"depends_on_index": [0]}]
        assert GoalDecomposer._has_cycle(tasks) is True

    def test_empty_graph(self):
        from swarm.goal_decomposer import GoalDecomposer

        assert GoalDecomposer._has_cycle([]) is False

    def test_fan_in_no_cycle(self):
        from swarm.goal_decomposer import GoalDecomposer

        tasks = [
            {"depends_on_index": []},        # 0
            {"depends_on_index": []},        # 1
            {"depends_on_index": [0, 1]},   # 2 → 0, 1  (fan-in)
        ]
        assert GoalDecomposer._has_cycle(tasks) is False

    def test_out_of_range_deps_ignored(self):
        from swarm.goal_decomposer import GoalDecomposer

        tasks = [
            {"depends_on_index": [99]},  # out of range
        ]
        assert GoalDecomposer._has_cycle(tasks) is False


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Keyword Extraction
# ═══════════════════════════════════════════════════════════════════════════════


class TestKeywordExtraction:
    """Tests for BaseWorker._extract_keywords."""

    def test_extracts_meaningful_words(self):
        from swarm.workers.base import BaseWorker

        keywords = BaseWorker._extract_keywords(
            "Refactor the database migration to use async connections and improve performance"
        )
        assert "refactor" in keywords
        assert "database" in keywords
        assert "migration" in keywords
        # Stop words should be filtered
        assert "the" not in keywords
        assert "to" not in keywords

    def test_empty_prompt(self):
        from swarm.workers.base import BaseWorker

        assert BaseWorker._extract_keywords("") == []
        assert BaseWorker._extract_keywords(None) == []

    def test_respects_max_keywords(self):
        from swarm.workers.base import BaseWorker

        keywords = BaseWorker._extract_keywords(
            "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo",
            max_keywords=3,
        )
        assert len(keywords) <= 3

    def test_frequency_ranking(self):
        from swarm.workers.base import BaseWorker

        keywords = BaseWorker._extract_keywords(
            "deploy deploy deploy test test review"
        )
        # "deploy" appears 3 times, should be first
        assert keywords[0] == "deploy"


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Task Ranking / Affinity Scoring
# ═══════════════════════════════════════════════════════════════════════════════


class TestTaskRanking:
    """Tests for TaskManager._rank_tasks affinity scoring."""

    def _make_task(self, task_type="build", project="nexus", priority=50, retry_count=0):
        return {
            "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "task_type": task_type,
            "project": project,
            "priority": priority,
            "retry_count": retry_count,
            "title": f"Test {task_type}",
        }

    @patch("swarm.tasks.task_manager.TaskManager.__init__", return_value=None)
    def test_no_worker_type_returns_original_order(self, mock_init):
        from swarm.tasks.task_manager import TaskManager
        tm = TaskManager.__new__(TaskManager)
        tm.sb = MagicMock()

        tasks = [self._make_task("build"), self._make_task("eval")]
        result = tm._rank_tasks(tasks, worker_type=None)
        assert result == tasks  # unchanged order

    @patch("swarm.tasks.task_manager.TaskManager.__init__", return_value=None)
    def test_builder_prefers_build_tasks(self, mock_init):
        from swarm.tasks.task_manager import TaskManager
        tm = TaskManager.__new__(TaskManager)
        tm.sb = MagicMock()
        # Mock empty affinity cache
        tm.sb.table.return_value.select.return_value.execute.return_value = MagicMock(data=[])

        eval_task = self._make_task("eval", priority=10)  # higher priority
        build_task = self._make_task("build", priority=50)  # lower priority
        result = tm._rank_tasks([eval_task, build_task], worker_type="builder")

        # Builder should prefer build task despite lower priority
        assert result[0]["task_type"] == "build"

    @patch("swarm.tasks.task_manager.TaskManager.__init__", return_value=None)
    def test_fresh_tasks_preferred_over_retries(self, mock_init):
        from swarm.tasks.task_manager import TaskManager
        tm = TaskManager.__new__(TaskManager)
        tm.sb = MagicMock()
        tm.sb.table.return_value.select.return_value.execute.return_value = MagicMock(data=[])

        retried = self._make_task("build", retry_count=2)
        fresh = self._make_task("build", retry_count=0)
        result = tm._rank_tasks([retried, fresh], worker_type="builder")

        assert result[0]["retry_count"] == 0

    @patch("swarm.tasks.task_manager.TaskManager.__init__", return_value=None)
    def test_high_priority_boosts_score(self, mock_init):
        from swarm.tasks.task_manager import TaskManager
        tm = TaskManager.__new__(TaskManager)
        tm.sb = MagicMock()
        tm.sb.table.return_value.select.return_value.execute.return_value = MagicMock(data=[])

        low_pri = self._make_task("eval", priority=90)
        high_pri = self._make_task("eval", priority=5)
        result = tm._rank_tasks([low_pri, high_pri], worker_type="scout")

        assert result[0]["priority"] == 5


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Memory Formatting
# ═══════════════════════════════════════════════════════════════════════════════


class TestMemoryFormatting:
    """Tests for SwarmMemory helper methods (no Supabase needed)."""

    def test_format_age_seconds(self):
        from swarm.memory import SwarmMemory

        now = datetime.now(timezone.utc)
        ts = (now - timedelta(seconds=30)).isoformat()
        assert SwarmMemory._format_age(ts) == "30s ago"

    def test_format_age_minutes(self):
        from swarm.memory import SwarmMemory

        now = datetime.now(timezone.utc)
        ts = (now - timedelta(minutes=5)).isoformat()
        assert SwarmMemory._format_age(ts) == "5m ago"

    def test_format_age_hours(self):
        from swarm.memory import SwarmMemory

        now = datetime.now(timezone.utc)
        ts = (now - timedelta(hours=3)).isoformat()
        assert SwarmMemory._format_age(ts) == "3h ago"

    def test_format_age_days(self):
        from swarm.memory import SwarmMemory

        now = datetime.now(timezone.utc)
        ts = (now - timedelta(days=2)).isoformat()
        assert SwarmMemory._format_age(ts) == "2d ago"

    def test_format_age_none(self):
        from swarm.memory import SwarmMemory

        assert SwarmMemory._format_age(None) == "unknown"

    def test_extract_summary_from_dict(self):
        from swarm.memory import SwarmMemory

        row = {"output_data": {"response": "x" * 300}}
        summary = SwarmMemory._extract_summary(row)
        assert len(summary) <= 203  # 200 + "..."
        assert summary.endswith("...")

    def test_extract_summary_empty(self):
        from swarm.memory import SwarmMemory

        assert SwarmMemory._extract_summary({}) == "No output"

    def test_extract_summary_string(self):
        from swarm.memory import SwarmMemory

        row = {"output_data": "short result"}
        assert SwarmMemory._extract_summary(row) == "short result"


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Parent Output Injection
# ═══════════════════════════════════════════════════════════════════════════════


class TestParentOutputInjection:
    """Tests for TaskManager._inject_parent_outputs."""

    @patch("swarm.tasks.task_manager.TaskManager.__init__", return_value=None)
    def test_injects_single_parent(self, mock_init):
        from swarm.tasks.task_manager import TaskManager
        tm = TaskManager.__new__(TaskManager)

        input_data = {"prompt": "Do the next thing"}
        deps = [{"title": "Step 1", "output_data": {"response": "Result from step 1"}}]

        result = tm._inject_parent_outputs(input_data, deps)
        assert "Result from step 1" in result["prompt"]
        assert "Do the next thing" in result["prompt"]

    @patch("swarm.tasks.task_manager.TaskManager.__init__", return_value=None)
    def test_handles_string_input_data(self, mock_init):
        from swarm.tasks.task_manager import TaskManager
        tm = TaskManager.__new__(TaskManager)

        input_data = json.dumps({"prompt": "Next step"})
        deps = [{"title": "Prev", "output_data": {"response": "Done"}}]

        result = tm._inject_parent_outputs(input_data, deps)
        assert isinstance(result, dict)
        assert "Done" in result["prompt"]

    @patch("swarm.tasks.task_manager.TaskManager.__init__", return_value=None)
    def test_fan_in_header_for_many_parents(self, mock_init):
        from swarm.tasks.task_manager import TaskManager
        tm = TaskManager.__new__(TaskManager)

        input_data = {"prompt": "Combine all"}
        deps = [
            {"title": f"Task {i}", "output_data": {"response": f"Output {i}"}}
            for i in range(5)
        ]

        result = tm._inject_parent_outputs(input_data, deps)
        assert "5 completed upstream tasks" in result["prompt"]

    @patch("swarm.tasks.task_manager.TaskManager.__init__", return_value=None)
    def test_empty_deps_returns_unchanged(self, mock_init):
        from swarm.tasks.task_manager import TaskManager
        tm = TaskManager.__new__(TaskManager)

        input_data = {"prompt": "Solo task"}
        result = tm._inject_parent_outputs(input_data, [])
        assert result["prompt"] == "Solo task"

    @patch("swarm.tasks.task_manager.TaskManager.__init__", return_value=None)
    def test_truncates_large_outputs(self, mock_init):
        from swarm.tasks.task_manager import TaskManager
        tm = TaskManager.__new__(TaskManager)

        input_data = {"prompt": "Next"}
        deps = [{"title": "Big", "output_data": {"response": "x" * 10000}}]

        result = tm._inject_parent_outputs(input_data, deps)
        assert "[...truncated...]" in result["prompt"]


# ═══════════════════════════════════════════════════════════════════════════════
# 8. Worktree UUID Validation
# ═══════════════════════════════════════════════════════════════════════════════


class TestWorktreeValidation:
    """Tests for worktree.create_worktree UUID validation."""

    def test_valid_uuid_accepted(self):
        pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        assert re.fullmatch(pattern, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
        assert re.fullmatch(pattern, "12345678-1234-1234-1234-123456789abc")

    def test_invalid_uuid_rejected(self):
        pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        assert re.fullmatch(pattern, "not-a-uuid") is None
        assert re.fullmatch(pattern, "'; DROP TABLE tasks; --") is None
        assert re.fullmatch(pattern, "") is None
        assert re.fullmatch(pattern, "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE") is None  # uppercase


# ═══════════════════════════════════════════════════════════════════════════════
# 9. Persona System
# ═══════════════════════════════════════════════════════════════════════════════


class TestPersonaSystem:
    """Tests for BaseWorker persona/system prompt building."""

    def test_build_system_prompt_with_persona(self):
        from swarm.workers.base import BaseWorker

        # Create a minimal instance without full init
        worker = BaseWorker.__new__(BaseWorker)
        worker.persona = "You are a diligent builder who takes pride in clean code."

        result = worker.build_system_prompt("Complete the task.")
        assert "Your Persona" in result
        assert "diligent builder" in result
        assert "Complete the task." in result

    def test_build_system_prompt_without_persona(self):
        from swarm.workers.base import BaseWorker

        worker = BaseWorker.__new__(BaseWorker)
        worker.persona = ""

        result = worker.build_system_prompt("Complete the task.")
        assert result == "Complete the task."
        assert "Persona" not in result

    def test_build_system_prompt_default(self):
        from swarm.workers.base import BaseWorker

        worker = BaseWorker.__new__(BaseWorker)
        worker.persona = ""

        result = worker.build_system_prompt()
        assert "autonomous agent" in result


# ═══════════════════════════════════════════════════════════════════════════════
# 10. Config Validation
# ═══════════════════════════════════════════════════════════════════════════════


class TestConfig:
    """Tests for swarm.config constants and consistency."""

    def test_worker_limits_all_positive(self):
        from swarm.config import WORKER_LIMITS

        for tier, limit in WORKER_LIMITS.items():
            assert limit > 0, f"WORKER_LIMITS['{tier}'] must be positive"

    def test_model_costs_have_both_rates(self):
        from swarm.config import MODEL_COSTS

        for model, rates in MODEL_COSTS.items():
            assert "input" in rates, f"MODEL_COSTS['{model}'] missing 'input'"
            assert "output" in rates, f"MODEL_COSTS['{model}'] missing 'output'"
            assert rates["input"] > 0
            assert rates["output"] > 0

    def test_model_routing_maps_to_known_models(self):
        from swarm.config import MODEL_ROUTING

        for tier, model in MODEL_ROUTING.items():
            assert model.startswith("claude-"), f"MODEL_ROUTING['{tier}'] doesn't look like a Claude model"

    def test_projects_have_required_fields(self):
        from swarm.config import PROJECTS

        for name, config in PROJECTS.items():
            assert "dir" in config, f"PROJECTS['{name}'] missing 'dir'"
            assert "type" in config, f"PROJECTS['{name}'] missing 'type'"

    def test_budget_defaults_positive(self):
        from swarm.config import BUDGET_DEFAULTS

        assert BUDGET_DEFAULTS["daily_api_budget_cents"] > 0

    def test_haiku_and_sonnet_types_disjoint(self):
        from swarm.config import HAIKU_TASK_TYPES, SONNET_TASK_TYPES

        overlap = HAIKU_TASK_TYPES & SONNET_TASK_TYPES
        assert len(overlap) == 0, f"HAIKU/SONNET task types overlap: {overlap}"
