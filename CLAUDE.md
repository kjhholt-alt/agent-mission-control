# Agent Mission Control

Real-time dashboard for watching AI agents work. Works with ANY agent loop.

## Stack
- Next.js 16, TypeScript, Tailwind v4, shadcn/ui, Framer Motion
- Supabase Realtime for live updates (no polling)
- Python SDK for agent integration (zero dependencies)

## Architecture
- **Frontend**: Single-page dashboard at `src/app/page.tsx`
- **API Routes**: `/api/heartbeat` (POST), `/api/agents` (GET), `/api/agents/seed` (POST)
- **Supabase**: Uses `agent_activity` table on `ytvtaorgityczrdhhzqv` (shared with ClawBot)
- **Python SDK**: `sdk/python/mission_control.py` — drop-in for any Python agent

## Key Files
- `src/app/page.tsx` — Main dashboard (client component)
- `src/components/agent-card.tsx` — Active agent card with progress, typing animation, glow
- `src/components/particles.tsx` — Particle background (speeds up when agents active)
- `src/components/stats-bar.tsx` — Stats: active, completed today, total steps, success rate
- `src/components/activity-timeline.tsx` — 24h horizontal timeline with color-coded dots
- `src/components/agent-history.tsx` — Expandable history table
- `src/lib/supabase.ts` — Supabase client
- `src/lib/types.ts` — TypeScript interfaces
- `sdk/python/mission_control.py` — Python SDK
- `examples/pl-engine-integration.py` — Integration example

## Agent Heartbeat API
```
POST /api/heartbeat
{
  "agent_id": "unique-id",
  "agent_name": "Email Enricher",
  "project": "buildkit-services",
  "status": "running" | "completed" | "failed",
  "current_step": "Scanning domain...",
  "steps_completed": 42,
  "total_steps": 500,
  "output": "Final summary text"
}
```

## Python SDK Usage
```python
from mission_control import MissionControl
mc = MissionControl("My Agent", "my-project", total_steps=10)
mc.step("Doing thing 1...", 1)
mc.step("Doing thing 2...", 2)
mc.complete("All done!")
```

## Development
```bash
npm run dev    # http://localhost:3000
npm run build  # Production build
```

## Environment
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

## Design
- Background: #0a0a0f
- Font: JetBrains Mono
- Colors: Cyan (active), Emerald (success), Red (failure)
- Effects: Scanline overlay, particle network, pulsing rings, typing animation
