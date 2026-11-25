# Difficulty Ramp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking. The user is away from the keyboard: work autonomously, make the calls this plan leaves open, and note them in the HANDOVER.

**Goal:** The game is too easy once you get going, and Endless is too easy. From wave 6 on, every wave gets much harder, and the Le Monstre Blanc fight gets more dangerous. The demo script must still be winnable.

**Architecture:**
- One difficulty curve lives in `src/logic/waves.js` `waveAt()`, which already returns `hpMult` per wave. It gains `speedMult` and steeper counts from wave 6 on.
- Schedule entries carry both multipliers into `Enemy`.
- The boss gets an enrage phase and summons cans. All its numbers are new config fields on `ENEMIES.monstre`, so tuning means editing config only.

**Tech Stack:** Phaser 4.2.1, Vite, Vitest.

**Spec:** The user's request (2026-11-25, ~14:40): "rank up the difficulty by a lot every level after 5. Also make the boss fight against the white monster more difficult." Pest nests, performance fixes and playtest feedback 2 are already on `main`.

## Decisions (made while writing this plan; the user is away)

| Topic | Decision |
|---|---|
| Waves 1–5 | Unchanged. |
| Wave n ≥ 6 (1-based, scripted and Endless) | With `r = n − 5`: **`hpMult = 1 + 0.35 · r`** (wave 6 ×1.35, wave 7 ×1.7, wave 10 ×2.75, wave 15 ×4.5), **counts × (1 + 0.25 · r)**, capped at **30 per group** (the existing perf cap), and **`speedMult = min(1 + 0.04 · r, 1.4)`**. |
| Endless | Same curve continued (it replaces today's `1 + 0.15k`). Le Monstre Blanc still returns every 3rd endless wave, also scaled. |
| Boss base | `hp 2200 → 3000`, `armour 6 → 8`, `splitInto.count 6 → 8`, `attack.damage 30 → 40`. |
| Boss enrage | Below **50% HP** it becomes furious: speed **×1.6**, red tint, banner "Le Monstre Blanc is furious!", camera shake, and the `slam` attack cooldown 4000 → **2500 ms**. One-way: it stays enraged. |
| Boss summons | While alive, every **7 s** (scene time) it spits **2 cans** onto the path just behind it, with a "Sugar rush!" floatText (first summon 5 s after it spawns). |
| Rewards | Unchanged (harder waves already pay more through more pests). |
| Demo safety | The README demo script (`G G G`, a few upgraded towers including Thomas, a wine, `7`, Taureau Rouge as the boss enters) must still win. If it doesn't, soften in this order: boss summons interval 7 → 10 s, enrage speed 1.6 → 1.35, then `hpMult` slope 0.35 → 0.25. |

## Global Constraints

- Work in `C:\Users\Thoma\dev\WTD` on `main`. Commit and push straight to `main` after each task (CLAUDE.md; pushing is pre-approved). Start with `git pull` and `npm test`.
- Hard stop **15:30**. Demo prep is 15:45, the demo 16:00. If the balance check (Task 3) isn't passing by 15:30, revert to the last commit where the demo script wins, push, and log it in `REGRET.md`.
- `src/logic/` stays Phaser-free. `npm test` must pass after every task.
- Phaser 4 APIs only (`.claude/skills/`: `tweens`, `time-and-timers`, `cameras`). Don't write Phaser 3 from memory.
- Parody names only. Thomas is a generic sommelier, name only. Never reintroduce the Nexios sword, the victory bell or Pizza Hut.
- Keep the presenter keys working: `1`–`7`, `B`, `G`, `W`, `R`, `D`, `M`, `L`, `P`, `F`, and `T` on the title.
- Don't undo the performance work: the per-group cap of 30, pest halos only for the first 12 pests on the field, and lighting every 2nd frame (`src/fx/lighting.js`, `src/objects/Enemy.js`). Summoned cans count toward the 12.
- Spawned extras (nest pests, boss cans, split cans) use the current wave's `hpMult` (and `speedMult`).

## Review Focus

1. **The demo script still wins** with Taureau Rouge fired at the boss: Task 3.
2. **Restart / Play again mid-boss:** no summon timer survives into the next run. The timer lives on the boss, or in scene time that resets in `create()`. Task 2 Step 4.
3. **The boss dies while enraged, or while a summon is due:** the split still happens once, and no summon fires after death. Task 2 Step 4.
4. **Endless at wave 15+ at 2× speed:** still ≥ 30 per group max, smooth, no console errors. Task 3.
5. **`B` (boss on an empty field) and `7` (jump)** both get the new boss behaviour without errors. Task 2 Step 4.

---

### Task 1: Difficulty curve (logic)

**Files:**
- Modify: `src/logic/waves.js` (`waveAt`, `buildSchedule`)
- Modify: `src/objects/Enemy.js` (constructor takes `speedMult`)
- Modify: `src/scenes/GameScene.js` (`spawnScheduled` / `spawnEnemy` pass `speedMult`; store `this.waveSpeedMult` next to `this.waveHpMult`)
- Modify: `src/logic/nests.js` (`nestSchedule` takes and passes `speedMult`)
- Test: `tests/logic/waves.test.js`, `tests/logic/nests.test.js`

**Interfaces:**
- Produces:
  - `waveAt(index) -> { groups, hpMult, speedMult }`
  - schedule entries `{ atMs, type, hpMult, speedMult, distance?, nestId? }`
  - `spawnEnemy(type, distance = 0, hpMult = 1, speedMult = 1)`
  - `new Enemy(scene, type, distance, hpMult, speedMult)` (`this.speed = cfg.speed * speedMult`)
  - `nestSchedule(nests, entryDistance, hpMult = 1, speedMult = 1)`

- [ ] **Step 1: Update and add the failing tests.**
  - `waveAt(0..4)`: `hpMult` 1 and `speedMult` 1, groups identical to `WAVES[i]`.
  - `waveAt(5)` (wave 6): `hpMult` 1.35, `speedMult` 1.04, every group count `Math.min(30, Math.round(WAVES[5] count × 1.25))`.
  - `waveAt(6)` (wave 7): `hpMult` 1.7, the monstre group still present with count 1 (never scale the boss count).
  - `waveAt(9)` (wave 10, Endless k=3): `hpMult` 2.75, contains monstre.
  - `waveAt(40)`: `speedMult` 1.4 (capped), every group ≤ 30.
  - `buildSchedule(waveAt(6))` entries carry `hpMult` 1.7 and `speedMult` 1.08.
  - `nestSchedule(..., 1.7, 1.08)` entries carry both.
  - Replace the old Endless expectations (`hpMult` 1.15 at index 7) with the new curve: index 7 = wave 8 → `hpMult` 2.05.
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - Scripted waves (index < 7) keep their own groups. From index 5 on, apply the curve to the non-boss groups.
  - Endless (index ≥ 7) keeps building from wave 7's non-boss groups as now, with the boss every 3rd endless wave.
  - Use `r = index + 1 − 5` for both.
- [ ] **Step 4: Run** `npm test`. Expected: PASS. Quick in-game check: `6` spawns visibly more and tougher pests, with no console errors.
- [ ] **Step 5: Commit and push:** `git commit -am "feat: steep difficulty ramp from wave 6"`, then `git push`.

### Task 2: A harder Le Monstre Blanc

**Files:**
- Modify: `src/config/enemies.js` (`monstre`: new numbers plus `enrage: { at: 0.5, speedMult: 1.6, slamCooldownMs: 2500 }` and `summon: { type: 'can', count: 2, everyMs: 7000, firstMs: 5000 }`)
- Modify: `src/objects/Enemy.js` (enrage state)
- Modify: `src/scenes/GameScene.js` (summons in `update`; enrage effects in `damageEnemy` or the enemy's hit path; banner event)
- Modify: `src/scenes/HUDScene.js` (banner on `'boss-enraged'`)
- Test: `tests/logic/` only if a pure helper is added (for example `shouldEnrage(hp, maxHp, at)`). Keep it tiny.

**Interfaces:**
- Produces:
  - `Enemy#enraged: boolean`
  - `Enemy#summonIn: number` (ms; boss only)
  - Event `'boss-enraged'` (Game → HUD) → `banner('Le Monstre Blanc is furious!', 'Sugar rush incoming')`.

- [ ] **Step 1: Change the config.** Set the boss's `hp` 3000, `armour` 8, `splitInto.count` 8, `attack.damage` 40, and add the `enrage` and `summon` blocks above. Run `npm test`, and update any test that asserts the old boss numbers.
- [ ] **Step 2: Enrage.**
  - When a boss's HP first drops to ≤ `enrage.at × maxHp` and it's still alive: `enraged = true`, `speed *= enrage.speedMult`, `attacker.cfg` slam cooldown → `enrage.slamCooldownMs` (copy the cfg; don't mutate the shared config object).
  - Effects: a red tint that `Enemy.update` keeps (it currently tints for slow; the enraged tint wins over the slow tint), `cameras.main.shake(300, 0.01)`, `play('shatter')` or another heavy sound, floatText "Furious!", and emit `'boss-enraged'`.
- [ ] **Step 3: Summons.**
  - In `GameScene.update`, for each living boss: `summonIn -= dt*1000`, starting from `summon.firstMs` when spawned.
  - At ≤ 0: spawn `summon.count` cans with `spawnEnemy('can', max(0, boss.distance − 30 − 20·i), this.waveHpMult, this.waveSpeedMult)`, using the same pop-in tween as `splitBoss` (scale 0.2 → 1). Add a small spark burst, floatText "Sugar rush!", then reset to `everyMs`.
  - Summoned cans must be in `this.enemies` before the wave-clear check runs, the same as split cans.
- [ ] **Step 4: Verify (Review Focus 2, 3, 5).**
  - `B` on an empty field: summons every 7 s; at half HP the banner, shake and speed-up happen; it splits into 8 cans.
  - `7`: the same in the real wave.
  - Pause → Restart mid-boss: the new run has no summons or enrage carry-over.
  - Kill the boss in one hit from full HP (`__game.scene.getScene('Game').damageEnemy(boss, 99999)`): one split, no enrage error.
  - No console errors.
- [ ] **Step 5: Commit and push:** `git commit -am "feat: Le Monstre Blanc enrages and summons cans"`, then `git push`.

### Task 3: Balance check, then ship

- [ ] **Step 1: The demo script must win.** On the dev server (visible tab or scripted `__game.step` loop):
  1. Play.
  2. `G G G`.
  3. Place Cork ×2, Sommelier, Decanter, Thomas near the path; upgrade Thomas and one Cork once.
  4. `1`, then pick a wine.
  5. `7`, and fire Taureau Rouge as the boss enters.

  The cellar must hold (lives > 0) and reach "The cellar holds!". Record lives left. Target: wins with 5–15 lives lost, so it's tense but safe.
  - If it loses, soften in the order from the Decisions table, then re-run.
  - If it wins with no lives lost, it's too easy for the boss: tighten the summon interval 7 → 5 s.
- [ ] **Step 2: Waves 6+ are much harder.** With the same build *without* `G`, an honest run should struggle by wave 6–7. Endless wave 10 needs a heavily upgraded defence. Spot-check that `6` with a small build (3 unupgraded towers) leaks lives.
- [ ] **Step 3: Endless at 2×** (`7`, Keep pouring, `F`, `G`×6, a big build) up to wave 12: smooth, ≤ 30 per group, no console errors.
- [ ] **Step 4:** `npm test` passes. Push, watch the deploy (`gh run list --limit 1`), then run the README demo script once on https://thomasokvs.github.io/WTD/.
- [ ] **Step 5:** Add bullets to `docs/superpowers/HANDOVER.md` "Where things stand" covering the final numbers used, the lives left in the demo script run, and anything softened. Add a README line about the furious boss, and update the demo script line if the boss moment changed (for example "watch it turn furious at half health"). Commit and push.
