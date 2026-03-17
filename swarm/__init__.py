"""
Nexus Swarm — Multi-agent orchestration system.

Modules:
  - orchestrator: Main daemon that manages workers, tasks, and budgets
  - teams: Agent team coordination for multi-agent goals
  - worktree: Git worktree isolation for parallel agent work
  - workers/: Worker implementations (light, cc_light, heavy, browser)
  - tasks/: Task management with DAG dependencies
  - budget/: Budget tracking and enforcement
  - memory: Shared context bank across tasks
  - config: Project registry and system configuration
"""
