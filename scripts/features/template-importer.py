"""Script 34: Import mission templates from a YAML/JSON file into localStorage format."""
import json, sys, os

DEFAULT_TEMPLATES = [
    {"name": "Landing Page", "goal": "Build a professional landing page with hero section, features grid, testimonials, pricing, and CTA. Use shadcn/ui components, Tailwind, dark theme. Make it look like a real product.", "project": "nexus", "worker_type": "builder", "category": "build", "priority": 50},
    {"name": "API Endpoint", "goal": "Add a new REST API endpoint. Include input validation, error handling, and proper HTTP status codes. Follow existing patterns in the codebase.", "project": "nexus", "worker_type": "builder", "category": "build", "priority": 40},
    {"name": "Full Code Audit", "goal": "Review the entire codebase for: security vulnerabilities, performance issues, unused code, inconsistent patterns, missing error handling. Report only high-confidence issues.", "project": "nexus", "worker_type": "inspector", "category": "review", "priority": 30},
    {"name": "Database Migration", "goal": "Create and apply a Supabase migration for the requested schema changes. Include proper indexes, RLS policies, and Realtime configuration.", "project": "nexus", "worker_type": "builder", "category": "build", "priority": 30},
    {"name": "SEO Blog Post", "goal": "Write a 1500-word SEO-optimized blog post on the given topic. Include proper headings, meta description, internal links, and a call-to-action.", "project": "buildkit-services", "worker_type": "scout", "category": "research", "priority": 60},
    {"name": "Prospect 50 Businesses", "goal": "Find 50 businesses in the specified city/industry. For each, get: business name, website, email, phone, address. Score each prospect 1-10 for website quality.", "project": "buildkit-services", "worker_type": "miner", "category": "prospect", "priority": 50},
    {"name": "Deploy All Projects", "goal": "For each project, run tests, fix any failures, then deploy. Verify each deployment is live. Report URLs and status.", "project": "nexus", "worker_type": "deployer", "category": "deploy", "priority": 20},
    {"name": "Dependency Update", "goal": "Update all dependencies to latest versions. Run tests after each update. Fix any breaking changes. Do NOT update major versions without checking changelogs.", "project": "nexus", "worker_type": "builder", "category": "maintenance", "priority": 60},
    {"name": "Add Authentication", "goal": "Add user authentication using Supabase Auth. Include login, signup, password reset, and protected routes. Follow the existing UI patterns.", "project": "nexus", "worker_type": "builder", "category": "build", "priority": 40},
    {"name": "Performance Optimization", "goal": "Profile the app for performance bottlenecks. Optimize: bundle size, render performance, API response times, image loading. Report before/after metrics.", "project": "nexus", "worker_type": "inspector", "category": "maintenance", "priority": 50},
    {"name": "Write Tests", "goal": "Add unit and integration tests for the specified module. Aim for >80% coverage. Use the existing test framework. Include edge cases.", "project": "nexus", "worker_type": "inspector", "category": "review", "priority": 40},
    {"name": "Email Campaign Draft", "goal": "Draft a 3-email sequence for the specified audience. Include subject lines, preview text, body copy, and CTAs. Personalization tokens where appropriate.", "project": "buildkit-services", "worker_type": "messenger", "category": "prospect", "priority": 60},
]

import time
output = []
for i, t in enumerate(DEFAULT_TEMPLATES):
    output.append({
        "id": f"t-imported-{i+1}",
        "name": t["name"],
        "goal": t["goal"],
        "project": t["project"],
        "worker_type": t["worker_type"],
        "category": t["category"],
        "priority": t["priority"],
        "created_at": datetime.now().isoformat() if 'datetime' in dir() else "2026-03-15T00:00:00.000Z",
        "updated_at": datetime.now().isoformat() if 'datetime' in dir() else "2026-03-15T00:00:00.000Z",
    })

out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "templates-export.json")
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)

print(f"  Exported {len(output)} templates to {out_path}")
print("  To import: open Nexus > browser console > localStorage.setItem('nexus-mission-templates', JSON.stringify(...))")
