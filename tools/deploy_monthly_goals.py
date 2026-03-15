"""
Deploy 300 goals to the Nexus Hive queue via direct Supabase insert.

Covers all categories:
  - Nexus UI/UX (50)
  - Nexus Backend (30)
  - Game View (40)
  - Revenue (30)
  - Email Finder (20)
  - Infrastructure (15)
  - Content & SEO (20)
  - Outreach (15)
  - Testing (20)
  - Security & Performance (15)
  - Tauri / Desktop (20)
  - New Features (25)

Usage:
    python tools/deploy_monthly_goals.py
    python tools/deploy_monthly_goals.py --dry-run   # preview without inserting
"""

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone

# Add parent to path so we can import swarm.config
sys.path.insert(0, "C:/Users/Kruz/Desktop/Projects/nexus")

from swarm.config import SUPABASE_KEY, SUPABASE_URL

GOALS = [
    # ═══════════════════════════════════════════════════════════════════════
    # NEXUS UI/UX (50)
    # ═══════════════════════════════════════════════════════════════════════
    ("Add a mini terminal to the game view showing real-time worker stdout", "nexus", 70, "light"),
    ("Build a heat map overlay for the factory — hotter areas = more task activity", "nexus", 65, "light"),
    ("Add worker trail history — dotted lines showing worker movement over last hour", "nexus", 55, "light"),
    ("Build a production line visualizer showing task flow from queued to complete", "nexus", 60, "light"),
    ("Add a resource flow Sankey chart showing data moving between buildings", "nexus", 50, "light"),
    ("Build a capacity planning view — max throughput vs current utilization per building", "nexus", 65, "light"),
    ("Add zoom-to-worker — double click worker name to center camera on them", "nexus", 45, "light"),
    ("Build spectator mode — auto-cycle camera between active workers every 10 seconds", "nexus", 50, "light"),
    ("Add picture-in-picture — small game view in corner while on other pages", "nexus", 40, "light"),
    ("Build a deployment tracker showing recent git pushes and Vercel deploys", "nexus", 60, "light"),
    ("Add a code diff viewer — show PR diffs inline when workers create them", "nexus", 55, "light"),
    ("Build a worker roster page at /roster with lifetime stats for all workers", "nexus", 50, "light"),
    ("Add building upgrade animations — buildings physically change when leveled up", "nexus", 45, "light"),
    ("Build a resource production tracker — emails/PRs/tests produced per hour", "nexus", 60, "light"),
    ("Add a world clock bar showing different timezones for global ops", "nexus", 30, "light"),
    ("Build a system health widget — CPU, RAM, disk, network for local machine", "nexus", 55, "light"),
    ("Add smart notifications — only alert on truly important events", "nexus", 65, "light"),
    ("Build focus mode — hide all UI except selected building and its workers", "nexus", 40, "light"),
    ("Add data age indicators — color degradation showing how stale each data point is", "nexus", 45, "light"),
    ("Build a task dependency graph — visual network showing how tasks connect", "nexus", 55, "light"),
    ("Add keyboard shortcuts panel — show available hotkeys on ? press", "nexus", 35, "light"),
    ("Build a command palette (Cmd+K) for quick navigation and actions", "nexus", 60, "light"),
    ("Add worker chat bubbles — speech bubbles showing what each worker is doing", "nexus", 45, "light"),
    ("Build a queue depth sparkline in the top bar", "nexus", 40, "light"),
    ("Add a dark/light theme toggle with smooth transition", "nexus", 35, "light"),
    ("Build a fullscreen mode toggle for the game view", "nexus", 30, "light"),
    ("Add a task search and filter bar — search by title, project, status, priority", "nexus", 55, "light"),
    ("Build a worker utilization gauge — donut chart showing busy vs idle time", "nexus", 50, "light"),
    ("Add drag-and-drop task reordering in the queue view", "nexus", 45, "light"),
    ("Build a budget burn-down chart — projected spend vs actual over the month", "nexus", 60, "light"),
    ("Add toast notifications for task completions with undo action", "nexus", 40, "light"),
    ("Build a mobile-responsive layout for the dashboard", "nexus", 55, "light"),
    ("Add a settings page for configuring scout interval, worker limits, budgets", "nexus", 50, "light"),
    ("Build a task timeline — Gantt chart showing task durations and overlaps", "nexus", 55, "light"),
    ("Add a worker health indicator — green/yellow/red dot per worker", "nexus", 40, "light"),
    ("Build an error log viewer — filterable list of recent errors and warnings", "nexus", 60, "light"),
    ("Add a cost breakdown pie chart — spend by project and task type", "nexus", 50, "light"),
    ("Build a task creation form — manually add tasks from the UI", "nexus", 65, "light"),
    ("Add a project selector dropdown to filter all views by project", "nexus", 45, "light"),
    ("Build an activity feed — real-time scrolling feed of all swarm events", "nexus", 55, "light"),
    ("Add hover tooltips on all chart elements with detailed data", "nexus", 35, "light"),
    ("Build a worker log viewer — click worker to see its recent output", "nexus", 50, "light"),
    ("Add a task completion sound effect — subtle chime on success", "nexus", 25, "light"),
    ("Build a dashboard layout customizer — drag to rearrange widgets", "nexus", 45, "light"),
    ("Add loading skeletons for all data-dependent components", "nexus", 40, "light"),
    ("Build a task retry button — one-click retry from the failed tasks list", "nexus", 55, "light"),
    ("Add breadcrumb navigation for nested views", "nexus", 30, "light"),
    ("Build a worker spawn/kill control panel in the UI", "nexus", 60, "light"),
    ("Add a connection status indicator — show if Supabase realtime is connected", "nexus", 45, "light"),
    ("Build an export button — download task history as CSV", "nexus", 40, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # NEXUS BACKEND (30)
    # ═══════════════════════════════════════════════════════════════════════
    ("Optimize task pulling — batch multiple tasks per worker session to reduce overhead", "nexus", 70, "light"),
    ("Add task priority decay — older queued tasks slowly increase in priority", "nexus", 55, "light"),
    ("Build worker pool warmup — pre-spawn workers before tasks arrive", "nexus", 50, "light"),
    ("Add intelligent task routing — route to workers with context for that project", "nexus", 65, "light"),
    ("Build task deduplication engine — detect and merge similar queued tasks", "nexus", 60, "light"),
    ("Add cost forecasting — predict daily spend based on queue depth and history", "nexus", 55, "light"),
    ("Build worker performance scoring — track which workers produce best outputs", "nexus", 50, "light"),
    ("Add task complexity estimation — predict duration before starting", "nexus", 45, "light"),
    ("Build queue optimizer — reorder tasks to maximize throughput", "nexus", 55, "light"),
    ("Add worker specialization — workers improve at tasks they do repeatedly", "nexus", 50, "light"),
    ("Implement graceful worker shutdown — finish current task before dying", "nexus", 60, "light"),
    ("Add task result caching — skip re-execution of identical tasks", "nexus", 45, "light"),
    ("Build a task retry backoff strategy — exponential delay on repeated failures", "nexus", 50, "light"),
    ("Add task output validation — verify outputs meet minimum quality", "nexus", 55, "light"),
    ("Build parallel subtask execution — run independent subtasks simultaneously", "nexus", 65, "light"),
    ("Add task timeout configuration per task type", "nexus", 40, "light"),
    ("Build a dead letter queue — permanently failed tasks move to separate table", "nexus", 50, "light"),
    ("Add task metrics collection — track p50/p95/p99 execution times", "nexus", 55, "light"),
    ("Build worker auto-scaling based on queue depth trends", "nexus", 60, "light"),
    ("Add task cancellation support — cancel running tasks via API", "nexus", 45, "light"),
    ("Build a task archive system — move completed tasks older than 48h to archive table", "nexus", 40, "light"),
    ("Add worker resource limits — cap memory and CPU per worker process", "nexus", 50, "light"),
    ("Build task dependency resolution — auto-unblock tasks when deps complete", "nexus", 55, "light"),
    ("Add structured logging with JSON format for better log analysis", "nexus", 45, "light"),
    ("Build a health check endpoint — /api/swarm/health returning queue/worker status", "nexus", 60, "light"),
    ("Add rate limiting for task creation — prevent queue flooding", "nexus", 40, "light"),
    ("Build worker heartbeat dashboard data — expose heartbeat history via API", "nexus", 45, "light"),
    ("Add task priority boosting — manually boost priority of specific tasks", "nexus", 35, "light"),
    ("Build a task template system — predefined task configurations for common jobs", "nexus", 50, "light"),
    ("Add webhook notifications — POST to external URL on task completion", "nexus", 55, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # GAME VIEW (40)
    # ═══════════════════════════════════════════════════════════════════════
    ("Add weather effects — rain particles when many tasks are failing", "nexus", 45, "light"),
    ("Build day/night cycle — factory lighting changes with real wall clock time", "nexus", 50, "light"),
    ("Add construction cranes at buildings currently being upgraded", "nexus", 40, "light"),
    ("Build a minimap showing real-time worker positions as colored dots", "nexus", 55, "light"),
    ("Add vehicle traffic between buildings — small trucks on roads", "nexus", 45, "light"),
    ("Build smoke stack effects that scale with building activity level", "nexus", 40, "light"),
    ("Add power line connections between buildings with electricity sparks", "nexus", 35, "light"),
    ("Build landing pads at buildings receiving deploy tasks", "nexus", 40, "light"),
    ("Add water features — cooling tower with steam at Command Center", "nexus", 35, "light"),
    ("Build conveyor belt sorting junctions where multiple belts meet", "nexus", 45, "light"),
    ("Add a factory alarm animation when budget threshold is hit", "nexus", 50, "light"),
    ("Build worker idle animations — workers sit down or pace when no tasks", "nexus", 40, "light"),
    ("Add celebration effects when a milestone is reached (100 tasks, etc.)", "nexus", 35, "light"),
    ("Build a factory expansion animation when a new project is added", "nexus", 40, "light"),
    ("Add ambient factory sounds — conveyor hum, worker clicks, task chimes", "nexus", 30, "light"),
    ("Build a 3D isometric view option using Three.js", "nexus", 55, "heavy"),
    ("Add particle trails behind moving workers", "nexus", 35, "light"),
    ("Build a zoom slider for the game view — mouse wheel or pinch to zoom", "nexus", 45, "light"),
    ("Add building tooltips — hover to see building stats and current workers", "nexus", 40, "light"),
    ("Build a road network that connects buildings with animated dashes", "nexus", 45, "light"),
    ("Add a factory gate entrance where new tasks arrive", "nexus", 35, "light"),
    ("Build a warehouse building for the task archive", "nexus", 40, "light"),
    ("Add a control tower building for the orchestrator", "nexus", 45, "light"),
    ("Build a radar dish on the Scout building that rotates during evaluations", "nexus", 40, "light"),
    ("Add a clock tower that shows real time", "nexus", 30, "light"),
    ("Build seasonal decorations — snow in winter, flowers in spring", "nexus", 25, "light"),
    ("Add a factory fence/wall around the perimeter", "nexus", 30, "light"),
    ("Build a parking lot with worker vehicles", "nexus", 25, "light"),
    ("Add a helipad for emergency high-priority tasks", "nexus", 35, "light"),
    ("Build a garden/green space for idle workers to rest in", "nexus", 25, "light"),
    ("Add a loading dock where completed tasks are shipped out", "nexus", 35, "light"),
    ("Build a quality control checkpoint building", "nexus", 40, "light"),
    ("Add animated signs on buildings showing their names", "nexus", 30, "light"),
    ("Build a power plant building that powers the whole factory", "nexus", 35, "light"),
    ("Add a water tower for the cooling systems", "nexus", 25, "light"),
    ("Build a communication tower with blinking lights", "nexus", 30, "light"),
    ("Add a recycling center for failed/retried tasks", "nexus", 35, "light"),
    ("Build a training center building where new workers spawn", "nexus", 40, "light"),
    ("Add a cafeteria building where idle workers gather", "nexus", 25, "light"),
    ("Build a server room building with blinking LED animations", "nexus", 35, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # REVENUE (30)
    # ═══════════════════════════════════════════════════════════════════════
    ("Enrich next 500 prospects with emails using the email finder", "email-finder", 80, "light"),
    ("Draft personalized cold emails for top 50 high-confidence prospects", "buildkit-services", 85, "light"),
    ("Build a CRM pipeline view at /crm showing prospect funnel stages", "buildkit-services", 75, "light"),
    ("Create a revenue dashboard showing projected MRR from pipeline", "buildkit-services", 70, "light"),
    ("Write 10 SEO blog posts for services.buildkit.store targeting SMB keywords", "buildkit-services", 65, "light"),
    ("Build an automated proposal generator — input business name, output custom page", "buildkit-services", 75, "heavy"),
    ("Create a case study page from the BarrelHouse CRM project", "buildkit-services", 70, "light"),
    ("Build an ROI calculator that generates personalized PDF reports", "buildkit-services", 60, "light"),
    ("Design a client portal at /portal for active clients to see dashboards", "buildkit-services", 65, "heavy"),
    ("Build an invoice generator for BuildKit Services", "buildkit-services", 55, "light"),
    ("Create a testimonial collection system — automated email after project delivery", "buildkit-services", 50, "light"),
    ("Build a lead scoring model — rank prospects by likelihood to convert", "buildkit-services", 65, "light"),
    ("Create a pricing comparison page — BuildKit vs hiring a developer", "buildkit-services", 55, "light"),
    ("Build an automated follow-up sequence — 5 emails over 2 weeks", "buildkit-services", 70, "light"),
    ("Create a demo booking page with Calendly integration", "buildkit-services", 60, "light"),
    ("Build a referral program page — offer discounts for client referrals", "buildkit-services", 45, "light"),
    ("Create industry-specific landing pages (restaurants, fitness, real estate)", "buildkit-services", 65, "light"),
    ("Build a competitive analysis tool — compare BuildKit to competitors", "buildkit-services", 50, "light"),
    ("Create a free audit tool at /audit that generates automated reports", "buildkit-services", 70, "light"),
    ("Build an email signature generator for the sales team", "buildkit-services", 35, "light"),
    ("Create a case study for the Email Finder product", "buildkit-services", 55, "light"),
    ("Build a partner/affiliate program page", "buildkit-services", 45, "light"),
    ("Create a 'How It Works' animated explainer section", "buildkit-services", 50, "light"),
    ("Build a client onboarding checklist at /onboarding", "buildkit-services", 55, "light"),
    ("Create a monthly newsletter template for prospects", "buildkit-services", 40, "light"),
    ("Build a prospect heatmap — visualize prospect locations on a map", "buildkit-services", 45, "light"),
    ("Create social proof widgets — live customer count, recent signups", "buildkit-services", 50, "light"),
    ("Build an A/B testing framework for landing pages", "buildkit-services", 55, "light"),
    ("Create a cold email domain health checker tool", "email-finder", 60, "light"),
    ("Build a prospect enrichment pipeline — auto-enrich new prospects daily", "email-finder", 65, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # EMAIL FINDER (20)
    # ═══════════════════════════════════════════════════════════════════════
    ("Add bulk email verification endpoint — verify 100 emails in one call", "email-finder", 65, "light"),
    ("Build a domain reputation checker — MX records, SPF, DKIM, DMARC", "email-finder", 55, "light"),
    ("Add email pattern detection — learn company email formats from known emails", "email-finder", 60, "light"),
    ("Build a bounce rate predictor — estimate deliverability before sending", "email-finder", 50, "light"),
    ("Add LinkedIn profile enrichment — find email from LinkedIn URL", "email-finder", 65, "light"),
    ("Build a catch-all domain detector — identify domains that accept all emails", "email-finder", 45, "light"),
    ("Add email change detection — flag when a known email starts bouncing", "email-finder", 40, "light"),
    ("Build a company directory scraper — find all emails for a company domain", "email-finder", 55, "light"),
    ("Add role-based email filtering — exclude info@, support@, etc.", "email-finder", 35, "light"),
    ("Build an email warmup tracker — monitor warmup progress for sending domains", "email-finder", 50, "light"),
    ("Add WHOIS lookup integration — find domain owner contact info", "email-finder", 45, "light"),
    ("Build a duplicate email detector across all prospect lists", "email-finder", 40, "light"),
    ("Add email format guesser — generate likely emails from name + domain", "email-finder", 50, "light"),
    ("Build a prospect import tool — CSV upload with auto-enrichment", "email-finder", 55, "light"),
    ("Add real-time email validation in the Chrome extension", "email-finder", 45, "light"),
    ("Build a domain age checker — older domains tend to have better deliverability", "email-finder", 35, "light"),
    ("Add email confidence scoring — multi-signal scoring for each found email", "email-finder", 55, "light"),
    ("Build an email finder API rate limiter — prevent abuse and manage costs", "email-finder", 40, "light"),
    ("Add social media profile finder — find Twitter/LinkedIn from email", "email-finder", 50, "light"),
    ("Build a prospect dedup tool — merge duplicate records across sources", "email-finder", 45, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # INFRASTRUCTURE (15)
    # ═══════════════════════════════════════════════════════════════════════
    ("Add Sentry error tracking to all Nexus API routes", "nexus", 60, "light"),
    ("Build a CI/CD pipeline status widget — show GitHub Actions status", "nexus", 55, "light"),
    ("Add database query performance monitoring — log slow queries", "nexus", 50, "light"),
    ("Build automated database backups — daily Supabase pg_dump", "nexus", 55, "light"),
    ("Add uptime monitoring — ping all services every 5 minutes", "nexus", 60, "light"),
    ("Build a log aggregation system — centralize logs from all workers", "nexus", 50, "light"),
    ("Add environment variable validation on startup — fail fast if missing", "nexus", 45, "light"),
    ("Build a deployment rollback script — one-click revert to previous version", "nexus", 55, "light"),
    ("Add request tracing — trace ID through API route to worker to completion", "nexus", 50, "light"),
    ("Build a service dependency map — visualize which services depend on what", "nexus", 45, "light"),
    ("Add SSL certificate expiry monitoring for all domains", "nexus", 40, "light"),
    ("Build a cost allocation dashboard — track costs per project per day", "nexus", 55, "light"),
    ("Add automated PR labeling — tag PRs by project, type, and priority", "nexus", 45, "light"),
    ("Build a changelog generator — auto-generate from merged PRs", "nexus", 40, "light"),
    ("Add a cron job health dashboard — show status of all scheduled tasks", "nexus", 50, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # CONTENT & SEO (20)
    # ═══════════════════════════════════════════════════════════════════════
    ("Write a blog post: 'How AI Agents Can Run Your Business While You Sleep'", "buildkit-services", 60, "light"),
    ("Write a blog post: '5 Signs Your Business Needs Automation'", "buildkit-services", 55, "light"),
    ("Write a blog post: 'CRM vs Spreadsheet: Why Growing Businesses Need a Real System'", "buildkit-services", 55, "light"),
    ("Write a blog post: 'The True Cost of Manual Data Entry in 2026'", "buildkit-services", 50, "light"),
    ("Write a blog post: 'Email Automation 101: From Cold Outreach to Closed Deals'", "buildkit-services", 55, "light"),
    ("Create SEO-optimized meta descriptions for all buildkit-services pages", "buildkit-services", 45, "light"),
    ("Build an XML sitemap generator for services.buildkit.store", "buildkit-services", 50, "light"),
    ("Add structured data (JSON-LD) to all service pages", "buildkit-services", 55, "light"),
    ("Create Open Graph images for all blog posts and landing pages", "buildkit-services", 40, "light"),
    ("Write a comparison page: BuildKit vs Zapier vs Make for automation", "buildkit-services", 55, "light"),
    ("Build a knowledge base / FAQ section with common client questions", "buildkit-services", 50, "light"),
    ("Create a 'Results' page showing metrics from all client projects", "buildkit-services", 55, "light"),
    ("Write a blog post: 'Restaurant Technology Stack: What Every Owner Needs in 2026'", "buildkit-services", 50, "light"),
    ("Create a video script for a BuildKit Services explainer video", "buildkit-services", 45, "light"),
    ("Build an RSS feed for the BuildKit Services blog", "buildkit-services", 35, "light"),
    ("Write a blog post: 'How to Choose the Right CRM for Your Small Business'", "buildkit-services", 50, "light"),
    ("Create a glossary page defining automation and CRM terms", "buildkit-services", 35, "light"),
    ("Write a blog post: 'Automating Invoice Collection: Save 10 Hours Per Week'", "buildkit-services", 50, "light"),
    ("Create a downloadable PDF lead magnet: 'Automation Readiness Checklist'", "buildkit-services", 55, "light"),
    ("Build an internal linking strategy — connect all blog posts and service pages", "buildkit-services", 40, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # OUTREACH (15)
    # ═══════════════════════════════════════════════════════════════════════
    ("Build a LinkedIn connection request template generator", "buildkit-services", 50, "light"),
    ("Create a cold DM template for Twitter/X outreach", "buildkit-services", 45, "light"),
    ("Build an email warmup schedule calculator", "buildkit-services", 40, "light"),
    ("Create a prospect research checklist — what to look up before outreach", "buildkit-services", 35, "light"),
    ("Build a follow-up timing optimizer — best days/times to send emails", "buildkit-services", 50, "light"),
    ("Create a personalization field generator — auto-fill merge tags from prospect data", "buildkit-services", 55, "light"),
    ("Build a reply rate tracker — which templates get the most responses", "buildkit-services", 50, "light"),
    ("Create an objection handling guide for common sales objections", "buildkit-services", 40, "light"),
    ("Build a meeting prep automation — auto-research prospect before call", "buildkit-services", 55, "light"),
    ("Create a post-meeting follow-up template generator", "buildkit-services", 40, "light"),
    ("Build a deal pipeline stage automation — auto-advance based on actions", "buildkit-services", 50, "light"),
    ("Create a prospect rejection handling system — nurture rejected leads", "buildkit-services", 35, "light"),
    ("Build a cold email A/B test framework — test subject lines and CTAs", "buildkit-services", 55, "light"),
    ("Create a referral request email template", "buildkit-services", 35, "light"),
    ("Build a prospect engagement scoring — track opens, clicks, replies", "buildkit-services", 50, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # TESTING (20)
    # ═══════════════════════════════════════════════════════════════════════
    ("Add unit tests for ScoutAgent — test evaluation, filtering, firing", "nexus", 60, "light"),
    ("Add unit tests for TaskManager — test CRUD, claim, status transitions", "nexus", 60, "light"),
    ("Add unit tests for BudgetManager — test tracking, limits, enforcement", "nexus", 55, "light"),
    ("Add unit tests for SwarmMemory — test store, recall, failed approaches", "nexus", 55, "light"),
    ("Add unit tests for Supervisor — test patrol, stuck task detection", "nexus", 50, "light"),
    ("Add unit tests for Oracle — test briefing, daily digest, weekly report", "nexus", 50, "light"),
    ("Add integration tests for the orchestrator main loop", "nexus", 55, "light"),
    ("Add API route tests for /api/heartbeat endpoint", "nexus", 50, "light"),
    ("Add API route tests for /api/agents endpoint", "nexus", 45, "light"),
    ("Build a test fixture factory for creating mock tasks and workers", "nexus", 50, "light"),
    ("Add end-to-end tests for task lifecycle — create, queue, claim, complete", "nexus", 60, "light"),
    ("Add tests for worker scaling logic in the orchestrator", "nexus", 50, "light"),
    ("Build a load test script — simulate 1000 tasks and measure throughput", "nexus", 55, "light"),
    ("Add tests for the goal decomposer — verify subtask generation", "nexus", 50, "light"),
    ("Add tests for config validation — verify all required env vars", "nexus", 40, "light"),
    ("Build a smoke test that verifies all API endpoints return 200", "nexus", 45, "light"),
    ("Add tests for the Discord webhook integration", "nexus", 40, "light"),
    ("Add tests for the auto-merge system — verify PR quality checks", "nexus", 50, "light"),
    ("Build a CI test runner — run all tests on PR creation", "nexus", 55, "light"),
    ("Add snapshot tests for the game view React components", "nexus", 45, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # SECURITY & PERFORMANCE (15)
    # ═══════════════════════════════════════════════════════════════════════
    ("Audit all API routes for authentication — add auth middleware where missing", "nexus", 65, "light"),
    ("Add input sanitization to all API endpoints — prevent injection attacks", "nexus", 60, "light"),
    ("Implement API key rotation — generate new keys without downtime", "nexus", 50, "light"),
    ("Add CORS configuration — restrict origins to known domains only", "nexus", 55, "light"),
    ("Build a request rate limiter — prevent API abuse", "nexus", 50, "light"),
    ("Add CSP headers to all pages — prevent XSS attacks", "nexus", 45, "light"),
    ("Optimize Supabase queries — add indexes for common query patterns", "nexus", 60, "light"),
    ("Add connection pooling for Supabase — reuse connections across workers", "nexus", 55, "light"),
    ("Implement lazy loading for dashboard components — reduce initial bundle", "nexus", 50, "light"),
    ("Add image optimization — use next/image for all images", "nexus", 40, "light"),
    ("Implement virtual scrolling for long task lists", "nexus", 50, "light"),
    ("Add service worker for offline support — cache static assets", "nexus", 45, "light"),
    ("Optimize game view rendering — use requestAnimationFrame and canvas", "nexus", 55, "light"),
    ("Add gzip compression to API responses", "nexus", 40, "light"),
    ("Build a performance budget — alert when bundle size exceeds threshold", "nexus", 45, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # NEW FEATURES (25)
    # ═══════════════════════════════════════════════════════════════════════
    ("Build a Slack integration — post task completions to a Slack channel", "nexus", 55, "light"),
    ("Add GitHub webhook handler — auto-create tasks from GitHub issues", "nexus", 60, "light"),
    ("Build a Telegram bot for swarm control — start/stop/status commands", "nexus", 50, "light"),
    ("Add a REST API for external task submission — let other apps queue work", "nexus", 65, "light"),
    ("Build a plugin system — loadable task handlers for custom job types", "nexus", 55, "heavy"),
    ("Add a task scheduling system — schedule tasks for specific times", "nexus", 50, "light"),
    ("Build a multi-tenant mode — support multiple users with isolated queues", "nexus", 45, "heavy"),
    ("Add a task approval workflow — require human approval for high-cost tasks", "nexus", 55, "light"),
    ("Build a WebSocket connection for real-time task updates in the UI", "nexus", 60, "light"),
    ("Add email notifications — daily digest of swarm activity", "nexus", 45, "light"),
    ("Build a task template marketplace — share and discover task templates", "nexus", 40, "light"),
    ("Add a CLI dashboard — ncurses-style terminal UI for swarm monitoring", "nexus", 50, "light"),
    ("Build a task analytics page — charts showing task trends over time", "nexus", 55, "light"),
    ("Add a worker leaderboard — rank workers by tasks completed and quality", "nexus", 45, "light"),
    ("Build a swarm API SDK for JavaScript — npm package for integration", "nexus", 50, "light"),
    ("Add a task cost calculator — estimate cost before submitting", "nexus", 40, "light"),
    ("Build a swarm status page — public page showing uptime and metrics", "nexus", 55, "light"),
    ("Add file attachment support for tasks — upload files as task input", "nexus", 45, "light"),
    ("Build a task cloning feature — duplicate and modify existing tasks", "nexus", 35, "light"),
    ("Add a project health score — aggregate metrics per project", "nexus", 50, "light"),
    ("Build a natural language task creator — describe task in English, AI structures it", "nexus", 55, "light"),
    ("Add a task dependency visualization — show blocked tasks and what they wait for", "nexus", 50, "light"),
    ("Build a swarm configuration UI — edit config.py values from the dashboard", "nexus", 45, "light"),
    ("Add a task comparison view — compare outputs of similar tasks", "nexus", 40, "light"),
    ("Build an MCP server for the swarm — expose task CRUD as MCP tools", "mcp-servers", 65, "light"),

    # ═══════════════════════════════════════════════════════════════════════
    # PL ENGINE & MISC (20) — pad to 300
    # ═══════════════════════════════════════════════════════════════════════
    ("Add type hints to all remaining untyped functions in swarm/ package", "nexus", 45, "light"),
    ("Build a Dockerfile for the swarm orchestrator — containerize for Railway deploy", "nexus", 55, "light"),
    ("Add a /api/tasks endpoint — REST API for listing and filtering tasks", "nexus", 60, "light"),
    ("Build a task bulk actions UI — select multiple tasks and cancel/retry/boost", "nexus", 50, "light"),
    ("Add OpenTelemetry tracing spans to all worker task execution paths", "nexus", 45, "light"),
    ("Build a swarm metrics Prometheus exporter — /metrics endpoint", "nexus", 50, "light"),
    ("Add a dark mode favicon that matches the Nexus brand", "nexus", 25, "light"),
    ("Build a project onboarding wizard — add new projects via the UI", "nexus", 55, "light"),
    ("Add a task cost breakdown view — show token usage per task", "nexus", 45, "light"),
    ("Build a worker log streaming view — live tail of worker output", "nexus", 50, "light"),
    ("Create an MCP tool for email sending — wrap Resend API", "mcp-servers", 55, "light"),
    ("Create an MCP tool for prospect lookup — search by company name", "mcp-servers", 55, "light"),
    ("Build a swarm backup script — export all tasks and memory to JSON", "nexus", 40, "light"),
    ("Add a /api/scout/trigger endpoint — manually trigger scout evaluation", "nexus", 50, "light"),
    ("Build a task queue priority histogram — visualize priority distribution", "nexus", 40, "light"),
    ("Add a worker type badge in the game view — color-coded by tier", "nexus", 35, "light"),
    ("Build a task SLA tracker — alert when tasks exceed expected duration", "nexus", 50, "light"),
    ("Add a daily standup summary — auto-generated from completed tasks", "nexus", 45, "light"),
    ("Build a swarm restart button in the UI — graceful restart via API", "nexus", 55, "light"),
    ("Add a task queue aging visualization — highlight tasks waiting too long", "nexus", 45, "light"),
]


def main():
    parser = argparse.ArgumentParser(description="Deploy monthly goals to the Nexus Hive")
    parser.add_argument("--dry-run", action="store_true", help="Preview without inserting")
    args = parser.parse_args()

    print(f"Deploying {len(GOALS)} goals to Nexus Hive...")

    if args.dry_run:
        by_project = {}
        for title, project, priority, cost_tier in GOALS:
            by_project.setdefault(project, []).append(title)
        for proj, titles in sorted(by_project.items()):
            print(f"\n  [{proj}] — {len(titles)} goals")
            for t in titles[:3]:
                print(f"    - {t}")
            if len(titles) > 3:
                print(f"    ... and {len(titles) - 3} more")
        print(f"\nTotal: {len(GOALS)} goals. Run without --dry-run to deploy.")
        return

    from supabase import create_client

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    now = datetime.now(timezone.utc).isoformat()
    batch_size = 25
    inserted = 0
    failed = 0

    for i in range(0, len(GOALS), batch_size):
        batch = GOALS[i : i + batch_size]
        rows = []
        for title, project, priority, cost_tier in batch:
            rows.append(
                {
                    "id": str(uuid.uuid4()),
                    "task_type": "meta",
                    "title": title[:100],
                    "description": title,
                    "project": project,
                    "status": "queued",
                    "priority": priority,
                    "cost_tier": cost_tier,
                    "input_data": json.dumps({"prompt": title, "source": "monthly_deploy"}),
                    "output_data": json.dumps({}),
                    "created_at": now,
                    "queued_at": now,
                    "updated_at": now,
                    "retry_count": 0,
                    "max_retries": 3,
                    "depth": 0,
                }
            )

        try:
            resp = sb.table("swarm_tasks").insert(rows).execute()
            count = len(resp.data) if resp.data else len(rows)
            inserted += count
            print(f"  Batch {i // batch_size + 1}: inserted {count} tasks")
        except Exception as e:
            failed += len(batch)
            print(f"  Batch {i // batch_size + 1}: FAILED — {e}")

    print(f"\nDone! Inserted: {inserted}, Failed: {failed}, Total: {len(GOALS)}")

    # Verify queue depth
    try:
        resp = (
            sb.table("swarm_tasks")
            .select("id", count="exact")
            .eq("status", "queued")
            .execute()
        )
        print(f"Current queue depth: {resp.count} tasks")
    except Exception as e:
        print(f"Could not verify queue depth: {e}")


if __name__ == "__main__":
    main()
