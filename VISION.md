# Agent Mission Control — Product Vision

## The Pitch
"StarCraft meets AI agents. Watch your AI workers build, mine data, and improve your codebase in real-time. Click any worker to inspect, redirect, or stop them."

## Core Concept
AI agents are visualized as RTS game workers on an isometric map. Each project is a building. Workers walk between buildings when assigned tasks. Conveyor belts show data flowing. You can click any worker to see what they're doing, why, and redirect them.

## Worker Types (Specialized Agent Roles)

Each worker has a different role, color, and job. On the map you see different colored workers doing different things.

| Worker | Color | Role | Powered By |
|--------|-------|------|-----------|
| **Builder** | Cyan | Writes code, creates features, opens PRs | `/improve` skill |
| **Inspector** | Gold | Reviews code, audits, finds bugs, plans fixes | `@reviewer` agent |
| **Miner** | Green | Scrapes data, enriches emails, finds prospects | Prospector + email finder |
| **Scout** | Purple | Researches, plans, explores new ideas | Planning agents |
| **Deployer** | Orange | Deploys, monitors, verifies production | Deploy scripts + health checks |
| **Messenger** | Blue | Sends emails, notifications, follow-ups | Emailer + n8n workflows |

Each worker type has its own skill/agent file in `.claude/`. The auto-improvement loop randomly assigns worker types — sometimes a Builder making a PR, sometimes an Inspector doing a code review, sometimes a Scout planning the next feature.

On the map: gold Inspector walks to a building to audit it, cyan Builder hammers away, green Miner collects data at the prospect node, orange Deployer runs to Vercel/Railway resource nodes.

All powered by Claude.

## Art Direction: StarCraft 2 x Factorio x Pokemon

### StarCraft 2 DNA
- Dark sci-fi aesthetic with holographic edges on buildings
- Glowing blue/cyan HUD with military-grade typography
- Command Center is a massive Terran base with pulsing energy core
- Buildings have shield generators, antenna arrays, structural detail
- Alert klaxons with red flashing for errors
- Selection circles glow under workers when clicked
- Fog of war on inactive project zones

### Factorio DNA
- Industrial conveyor belts connecting every building
- Throughput counters on each belt (items/min = commits/hr, emails/hr)
- Factory buildings have visible machinery — gears turning, pistons pumping
- Inserter arms picking up "data packets" and placing on belts
- Bottleneck visualization (red belt = slow, green belt = flowing fast)
- Research/tech tree for unlocking new agent capabilities
- Efficiency percentage on each building

### Pokemon DNA
- Workers are CUTE characters (not realistic — stylized, big eyes, expressive)
- **Evolution system**: Workers evolve based on XP (tasks completed)
  - Stage 1 (0-10 tasks): Small, basic sprite — learning the ropes
  - Stage 2 (10-50 tasks): Medium, more detailed — getting good
  - Stage 3 (50+ tasks): Large, legendary form — absolute unit
- **Type system** matching worker roles:
  - Builder = Steel type (cyan metallic glow)
  - Inspector = Psychic type (gold aura, floating)
  - Miner = Ground type (green, earthy)
  - Scout = Flying type (purple, wings/antenna)
  - Deployer = Fire type (orange, rocket boosters)
  - Messenger = Electric type (blue, lightning trails)
- Workers have **mood indicators** (happy face when tasks go well, frustrated when builds fail)
- **Collection/Pokedex**: Track all your worker types and their evolution stages
- **Nicknames**: Name your workers ("PR Machine", "Email Hunter", "The Auditor")
- Workers gain XP and show level badges

### Combined Aesthetic
The overall feel: a dark, industrial sci-fi base (StarCraft) with visible automation pipelines (Factorio) staffed by cute, evolving AI creatures (Pokemon). It shouldn't look like any single game — it should feel like its own unique thing.

Color palette:
- Background: #050508 (near black with blue tint)
- Primary: #06b6d4 (cyan — StarCraft Protoss energy)
- Secondary: #e8a019 (gold — Pokemon evolution glow)
- Accent: #10b981 (emerald — Factorio belt flow)
- Danger: #ef4444 (red — alerts)
- Buildings: Dark metal with glowing edges (StarCraft)
- Belts: Industrial with animated items (Factorio)
- Workers: Colorful, expressive, cute (Pokemon)

## Key Innovation: Agent Orchestration via Game UI

### Click-to-Inspect Workers
When you click a worker:
1. Worker pauses, shows speech bubble
2. Info panel shows:
   - What they're currently doing
   - WHY they're doing it
   - Progress (step X of Y)
   - What's next in their queue
   - Time elapsed, tokens used, cost
3. Action buttons:
   - **Resume** — continue working
   - **Redirect** — type new instructions, worker switches tasks
   - **Stop** — kill the agent, revert changes
   - **Prioritize** — move to front of queue

### Speech Bubbles
Workers periodically say what they're doing:
- "Mining data from rainmasterqc.com..."
- "Found an email! office@creativeoutdoorsqc.com"
- "PR ready for review!"
- "Build failed, retrying..."
- "Job's done!"

### Building Interaction
Click a building to see:
- Project health (tests passing, deploy status, last activity)
- Assigned workers
- Task queue for this project
- Deploy history
- "Assign new worker" button to spawn an agent

## Command Center / HQ Building

Click the main base (Command Center) and it opens a **headquarters panel** — the nerve center of your entire operation.

### HQ Dashboard Shows:
- **Top token usage** — which agents are burning the most tokens
- **All active agents** — current task, progress, elapsed time
- **Quick stats** — total PRs, emails sent, prospects found, tests passing
- **System health** — all services green/red (Supabase, Vercel, Railway, n8n)

### API Connection Manager
A settings panel where you connect all your services. Green checkmark = connected, red X = needs setup.

| Service | Key Needed | Status |
|---------|-----------|--------|
| Supabase | URL + Anon Key + Service Key | Connected |
| Vercel | Token | Connected |
| Railway | Token | Connected |
| Resend | API Key | Connected |
| Google Places | API Key | Connected |
| Anthropic (Claude) | API Key | Connected |
| GitHub | Token | Connected |
| Discord | Webhook URL | Connected |
| n8n | API Key + Base URL | Connected |
| LemonSqueezy | API Key + Store ID | Not Set |
| Google Search Console | Verification Code | Not Set |

When someone new wants to use Agent Mission Control, they:
1. Open the HQ building
2. See which APIs need connecting (red indicators)
3. Paste in their keys
4. Everything lights up green
5. Workers start moving

This makes it a **plug-and-play product** — not just for us.

## Revenue Potential
- **Free tier**: 1 project, 3 workers, basic map
- **Pro ($29/mo)**: Unlimited projects, 10 workers, conveyor belts, audio
- **Team ($79/mo)**: Shared maps, team workers, analytics
- **Enterprise**: Custom sprites, white-label, API access

## Why It Goes Viral
1. Nobody has done this — it's genuinely novel
2. Every developer who played StarCraft/Factorio instantly gets it
3. A 15-second screen recording is inherently shareable
4. It's REAL — workers move because actual agents are doing actual work
5. The click-to-inspect feature makes it useful, not just pretty

## Technical Stack
- PixiJS for 60fps isometric rendering
- React overlay for HUD
- Supabase Realtime for live updates
- Howler.js for audio
- Python SDK for agent reporting
- Next.js for the web app

## Phases
1. Static isometric map with buildings (~3 hrs)
2. Animated workers that walk to buildings (~3 hrs)
3. Factorio conveyor belts with data particles (~2 hrs)
4. Full HUD — minimap, info panels, alerts (~2 hrs)
5. Audio + polish (~1 hr)
6. Worker interaction — click to inspect/redirect/stop (~3 hrs)
7. Cities: Skylines macro view (future)
8. Multiplayer / team view (future)
