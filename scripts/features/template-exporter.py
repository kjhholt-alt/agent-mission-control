"""Script 35: Export templates to JSON file for backup/sharing."""
import json, os

# Default templates (same as the app's defaults)
TEMPLATES = [
    {"name": "Add Feature", "goal": "Implement a new feature. Write clean code, add tests, ensure it builds.", "project": "nexus", "worker_type": "builder", "category": "build", "priority": 50},
    {"name": "Code Review", "goal": "Review latest changes for bugs, security issues, code quality. Report high-confidence issues only.", "project": "nexus", "worker_type": "inspector", "category": "review", "priority": 40},
    {"name": "Prospect Businesses", "goal": "Find 50 businesses in specified city/industry with website, email, phone.", "project": "buildkit-services", "worker_type": "miner", "category": "prospect", "priority": 60},
    {"name": "Deploy to Production", "goal": "Run tests, fix failures, deploy. Verify live. Report URL.", "project": "nexus", "worker_type": "deployer", "category": "deploy", "priority": 20},
    {"name": "Research & Plan", "goal": "Research topic and create detailed implementation plan with trade-offs.", "project": "nexus", "worker_type": "scout", "category": "research", "priority": 70},
    {"name": "Fix Failing Tests", "goal": "Run test suite, fix all failures, verify all pass.", "project": "nexus", "worker_type": "builder", "category": "maintenance", "priority": 30},
]

out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "templates-backup.json")
with open(out_path, "w") as f:
    json.dump(TEMPLATES, f, indent=2)

print(f"  Exported {len(TEMPLATES)} templates to {out_path}")
