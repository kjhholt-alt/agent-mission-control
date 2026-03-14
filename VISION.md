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

## More Game Inspirations

### Farming Simulator 25
- **Harvesting rows** — When the email enricher scans prospects, visualize it as a combine harvesting rows of data. Each row lights up as it's processed. Deeply satisfying.
- **Baling/packaging** — When results are compiled (merge CSVs, generate reports), show the data getting "baled" into packages
- **Selling at market** — When a cold email gets a reply or a client signs, show the "harvest" being sold at a market building. Revenue counter goes up.
- **Seasonal cycles** — Projects have seasons: planting (planning), growing (building), harvesting (shipping), selling (revenue)

### Path of Exile
- **Passive skill tree** — A massive skill tree for your agent capabilities. Unlock new skills: "Email Finding", "SEO Content", "Code Review", "Deployment". Visual tree you can zoom into.
- **Loot drops** — When agents complete tasks, they "drop loot": emails found, PRs merged, bugs fixed. Loot has rarity: Common (pattern email), Rare (mailto link), Legendary (owner's personal email with 100% confidence)
- **Maps/Dungeons** — Each project is a "dungeon" agents can run. Harder dungeons = more complex tasks. Boss fights = major refactors or deployments.
- **Flask system** — Temporary boosts: "Focus Flask" (agent works faster), "Precision Flask" (higher accuracy), "Endurance Flask" (longer sessions)

### Hearts of Iron
- **Grand strategy map** — Zoom ALL the way out and see your entire operation as a world map. Different "territories" = different markets (Iowa, Illinois, etc.). Color-coded by control (prospects contacted vs not)
- **Production lines** — Like Factorio but more strategic. See your entire pipeline capacity: "Email finding: 50/hr capacity, 32/hr utilization (64%)"
- **Division management** — Group agents into "divisions" for coordinated attacks. "Iowa Outreach Division" = 3 miners + 1 messenger working together
- **Research tree** — Unlock new agent capabilities over time through research (building new tools)

### Ballpit
- **Physics satisfaction** — When data accumulates, show it physically piling up. Emails found pile into a bin. PRs stack up. Revenue coins cascade into a treasury.
- **Idle accumulation** — Even when you're not watching, things pile up. Come back and see what accumulated overnight.
- **Tactile feel** — Everything should feel physical and satisfying. Clicks have weight. Things bounce, stack, cascade.

### Slay the Spire
- **Card-based decisions** — When an agent reaches a decision point, show it as cards: "Add type hints" vs "Add tests" vs "Refactor function". The auto-improvement loop picks a card each run.
- **Deck building** — Your agent's "deck" is their skill set. As they level up, they add new cards (capabilities).
- **Branching paths** — After completing a task, the agent chooses the next path. Show the branch visually on the map.
- **Relics** — Permanent passive bonuses unlocked over time: "Supabase Relic: +20% data query speed", "Resend Relic: +10% email deliverability"

### World of Warcraft
- **Raids** — Multi-agent coordinated tasks. 5 agents working together on a big feature = a raid. Show them all at the same building with roles (tank=Builder, healer=Inspector, DPS=Miner)
- **Quest log** — Every task is a quest with objectives, rewards (XP), and completion status. Side quests for bonus work.
- **XP and leveling** — Agents gain XP from completed tasks. Level up unlocks new abilities. Show a level-up animation with fanfare.
- **Gear/Equipment** — Agents can be "equipped" with tools: "Equipped: Resend API (+email sending)", "Equipped: Google Places API (+prospect finding)"
- **Talent trees** — Specialize agents: a Builder can spec into "Testing" or "Refactoring" branches
- **Guild system** — Your team of agents is a guild. Guild achievements: "First PR merged", "100 emails found", "First client signed"
- **Achievement system** — Pop-up achievements: "Email Hunter: Found 100 emails", "Code Machine: Merged 10 PRs", "Revenue Runner: First $100 earned"

### Skyrim
- **Open world exploration** — Agents can be sent to "explore" new markets/niches. They discover opportunities like discovering a dungeon. "Your Scout discovered 47 plumbing businesses in Dubuque!"
- **Skill progression per agent** — Each agent has a skill page like Skyrim: Smithing (building), Archery (accuracy), Speech (email outreach). Skills level up with use.
- **Compass/waypoints** — Top of screen shows markers for active tasks with distance. "PR ready for review → PL Engine [2 min away]"
- **Dragon shouts** — Special powerful abilities with cooldowns. "FUS RO DAH: Deploy All" (deploys every project at once). "WULD NAH KEST: Sprint Mode" (agent works 3x speed for 5 minutes)
- **Inventory system** — Each agent carries "items" (API keys, credentials, context files). Manage their loadout.
- **Radiant quest system** — Auto-generated tasks based on current state: "There are 47 prospects without emails in Cedar Rapids. Send a Miner?"

### Card Shop Game (TCG Shop Simulator)
- **Card collecting** — Every completed task generates a collectible card. Cards have stats, rarity, artwork. Build a collection over time.
- **Card shop display** — Show your best achievements as cards in a display case on the dashboard
- **Pack opening** — When an agent finishes a big task, animate a "pack opening" revealing what was accomplished (emails found, PRs merged, bugs fixed)
- **Trading** — In multiplayer/team mode, trade agent configurations and skill setups
- **Card grading** — Rate the quality of each PR/task output: S/A/B/C/D tier

### Megabonk
- **Satisfying impact** — Every action should have WEIGHT. Clicking send on an email batch = screen shake + impact effect. Merging a PR = bonk sound + ripple.
- **Combo system** — Chain successful tasks for multipliers. 3 PRs merged in a row = 3x XP combo. Visual combo counter on screen.
- **Escalating intensity** — As more agents are active, everything gets more intense: music speeds up, particles increase, glow brightens, screen energy rises

### Europa Universalis IV (EU4)
- **Territory control map** — Your market coverage as a map. Colored territories for each city where you have prospects. Expand by running prospector in new regions.
- **Diplomatic relations** — Track client relationships: "Allied" (active client), "Friendly" (replied to email), "Neutral" (contacted), "Unknown" (new prospect)
- **Trade routes** — Revenue flows visualized as EU4 trade routes between your base and client territories
- **Technology groups** — Different tech levels for different agent capabilities. Research to advance.
- **Casus belli** — Justified reasons to reach out to a prospect: "They have no blog (CB: Missing SEO)", "Competitor has better reviews (CB: Market Advantage)"
- **Coalition management** — When running multiple agents on the same project, manage them like a coalition — they need to not conflict
- **Timeline scrubber** — Scrub through time to see how your empire grew. "In January you had 0 prospects. By March you had 2,024."

## Phases
1. Static isometric map with buildings (~3 hrs)
2. Animated workers that walk to buildings (~3 hrs)
3. Factorio conveyor belts with data particles (~2 hrs)
4. Full HUD — minimap, info panels, alerts (~2 hrs)
5. Audio + polish (~1 hr)
6. Worker interaction — click to inspect/redirect/stop (~3 hrs)
7. Cities: Skylines macro view (future)
8. Multiplayer / team view (future)
