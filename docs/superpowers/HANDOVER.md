# Handover: process playtest feedback (WTD: Wine Cellar Siege)

*Written 2026-11-25, ~11:50. Demo at 16:00, demo prep at 15:45.*

## Where things stand

- **The game is finished and live:** https://thomasokvs.github.io/WTD/ (repo `ThomasOkVS/WTD`, public).
  - Every push to `main` deploys automatically through `.github/workflows/deploy.yml`: tests, build, then Pages, in about 1–2 minutes.
  - All 11 tasks of `docs/superpowers/plans/2026-11-25-wine-cellar-siege.md` are done, reviewed (per task and whole branch), and pushed.
- **Audio:** sound effects are Kenney CC0 samples in `public/audio/` (credits in `public/audio/CREDITS.md`).
  - Music, the heartbeat, power, win and Sommelier "pour" sounds are synthesised in `src/fx/sound.js`.
  - Title music starts on the first click or key press (browser autoplay rule).
- **Tests:** `npm test` passes 37/37. `REGRET.md` has 5 entries.
- **Feedback processed (2026-11-25, ~12:15), all six items pushed to `main`:**
  - Cards sorted by price; hover tooltips on every card (role + live stats) and on Taureau Rouge (effect + ready/active/recharging state); one-time toast on the first wave of a run.
  - Decanter bursts wine around itself: every pest within 85/95/105 px takes 35/50/70. Grand Decant buffs its range.
  - Thomas (option a): Recruit every 6/4.5/3 s, the recruit smashes every pest it walks through (once each), morale aura +15%/+25% fire rate within 120 px (gold ring).
  - Free placement: ghost + range ring follows the pointer on an 8 px grid; refused on the path, under the HUD, too close to a tower, or on candles/barrels. Right-click or Esc cancels. `BUILD_SPOTS` is gone.
  - `npm test` passes 43/43.
- **Next:** bug-bash and run the README demo script on the live site before 15:45.

## The feedback (user's words)

```
- Free placement around the map instead of fixed spots
- summary on what each character does.
- explaination on what taureau rouge does
- characters ordered by price
- balance of the game: why is Thomas so expensive? what does he do that is so good?
- make the decanter like the tack shooter from BTD where it splashes wine around itself in a small radius dealing high damage.
```

## Read first

1. `CLAUDE.md`: project rules (short). Git goes straight to `main`, with no branches, worktrees or PRs.
2. This file.
3. Only the code each item touches (listed below). The spec and plan are background, not required reading.

## How to run the session

- **Time-box.**
  - It's a hackathon and the demo is at 16:00. Stop feature work by about 15:15, then bug-bash and run the README demo script on the live site.
  - If time runs short, cut item 1 (free placement), not the quick wins.
- **Ask the user first** about the open questions marked **Q:** below, in one AskUserQuestion with up to 4 questions. Then work without stopping.
- **Suggested order:** least risk first. Every step leaves a working, pushed game.
  1. Items 4, 2 and 3: card order, tower summaries, Taureau Rouge explanation (UI only, about 30–45 min).
  2. Item 6: Decanter as an area burst around itself.
  3. Item 5: Thomas balance (decide with the user, then tune).
  4. Item 1: free placement (the largest change; touches logic, tests, Game, HUD and lighting).
- **Workflow:**
  - Use superpowers:subagent-driven-development or work inline, whichever fits. A short plan in `docs/superpowers/plans/` is enough.
  - Commit and push to `main` after each item. Pushing is pre-approved; the repo already exists.
  - Hand subagents the Phaser 4 skill names (`.claude/skills/`, e.g. `input-keyboard-mouse-touch`, `tweens`, `text-and-bitmaptext`, `graphics-and-shapes`) so they use the Phaser **4** API, not v3 from memory.
- **Verify visually** with the Playwright plugin: screenshots plus console errors.
  - If port 5173 is already taken, a dev server for this repo is probably running there.
  - `window.__game` is exposed in dev.
  - Game rules in `src/logic/` stay Phaser-free and are unit-tested.
- **Keep these working:**
  - Review Focus 1–5 from the plan: refused placement gets shake + red flash + "nope" and leaves Grapes unchanged; Play again gives a clean run; no audio before the first click; letterboxing; paused states.
  - The demo keys: `1`–`7`, `B`, `G`, `W`, `R`, `M`. `T` on the title shows the texture grid.
- If something that worked breaks, log it in `REGRET.md` (`## HH:MM — what broke — why — fix`).
- **Hard rules:**
  - Parody names only: Taureau Rouge Grand Cru, Le Monstre Blanc.
  - Thomas: generic sommelier, name only.
  - Never reintroduce the Nexios sword, the victory bell or Pizza Hut.
  - The BTD reference in item 6 is a **mechanic** reference only: no Bloons names, art or terms in the game.

## Current numbers (src/config/towers.js, enemies.js)

| Tower | Cost | Range | Damage | Rate /s | Special | Upgrades (cost) |
|---|---|---|---|---|---|---|
| Sommelier | 70 | 130 | none | 1.0 | slows the target 50% for 1.2 s | Master Sommelier (60), Grand Sommelier (110) |
| Cork Cannon | 50 | 150 | 12 | 3.0 | single target, ~36 dps | Double Cork (50), Champagne Barrage (100) |
| Decanter | 90 | 120 | 18 | 0.8 | lobbed shot, 60 px splash at the target | Crystal (80), Vintage (140) |
| Thomas | 120 | 140 | 8 | 1.5 | Recruit every 12 s; unique (one per map) | Senior Recruiter (150): 8 s; Head of Talent (250): 5 s |

Enemies (hp / speed / armour / reward):

| Enemy | HP | Speed | Armour | Reward |
|---|---|---|---|---|
| fly | 20 | 200 | 0 | 3 |
| corkscrew | 60 | 130 | 4 | 6 |
| rat | 140 | 95 | 0 | 10 |
| Le Monstre Blanc | 2200 | 45 | 6 | 200 (leak costs 10 lives; splits into 6 cans) |
| can | 80 | 110 | 2 | 4 |

The player starts with 150 Grapes and 20 lives.

## The items

### 4. Order the tower cards by price
- **Now:** `src/scenes/HUDScene.js` `createBar()` (around line 232) iterates `Object.entries(TOWERS)` in config order: Sommelier 70, Cork 50, Decanter 90, Thomas 120.
- **Do:** sort by `cost` at build time, so the order stays right after item 5 changes prices. Keep each card's `type` key so events are unchanged.

### 2. Summary of what each tower does
- **Do:** add a short role line per tower in `src/config/towers.js` (e.g. `blurb`), and show it on card hover as a parchment tooltip above the card. Use the existing `panel()`/`body()`/`enter()` helpers in `src/ui/kit.js`, with a 150–300 ms tween-in.
- Include 2–3 key stats (damage/rate/range, or slow %, or Recruit cooldown).
- Optionally add the same lines to the upgrade panel and `README.md`.
- **Example lines:**
  - Cork Cannon: "Rapid corks at one pest."
  - Sommelier: "Sniffs out pests and slows them."
  - Decanter: (item 6's new behaviour)
  - Thomas: "Recruits a pest to fight for you."
- Keep tooltips inside 1280×720 (cards sit at the bottom edge).

### 3. Explain what Taureau Rouge does
- **Mechanics:**
  - Click the can button (HUD, bottom right) to get **10 s of 2× fire rate for all towers**, then a **45 s cooldown**.
  - It starts charged, and can only be fired while a wave is running. Between waves it is refused with "Save it for the pests!", and the cooldown freezes.
  - Code: `GameScene.activatePower`/`updatePower`, `HUDScene` power button.
- **Do:** a hover tooltip on the button with name, effect and current state (ready / active Xs / recharging Xs). Optionally a one-time toast at the first wave: "Taureau Rouge is charged — click it for double fire rate!"

### 6. Decanter: area burst around itself
- **Now:** fires a lobbed `proj-wine` projectile at a target; it splashes 60 px at the impact point (`src/objects/Projectile.js` around line 40; `Tower.fire` in `src/objects/Tower.js`).
- **Wanted:** like the "tack shooter" mechanic. When any pest is within a small radius, the Decanter bursts wine all around **itself**, dealing **high damage** to every pest in that radius.
- **Do:**
  - In `Tower.fire`, for `type === 'decanter'`, damage every alive pest within `range` of the tower through `scene.damageEnemy` (the one damage path, so rewards and Recruit still work), with no projectile.
  - Visual: a radial ring of `drop`/`proj-wine` particles flying outward (`src/fx/particles.js` `splash`), plus an expanding burgundy ring and the `splash` sound.
  - Retune in `towers.js`: e.g. range ~75–85, damage ~35, rate ~0.9, with upgrades raising damage and radius. `splash` is no longer needed.
  - It must sit close to the path to be useful, so check it against the build spots, or against free placement once item 1 lands.
- Keep the buffs working: `applyBuffs` multiplies `damage`/`range`/`rate`. The tasting wine `grand-decant` in `src/config/tastings.js` buffs `splash` for the decanter; change it to buff the decanter's `range` (or `damage`) and update its line.
- No logic test asserts decanter numbers today (only `towers.test.js` refusal cases), so tuning is free.

### 5. Balance: why is Thomas so expensive?
- **What he does now:**
  - A weak 8-damage shot at 1.5/s (~12 dps).
  - Every 12 s (8 s / 5 s upgraded), **Recruit**: the strongest non-boss pest in range turns gold, walks backward along the path, and deals its **remaining HP** as damage to the first pest it touches, then vanishes.
  - Code: `Tower.js` around lines 24–60 and `GameScene` recruits.
  - Against a rat (140 hp) that's roughly 12 dps of extra value. At 120 Grapes he is **worse than a 50-Grape Cork Cannon** (~36 dps), so the user's question is fair.
- **Q (ask the user): which direction?**
  - **(a) Make him worth it.** Recruit every 6 s; the recruited pest hits *every* pest it walks through (not just the first) and turns gold with a light. Add an aura: towers within 120 px get +15% fire rate ("team morale"). Keep cost ~120.
  - **(b) Make him cheaper.** Cost ~75 with the current kit.
  - **(c) Both, lightly.** Cost 100, Recruit 8 s base, the recruit hits all pests it touches.
- Whatever is chosen, show it in his tooltip (item 2) so his value is obvious.
- Thomas stays a generic sommelier, name only.

### 1. Free placement instead of fixed spots
- **Now:** 12 fixed `BUILD_SPOTS` in `src/config/map.js`.
  - Used by `src/logic/towers.js`: `canPlace(state, type, spotId)`, with placed towers stored as `{id, type, spotId, level}`.
  - Used by `Tower.js` `towerInfo` (looks up the spot for x/y), `GameScene` (one interactive zone + ring per spot, `clickSpot`, `towerAt(spotId)`, hover range ring), and `HUDScene` upgrade panel (looks up the spot to position the panel).
  - Tests: `tests/logic/towers.test.js` (spotId) and `tests/logic/path.test.js` (spots ≥ 50 px from the path, ≥ 60 px apart).
- **Do (suggested design):**
  - **Logic** (Phaser-free, TDD): placed tower `{id, type, x, y, level}`. `canPlace(state, type, {x, y})` returns `{ok, reason}`; refusals are evaluated in this order:
    1. `'bounds'`: outside the playfield. Keep x 30–1250; keep y off the HUD (top bar y < 80, bottom bar y > 590).
    2. `'path'`: within ~40 px of any path segment. Add a `distanceToPath(point)` helper in `src/logic/path.js`; reuse the point–segment math already in `path.test.js`.
    3. `'occupied'`: within ~48 px of another tower.
    4. `'unique'`: a second Thomas.
    5. `'grapes'`: not enough Grapes.

    `placeTower(state, type, {x, y})`.
  - **Game:**
    - Remove the spot zones and rings.
    - With a tower card selected, show a **ghost** of the tower plus its range ring that follows the pointer. It is tinted green/amber when valid and red when invalid (show the reason on refusal).
    - Click places it. Right-click or Esc cancels the selection.
    - Clicking an existing tower (no card selected) still opens the upgrade panel. Hit-test towers by distance instead of `towerAt(spotId)`.
    - Optionally snap to an 8 px grid.
  - **Keep:**
    - Refusal feedback (Review Focus 1; the "on the path" refusal now really happens).
    - Each tower's light (`lighting.addLight` at the tower's x/y).
    - Decor: don't block placement on candles/barrels, or treat them as 'occupied'. **Q:** ask the user.
    - The HUD upgrade panel positioned from `tower.x/y`.
    - Play again clean.
    - Demo keys.
  - **Update** `path.test.js` and `towers.test.js` for the new API. `BUILD_SPOTS` can be deleted once nothing imports it.
  - **README:** update the demo script if it mentions spots.
- **Risk:** this is the biggest change and touches 5 files plus tests. Do it last, and push only when the full flow works (place, refuse on path, upgrade, Play again).

## Open questions to ask the user up front

1. Thomas balance direction: (a) make him worth it / (b) make him cheaper / (c) both lightly. See item 5.
2. Free placement: may towers go on top of candles/barrels, or should those block placement? Snap to a grid, or place freely?
3. Tower and Taureau Rouge explanations: hover tooltips only (recommended), or also a one-time intro toast?
