# Pest Nests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; there's no time for per-task subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tower destroyed by pests leaves a **pest nest** in its place. During the next wave, extra pests crawl out of the nest onto the nearby path, so keeping towers alive matters.

**Architecture:**
- The nest rules are pure functions in a new `src/logic/nests.js`, plus one path helper. Nests live in `state.nests`.
- At wave start, nest spawns are merged into the normal wave schedule. The wave can't clear until they're done, and nothing else in the wave flow changes.
- GameScene draws the nests and moves pests from a nest onto the path.
- A config switch `NESTS.enabled` turns the feature off.

**Tech Stack:** Phaser 4.2.1, Vite, Vitest.

**Spec:** The user's request (2026-11-25, 14:20): "When a tower gets destroyed by the enemy, it should become a spawner of enemies for the next round so it is extra important to keep towers alive."

Calls made when writing this plan (the user can correct them):

| Topic | Decision |
|---|---|
| When it spawns | During the **first wave that starts after** the tower died, so a tower lost mid-wave spawns next wave. At that wave's clear the nest collapses (dust burst) and the spot is free again. |
| What spawns | It depends on the dead tower: Cork Cannon → flies, Sommelier → corkscrews, Decanter → corkscrews, Thomas → rats. Count = **2 + 2 × level** (level 0–2), one every **1.2 s**, starting **2 s** into the wave. HP is scaled by the wave's `hpMult` (Endless). |
| Where they enter | The point on the path closest to the nest. They walk on toward the Grand Cru from there, which is why a nest deep in the cellar is dangerous. Each pest visibly scuttles from the nest to that point (about 300 ms tween), then walks normally. |
| Building on it | Blocked while the nest stands (reason `'occupied'`). |
| Selling | A sold tower leaves **no** nest. Only destruction does. |
| Feedback | When a tower dies: floatText `"A pest nest!"` and a one-time toast `"Destroyed towers become pest nests next wave. Repair in time!"`. The Next-wave preview adds `· Nests +N` when nests are armed. |
| Demo keys | `1`–`7` (jump to a wave) clear all nests first, so jumps stay clean. `D` (towers to 25% HP) is unchanged. |
| Kill switch | `NESTS.enabled` (`src/config/enemies.js`). With `false`, no nests are ever created. |

## Global Constraints

- **It's late:** the feature freeze is **15:15**, demo prep 15:45 and the demo 16:00. Time-box this plan to 50 minutes. If it isn't solid by 15:15, set `NESTS.enabled = false`, push, and log it in `REGRET.md`. A broken demo is worse than a missing feature.
- Work in `C:\Users\Thoma\dev\WTD` on `main`. Commit and push straight to `main` after each task (CLAUDE.md; pushing is pre-approved). The other two sessions (projector polish, playtest feedback 2) are merged and done. If `git status` shows someone else's uncommitted changes, stop and ask the user.
- Start with `git pull` and `npm test`.
- Phaser 4 APIs only (`.claude/skills/`: `tweens`, `particles`, `graphics-and-shapes`). Don't write Phaser 3 from memory.
- `src/logic/` stays Phaser-free. `npm test` must pass after every task.
- The game renders at 2× (`src/ui/hd.js`, `hdCamera`) with supersampled textures (`make()` in `src/art/textures.js`). New textures go through `make()`, and new pointer code uses `pointer.worldX/worldY`.
- Parody names only. Thomas is a generic sommelier, name only. Never reintroduce the Nexios sword, the victory bell or Pizza Hut.
- Keep the presenter keys working: `1`–`7`, `B`, `G`, `W`, `R`, `D`, `M`, `L`, `P`, `F`, and `T` on the title.

## Review Focus

1. **A wave doesn't clear while nest pests are still due:** they're in the runner's schedule. Task 1 Step 1 (merge test).
2. **A tower destroyed mid-wave** doesn't spawn in the current wave, and spawns in the next one. Task 1 Step 1 (`armNests`).
3. **Restart, Back to title, Play again and jump keys** leave no nests or nest sprites behind. Task 2 Step 5.
4. **Endless at 2× speed** with three nests: no frame drops and no console errors. Task 2 Step 5.
5. **Selling a damaged tower** never leaves a nest. Task 2 Step 5.

---

### Task 1: Nest rules (logic + tests)

**Files:**
- Modify: `src/config/enemies.js` (export `NESTS`)
- Modify: `src/logic/path.js` (new export)
- Create: `src/logic/nests.js`
- Modify: `src/logic/waves.js` (`createWaveRunner().tick` returns schedule entries, not type strings)
- Modify: `src/logic/towers.js` (`canPlace`: nests block)
- Modify: `src/logic/state.js` (`createGameState` adds `nests: []`)
- Test: `tests/logic/nests.test.js` (new), `tests/logic/path.test.js`, `tests/logic/waves.test.js`, `tests/logic/towers.test.js`

**Interfaces:**
- Produces:
  - `NESTS = { enabled: true, spawn: { cork: 'fly', sommelier: 'corkscrew', decanter: 'corkscrew', thomas: 'rat' }, base: 2, perLevel: 2, intervalMs: 1200, delayMs: 2000 }`
  - `distanceAlongPath(points, p) -> number`: the arc length along the polyline of the point closest to `p`, using the same projection as `distanceToPath`.
  - `createNest(placed) -> { id, x, y, type, level, armed: false }`, where `type` is the dead tower's type.
  - `armNests(nests) -> void`: sets `armed = true` on every nest. Call it at wave start, *before* building that wave's schedule.
  - `nestSchedule(nests, entryDistance: (nest) => number, hpMult) -> entries[]`: for each **armed** nest, `base + perLevel * level` entries `{ atMs: delayMs + i * intervalMs, type: NESTS.spawn[nest.type], hpMult, distance: entryDistance(nest), nestId: nest.id }`.
  - `collapseNests(state) -> nest[]`: removes the armed nests from `state.nests` and returns them (called at wave clear).
  - `createWaveRunner(schedule).tick(dtMs)` returns the due **entries**. GameScene then reads `entry.type`, `entry.distance ?? 0` and `entry.hpMult`.

- [ ] **Step 1: Write the failing tests.**
  - **`distanceAlongPath`:** on the path `[{x:0,y:0},{x:100,y:0},{x:100,y:100}]`, the point `{x:50,y:20}` gives 50, and `{x:120,y:60}` gives 160.
  - **`createNest`:** from `{ id: 7, type: 'thomas', x: 300, y: 200, level: 2 }` it is unarmed, with type `'thomas'` and level 2.
  - **Arming:** `nestSchedule` of an unarmed nest is `[]`. After `armNests`, a level-2 Thomas nest gives **6** entries, all `type 'rat'`, the first `atMs` 2000, then 3200, with `distance` from the callback and the given `hpMult`.
  - **Mid-wave destruction:** a nest created *after* `armNests` ran stays unarmed and produces no entries until the next `armNests`.
  - **`collapseNests`:** removes only armed nests and leaves the unarmed ones in `state.nests`.
  - **Merge:** `[...buildSchedule(w), ...nestSchedule(...)]` sorted by `atMs` and fed to `createWaveRunner`. The runner is not `done` until the last nest entry is ticked, and `tick` returns entry objects.
  - **`canPlace`:** a nest at `{x:300,y:200}` makes a placement at `{x:310,y:200}` return `{ ok: false, reason: 'occupied' }` (same `TOWER_SPACING` rule).
  - Update any existing waves test that expects `tick` to return strings.
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the interfaces above. `canPlace` checks `state.nests ?? []` with the same `near(…, TOWER_SPACING)` used for towers.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit and push:** `git commit -am "feat: pest nest rules"` (add `src/logic/nests.js` and `tests/logic/nests.test.js` first), then `git push`.

### Task 2: Nests in the game

**Files:**
- Modify: `src/art/textures.js` (new `nest` texture, 64×48, via `make()`)
- Modify: `src/scenes/GameScene.js` (`sweepTowers`, `startWave`, the runner loop in `update`, the wave-cleared branch, `jumpToWave`, `cleanup`)
- Modify: `src/scenes/HUDScene.js` (one-time toast; preview suffix)
- Modify: `README.md` (one line under the Nexios references / features: destroyed towers become pest nests)

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces:
  - `GameScene#nestSprites: Map<nestId, Container>`
  - Events: `'nest-created'` (nest), `'nests-collapsed'` (count), `'nests-armed'` (count). The HUD uses `'nest-created'` for its toast and `'nests-armed'` for the preview.

- [ ] **Step 1: Draw the `nest` texture.** It must read as "bad" at a glance on a projector:
  - a dark rubble mound of 3–4 broken stones
  - a black burrow hole
  - two pairs of small glowing red eyes (`#ff3a4a`)
  - a few wine-red cracks.
  
  Keep the style of the other procedural textures (gradients, gold/dark outlines).
- [ ] **Step 2: Create a nest on destruction.** In `sweepTowers`, when `NESTS.enabled`, for each dead tower:
  - `const nest = createNest(t.placed)`, push it to `this.state.nests`
  - add a container at the tower's spot (depth like the towers, `y + 20`) holding the `nest` image (pop in with `Back.easeOut`) and a slowly pulsing red glow (`light-soft`, tint `0xd01a3a`, ADD, depth above the darkness so it reads at night)
  - store the container in `nestSprites`
  - show `floatText "A pest nest!"` in red
  - emit `'nest-created'`.
  
  Selling (`sell`) must not create a nest.
- [ ] **Step 3: Spawn from the nests.**
  - **`startWave`:**
    1. `armNests(this.state.nests)`.
    2. `const extra = nestSchedule(this.state.nests, (n) => distanceAlongPath(PATH, n), wave.hpMult)`.
    3. Build the runner from `[...buildSchedule(wave), ...extra].sort((a, b) => a.atMs - b.atMs)`.
    4. Emit `'nests-armed'` with the number of armed nests.
    5. Make armed nest sprites shake and glow brighter.
  - **In `update`:** for each due entry, call `spawnEnemy(entry.type, entry.distance ?? 0, entry.hpMult)`. When `entry.nestId` is set, also:
    - place the pest at the nest
    - tween its sprite (or its `offX/offY`, the same fields the dash attack uses) from the nest to its path position over about 300 ms
    - show a small dust/spark burst at the nest
    - play `play('hit', { pitch: 0.7 })`.
  - **Wave cleared:** `collapseNests(this.state)`. For each collapsed nest, play a dust burst, fade and destroy its sprite, delete it from `nestSprites`, and emit `'nests-collapsed'`.
- [ ] **Step 4: Clean up and HUD.**
  - **`jumpToWave`:** clear all nests (state and sprites) before starting.
  - **`cleanup`/shutdown:** destroy all nest sprites, so Restart, Back to title and Play again are clean.
  - **HUD:** on the first `'nest-created'` of a run, `showToast('Destroyed towers become pest nests next wave. Repair in time!', 3200)`. While unarmed nests exist between waves, the Next-wave preview gets ` · Nests +N`, where N is the total nest pests (compute with `nestSchedule` on a copy marked armed, or `NESTS.base + NESTS.perLevel * level` summed).
  - **README:** add the feature line.
- [ ] **Step 5: Verify on the dev server** (`npm run dev`, 1280×720 viewport; screenshots plus console errors). Review Focus 1–5:
  1. `G G`, build 4 towers near the path, press `1`. Mid-wave press `D`, and let the pests finish a tower (or set its HP to 1 via `window.__game`). The nest appears with the toast, and **no** nest pests come this wave.
  2. Next wave: pests crawl out of the nest onto the path, and the wave doesn't clear until they're dead. At the clear the nest collapses and you can build on the spot again.
  3. Sell a damaged tower: no nest.
  4. Pause → Restart, Back to title → Play, End → Play again, and `3` mid-game: no leftover nests.
  5. Endless at 2× (`7` → Keep pouring, `F`) with 2–3 nests: smooth, with no console errors.
  - `npm test` passes.
- [ ] **Step 6: Commit and push:** `git commit -am "feat: destroyed towers become pest nests"`, then `git push`. Watch the deploy (`gh run list --limit 1`), then run the README demo script once on https://thomasokvs.github.io/WTD/. If anything in the demo script misbehaves and can't be fixed by 15:15, set `NESTS.enabled = false`, push, and log it in `REGRET.md`.
- [ ] **Step 7:** Add one bullet to `docs/superpowers/HANDOVER.md` "Where things stand" (shipped, or disabled and why), then commit and push.
