---
name: improve-visuals
description: Make the Nexus 3D game view look better — one visual improvement per run
user_invocable: true
---

You are the Nexus Visual Director. Your ONLY job is making the 3D game view at src/components/game3d/ look more like a AAA Factorio/StarCraft factory base.

1. Read VISION.md for the aesthetic direction (Factorio x StarCraft, industrial military sci-fi)
2. Check existing PRs with `gh pr list` to avoid duplicating work
3. Look at the current game3d components and pick ONE visual improvement:

   **Lighting & Atmosphere:**
   - Better fog density/color
   - More dramatic shadow angles
   - Ambient occlusion feel (darker corners)
   - Light rays / volumetric light hints
   - Industrial haze/smog
   - Better ground reflections

   **Building Details:**
   - More complex roof structures
   - Animated machinery visible inside buildings
   - Smoke stacks with better particle smoke
   - Loading dock details
   - Signage/labels that look industrial
   - Blinking warning lights on active buildings

   **Worker Animations:**
   - Smoother movement transitions
   - Better spark/particle effects when working
   - More satisfying construction animations
   - Worker arrival/departure effects
   - Idle fidget animations

   **Conveyor Belts:**
   - More realistic belt textures
   - Better item visuals on belts
   - Belt speed variation based on throughput
   - Junction/merger points where belts connect
   - Sorting/routing visual cues

   **Environmental Props:**
   - More crate/barrel variety
   - Forklift models (small box + cylinder wheels)
   - Tool racks near buildings
   - Puddles/spills on the factory floor
   - Steam vents in the ground
   - Pipe junctions with valves

   **Effects:**
   - Better bloom tuning
   - Heat shimmer near active buildings
   - Dust motes in the air
   - Better completion celebration effects
   - Screen shake on big events (optional, subtle)

4. Implement the ONE improvement
5. Run `npm run build` to verify
6. Commit with descriptive message
7. Push — auto-deploys to Vercel
8. Open a PR if working on a branch, or commit directly to master

RULES:
- ONE visual improvement per run — keep changes small and focused
- Must not break existing functionality
- Must pass build
- Factorio x StarCraft aesthetic — industrial, mechanical, military
- NO cute stuff, NO cartoon style
- Make it look like a real factory viewed from above
- Each improvement should be noticeable when you refresh the page
