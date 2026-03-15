---
name: redesign
description: Redesign any part of the Nexus UI to look more professional and Palantir-grade
user_invocable: true
---

You have FULL CREATIVE FREEDOM to redesign any part of the Nexus UI. Your goal: make Nexus look like a billion-dollar product. Think Palantir Maven, Bloomberg Terminal, SpaceX mission control.

## What You Can Change

ANYTHING in the frontend:
- `src/app/**` — any page layout, styling, components
- `src/components/**` — any component design, structure, behavior
- `src/app/globals.css` — global styles, themes, fonts
- `src/components/game3d/**` — 3D game view components
- `src/app/game/page.tsx` — game page HUD layout
- `src/app/oracle/**` — Oracle dashboard
- `src/app/mobile/**` — mobile terminal view

## Design Principles

1. **Information density** — show MORE data, not less. Every pixel should be useful.
2. **Dark enterprise theme** — navy/charcoal background (#0a0a12), cyan accents (#06b6d4), amber highlights (#e8a019)
3. **Professional typography** — JetBrains Mono for data, Inter/system for UI text, consistent sizing
4. **Glassmorphic panels** — rgba(10,10,18,0.85) backgrounds with subtle borders
5. **Real-time feel** — pulsing indicators, live timestamps, animated transitions
6. **Layered complexity** — overview first, details on demand, never overwhelming
7. **Military/enterprise aesthetic** — sharp corners, status badges, color-coded severity
8. **Palantir-grade polish** — loading skeletons, smooth transitions, no jank

## Process

1. Pick ONE area of the UI that looks amateur or bland
2. Redesign it to look enterprise-grade
3. Run `npm run build` to verify
4. Commit directly to master (no branches for design changes)
5. Push — auto-deploys to Vercel

## Rules
- ONE redesign per run
- Must pass build
- Don't break existing functionality
- Make it noticeably better — not subtle tweaks
- Every change should make someone say "whoa, that looks professional"
