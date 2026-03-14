---
name: improve
description: Review Nexus, identify one visual or functional improvement, implement it on a branch, and open a PR
user_invocable: true
---

You are improving Nexus — a real-time strategy game visualization for AI agent work. Think StarCraft workers, Factorio conveyor belts, Cities: Skylines city building.

1. Read CLAUDE.md to understand the project
2. Check existing open PRs with `gh pr list` to avoid duplicating work
3. Pick ONE improvement from these categories (ROTATE — don't repeat the same category):

   **Visual Polish:**
   - Improve building rendering (better shapes, shadows, glow effects)
   - Add new particle effects (sparks, data flow, completion rings)
   - Improve worker animations (smoother walking, better idle states)
   - Add hover effects on buildings/workers
   - Improve the isometric grid (better tiles, depth sorting)
   - Add a day/night cycle (background color shifts, window lights)
   - Improve conveyor belt animations

   **Game Features:**
   - Add camera pan/zoom controls
   - Add click-to-select on buildings (show info panel)
   - Add click-to-select on workers (show task details)
   - Add a minimap
   - Add keyboard shortcuts (Space=pause, Tab=cycle workers)
   - Add drag-to-pan
   - Add building "level up" visuals based on activity

   **HUD & UI:**
   - Improve the resource bar (tokens, budget, uptime)
   - Add an agent queue panel
   - Add alert toasts for escalations
   - Add a stats panel (throughput, active workers)
   - Add tooltips on hover
   - Improve mobile responsiveness

   **Data & Integration:**
   - Connect to Supabase Realtime for live agent updates
   - Add git webhook integration for commit particles
   - Add n8n workflow status integration
   - Improve the Python SDK for agent reporting
   - Add more demo/seed data for testing

   **Audio:**
   - Add "Job's done!" sound on task completion
   - Add worker select click sound
   - Add ambient background music
   - Add alert klaxon for errors
   - Add volume controls

   **New Buildings/Sprites:**
   - Add new building types (resource nodes for Supabase, Vercel, Railway)
   - Add different worker sprite variants
   - Add construction animations for new deployments
   - Add road/path rendering between buildings

4. Create a new branch: `improve/[short-description]`
5. Implement the improvement (keep it focused)
6. Run `npm run build` to verify
7. Commit with a clear message
8. Push and open a PR with `gh pr create`

IMPORTANT RULES:
- ONE improvement per run
- Never push to main
- If build fails, revert and try something else
- ROTATE categories — make it visually better every time
- This should be FUN and look IMPRESSIVE

## Auto-Merge

After opening the PR:
- Run tests to verify everything passes: `npm run build`
- If build succeeds, merge the PR: `gh pr merge {number} --merge --delete-branch`
- Pull main: `git checkout main && git pull`
- Report: "PR #{number} auto-merged. Build passing."
- If build fails, do NOT merge — revert changes and report the failure
