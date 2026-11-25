# Enemies Fight Back Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pests attack towers in five type-specific ways. Towers have HP, die for good (losing their upgrades), and can be repaired for Grapes. Upgrades raise max HP.

**Architecture:**
- New Phaser-free module `src/logic/siege.js` holds the rules: HP, repair cost, and per-pest attacker state machines. It is unit-tested.
- `GameScene` asks each pest's attacker what it did this frame, applies the hits through one `damageTower` path, plays the cosmetic effect, and sweeps destroyed towers after the loops.
- `HUDScene`'s upgrade panel gains an HP line and a Repair button, talking to the Game over Game events like the rest of the HUD.

**Tech Stack:** Phaser 4.2.1, Vite, Vitest (`npm test`), Playwright plugin for screenshots.

**Spec:** `docs/superpowers/specs/2026-11-25-enemies-fight-back-design.md`

## Before you start

- **Start only after the playtest-feedback session has pushed.** Run `git log origin/main -5` and check that `docs/superpowers/HANDOVER.md` items are done.
- Re-read `logic/towers.js`, `objects/Tower.js`, `GameScene.clickSpot`/placement, and `HUDScene.openUpgrade`. They changed today (free placement may have replaced `spotId` with `{x, y}`).
- This plan only relies on:
  - `towerInfo(placed, buffs)` returning `x`/`y`;
  - the placed object having `id`, `type`, `level`.
- **Time-box:** Tasks 1–5 are the demo cut (~75–90 min). Stop feature work at 15:15 whatever is left. Each task leaves a working, pushed game.
- Commit and push to `main` after each task: `git add <files>` then `git commit`, then `git push origin main`.

## Global Constraints

- Parody names only (Taureau Rouge Grand Cru, Le Monstre Blanc). Thomas is a generic sommelier, name only. Never the Nexios sword, a victory bell or Pizza Hut.
- No new assets. Reuse `shatter`, `splash`, `corkPop`, `wineRing`, `sparks` and the existing sound keys (`hit`, `cork`, `splash`, `shatter`, `place`, `nope`).
- Every new UI element tweens in (150–300 ms). Refused actions get a shake, a red flash and `nope`.
- `src/logic/` imports no Phaser.
- Use the Phaser **4** skills in `.claude/skills/` (`tweens`, `graphics-and-shapes`, `sprites-and-images` for tint, `cameras`). Don't write v3 APIs from memory.
- All reaches are ≥ 70 px. Buffs never change HP.
- If something that worked breaks, log it in `REGRET.md`.

## Review Focus

1. **A tower destroyed while its upgrade panel is open, or while hovered.** Expected: the panel closes, the range ring clears, and no click reaches the dead tower. Covered by Task 4 step 4 and the Task 5 check.
2. **A tower destroyed in the same frame as other hits, or by a can burst while the enemy list is being iterated.** Expected: no crash, no double sweep, no splice mid-loop. Covered by the Task 2 test `burst marks selfDestruct once` and the Task 3 sweep design.
3. **Play again or jumping waves (1–7) after towers were destroyed or damaged.** Expected: a clean state, with no leftover HP bars, lights or holding rats. Checked in Task 5.
4. **Repair spam:** clicking Repair at full HP or when broke. Expected: shake, `nope` and a toast, Grapes unchanged. Covered by the Task 1 tests `repair refuses full/grapes` and Task 4.
5. **A recruited rat that was mid-chew.** Expected: it stops holding and walks back. Covered by Task 3 step 3 (`Enemy.recruit` clears `holding`).

---

### Task 1: Tower HP and repair rules

**Files:**
- Modify: `src/config/towers.js`. Add `maxHp` to each base tower and each upgrade:
  - cork 60/90/130
  - sommelier 70/100/140
  - decanter 120/170/240
  - thomas 100/140/200
- Modify: `src/config/enemies.js`. Add `export const SIEGE = { damageMult: 1, repairShare: 0.5 };`
- Modify: `src/logic/towers.js`. `placeTower` sets `hp`; `upgradeTower` adds the HP gain.
- Create: `src/logic/siege.js` (HP part)
- Test: `tests/logic/siege.test.js`

**Interfaces:**
- Produces:
  - `placed.hp: number`
  - `towerStats(placed).maxHp: number`
  - `investedIn(placed) -> number`
  - `repairCost(placed) -> number`
  - `repairTower(state, placed) -> {ok: true, cost} | {ok: false, reason: 'full'|'grapes'}`
  - `damageTower(placed, amount) -> boolean` (true when this hit destroyed it; `hp` clamps at 0)
  - `removeTower(state, placed) -> void`
  - `SIEGE`

- [ ] **Step 1: Write the failing tests** in `tests/logic/siege.test.js`.
  - Use the placement call that matches the current `placeTower` signature (spotId or `{x, y}`).
  - Give the state plenty of Grapes: `s.grapes = 1000`.

```js
it('placed tower starts at full hp', () => { const t = place('cork'); expect(t.hp).toBe(60); expect(towerStats(t).maxHp).toBe(60); });
it('upgrade adds the max-hp gain and keeps damage', () => {
  const t = place('cork'); damageTower(t, 20);            // 40/60
  upgradeTower(s, t); expect(t.hp).toBe(70);              // +30 -> 70/90
});
it('damageTower clamps and reports destruction once', () => {
  const t = place('cork'); expect(damageTower(t, 59)).toBe(false);
  expect(damageTower(t, 50)).toBe(true); expect(t.hp).toBe(0);
});
it('repairCost scales with missing hp and grapes invested', () => {
  const t = place('cork'); upgradeTower(s, t);            // invested 100, max 90
  expect(investedIn(t)).toBe(100);
  t.hp = 45; expect(repairCost(t)).toBe(25);              // ceil(0.5 * 0.5 * 100)
  t.hp = 89; expect(repairCost(t)).toBe(1);               // min 1
});
it('repair refuses full/grapes and leaves grapes unchanged', () => {
  const t = place('cork');
  expect(repairTower(s, t)).toEqual({ ok: false, reason: 'full' });
  t.hp = 1; s.grapes = 0;
  expect(repairTower(s, t)).toEqual({ ok: false, reason: 'grapes' }); expect(s.grapes).toBe(0);
});
it('repair spends and heals to max', () => {
  const t = place('cork'); t.hp = 30; const g = s.grapes;
  expect(repairTower(s, t)).toEqual({ ok: true, cost: 13 }); // ceil(0.5*0.5*50)
  expect(t.hp).toBe(60); expect(s.grapes).toBe(g - 13);
});
it('removeTower frees a unique Thomas', () => {
  const t = place('thomas'); removeTower(s, t);
  expect(s.towers).not.toContain(t); expect(canPlace(s, 'thomas', /* another spot/point */).ok).toBe(true);
});
```

- [ ] **Step 2: Run the tests.** Run `npm test -- siege`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement the config fields, the two `towers.js` changes and `siege.js`.**
  - `upgradeTower` reads `towerStats(tower).maxHp` before and after `level += 1`, then adds the difference.
  - `repairCost` uses `SIEGE.repairShare`.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all PASS, and the existing `towers.test.js` still passes.
- [ ] **Step 5: Commit and push.**
  1. `git add src/config/towers.js src/config/enemies.js src/logic/towers.js src/logic/siege.js tests/logic/siege.test.js`
  2. `git commit -m "feat: tower hp and repair rules"`
  3. `git push origin main`

### Task 2: Pest attacker state machines

**Files:**
- Modify: `src/config/enemies.js`. Add `attack` to each pest:
  - fly: `{ style: 'dash', reach: 90, damage: 3, cooldownMs: 1800 }`
  - corkscrew: `{ style: 'ranged', reach: 130, damage: 6, cooldownMs: 2000 }`
  - rat: `{ style: 'chew', reach: 75, damage: 5, biteMs: 500, chewMs: 2000 }`
  - can: `{ style: 'burst', reach: 70, damage: 25 }`
  - monstre: `{ style: 'slam', reach: 160, damage: 30, cooldownMs: 4000 }`
- Modify: `src/logic/siege.js`
- Test: `tests/logic/siege.test.js`

**Interfaces:**
- Consumes: `SIEGE.damageMult`.
- Produces:
  - `createAttacker(attackCfg) -> attacker`. An opaque object holding `cfg`, `cooldownLeft = 0`, `chewLeft`, `biteLeft`, `chewTargetId`, `chewed: Set`, `spent`.
  - `tickAttacker(attacker, pos {x, y}, towers [{id, x, y, hp}], dtMs) -> { hits: [{id, damage}], holding: boolean, selfDestruct: boolean }`.
  - `towers` holds only living towers. The caller multiplies `dtMs` by the pest's `slowFactor`.

**Behaviour:**
- **Target:** the nearest tower with `hp > 0` within `reach`.
- **Damage:** `max(1, round(damage × SIEGE.damageMult))`.
- **`dash` / `ranged`:** when `cooldownLeft <= 0` and a target exists, hit it and set `cooldownLeft = cooldownMs`. The cooldown ticks every call.
- **`chew`:**
  - When not chewing, and the nearest tower in reach is not in `chewed`: start chewing. Bite immediately, `chewLeft = chewMs`, `biteLeft = biteMs`.
  - While chewing: `holding: true`, and bite each time `biteLeft` runs out.
  - When `chewLeft` runs out, or the target is gone or has `hp <= 0`: add the target to `chewed` and stop holding. So 2000/500 gives 4 bites (20 damage).
  - Order inside each call:
    1. Subtract `dtMs` from `chewLeft` and `biteLeft`.
    2. If `chewLeft <= 0` or the target is gone: end the chew, with no bite.
    3. Otherwise, if `biteLeft <= 0`: bite and add `biteMs` to `biteLeft`.
  - `dash`, `ranged` and `slam` likewise subtract `dtMs` from the cooldown before checking it.
- **`burst`:** the first time a target exists, hit it and return `selfDestruct: true`. Then `spent = true`, and it never fires again.
- **`slam`:** when the cooldown is ready and at least one tower is within reach, hit **every** tower in reach.

- [ ] **Step 1: Write the failing tests.** Use towers `T = (id, x, y = 0) => ({ id, x, y, hp: 100 })` and pest position `{x: 0, y: 0}`.

```js
it('dash hits nearest in reach, then waits its cooldown', () => {
  const a = createAttacker(ENEMIES.fly.attack);
  expect(tickAttacker(a, P, [T(1, 80), T(2, 40)], 16).hits).toEqual([{ id: 2, damage: 3 }]);
  expect(tickAttacker(a, P, [T(2, 40)], 1000).hits).toEqual([]);
  expect(tickAttacker(a, P, [T(2, 40)], 900).hits).toHaveLength(1);
});
it('nothing in reach -> no hit', () => { expect(tickAttacker(createAttacker(ENEMIES.fly.attack), P, [T(1, 91)], 16).hits).toEqual([]); });
it('chew holds and bites 4 times, then never re-chews that tower', () => {
  const a = createAttacker(ENEMIES.rat.attack); let bites = 0, r;
  for (let t = 0; t < 2500; t += 50) { r = tickAttacker(a, P, [T(1, 70)], 50); bites += r.hits.length; }
  expect(bites).toBe(4); expect(r.holding).toBe(false);
});
it('chew lets go when its target dies', () => {
  const a = createAttacker(ENEMIES.rat.attack);
  expect(tickAttacker(a, P, [T(1, 70)], 16).holding).toBe(true);
  expect(tickAttacker(a, P, [], 16).holding).toBe(false);
});
it('burst marks selfDestruct once', () => {
  const a = createAttacker(ENEMIES.can.attack);
  expect(tickAttacker(a, P, [T(1, 60)], 16)).toMatchObject({ hits: [{ id: 1, damage: 25 }], selfDestruct: true });
  expect(tickAttacker(a, P, [T(1, 60)], 16).hits).toEqual([]);
});
it('slam hits every tower in reach', () => {
  const r = tickAttacker(createAttacker(ENEMIES.monstre.attack), P, [T(1, 100), T(2, 150), T(3, 170)], 16);
  expect(r.hits.map((h) => h.id)).toEqual([1, 2]);
});
it('damageMult scales and floors at 1', () => { SIEGE.damageMult = 0.1; /* fly hit -> damage 1 */ SIEGE.damageMult = 1; });
it('every enemy has an attack with reach >= 70', () => { for (const e of Object.values(ENEMIES)) expect(e.attack.reach).toBeGreaterThanOrEqual(70); });
```

- [ ] **Step 2: Run the tests.** Run `npm test -- siege`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement `createAttacker` and `tickAttacker`** with one small branch per style.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit and push.** Commit `feat: pest attack styles (logic)`, then push.

### Task 3: Towers take hits in the Game

**Files:**
- Modify: `src/objects/Tower.js`
  - HP bar: a `Graphics` at depth `y + 21`, 36×4 px, 34 px above the base. Hidden at full HP. Colors: green `0x8fd16a` above 50%, amber `0xffb35c` above 25%, red `0xd01a3a` below that.
  - `hitFlash()`: an 80 ms red tint using the Phaser 4 tint API.
  - `drawHp()`.
  - `destroy()` also destroys the bar.
- Modify: `src/objects/Enemy.js`
  - `this.attacker = createAttacker(cfg.attack)`.
  - `holding` (no path progress while true).
  - `offX`/`offY` added to the sprite position in `update`.
  - `recruit()` sets `holding = false`.
- Modify: `src/scenes/GameScene.js`
  - `enemyAttacks(dtMs)`, `damageTower(tower, amount)`, `sweepTowers()`, `repair(placed)`.
  - The `repair-tower` listener, plus `off` in `cleanup`.
  - Demo key `D`.

**Interfaces:**
- Consumes: Task 1 and Task 2 functions.
- Produces Game events:
  - `tower-damaged` (placed)
  - `tower-destroyed` (placed)
  - `tower-repaired` (placed)
  - `repair-refused` (reason)
  - Game listens to `repair-tower` (placed).

- [ ] **Step 1: Tower visuals.**
  - Add `drawHp()` and `hitFlash()`.
  - `refresh()` (upgrade) calls `drawHp()`.
- [ ] **Step 2: GameScene attack loop.** Call `this.enemyAttacks(dt * 1000)` right after the enemy movement loop in `update`.
  1. Build `targets` once per frame from towers that are not `dead`: `{ id: t.placed.id, x: t.stats.x, y: t.stats.y, hp: t.placed.hp }`.
  2. For each pest in a copy of `this.enemies`:
     - Call `tickAttacker(e.attacker, e, targets, dtMs * e.slowFactor)`.
     - Set `e.holding = r.holding`.
     - For each hit: play that style's effect from the spec's "Damage feedback" section, then call `this.damageTower(tower, damage)`.
     - On `selfDestruct`: `removeEnemy(e, true)` with no reward, plus `splash` particles and sound.
  3. After the tower loop, call `this.sweepTowers()`.
- [ ] **Step 3: `damageTower(tower, amount)`.** Skip it if the tower is already `dead`.
  - Call logic `damageTower(tower.placed, amount)`.
  - Update the matching `targets` entry's `hp` (so later hits this frame see it).
  - Call `tower.drawHp()` and `tower.hitFlash()`, then emit `tower-damaged`.
  - If the logic call returns true: set `tower.dead = true`.
- [ ] **Step 4: `sweepTowers()`.** For each tower with `dead`:
  - `shatter()` at the tower, the `shatter` sound, `cameras.main.shake(150, 0.004)`;
  - `this.lighting.removeLight(tower.light)`;
  - `tower.destroy()`;
  - `removeTower(this.state, tower.placed)`;
  - remove it from `this.towers`, and clear `rangeRing`;
  - if the build-spot ring is still in use, show that spot's ring again;
  - emit `tower-destroyed`.
- [ ] **Step 5: `repair(placed)`.**
  - Call `repairTower`.
  - On refusal: `play('nope')`, then emit `repair-refused` with the reason.
  - On success:
    - `play('place')`, sparkle (`this.sparks.explode(12, x, y)` tinted gold/green), floatText `Repaired!`;
    - `tower.drawHp()`;
    - emit `grapes-changed` and `tower-repaired`.
- [ ] **Step 6: Demo key `D`.**
  - In `onDemoKey`, set every tower's `placed.hp = max(1, round(maxHp × 0.25))` and call `drawHp()`.
  - Float `The pests bite back!` and emit `tower-damaged` for each.
  - Extend the key comment.
- [ ] **Step 7: Run the tests and build.** Run `npm test && npm run build`. Expected: PASS, and the build succeeds.
- [ ] **Step 8: Quick check in the browser.**
  1. Run `npm run dev`, place a Cork Cannon right next to the path, and press `6`.
  2. Expected: the HP bar appears and drops; flies lunge; rats stop and wobble.
  3. Fix any console errors.
- [ ] **Step 9: Commit and push.** Commit `feat: pests attack towers`, then push.

### Task 4: HUD repair button and destruction feedback

**Files:**
- Modify: `src/scenes/HUDScene.js`

**Interfaces:**
- Consumes the Task 3 events.
- Emits `repair-tower` (placed) to the Game.

- [ ] **Step 1: Make the upgrade panel taller.**
  - Change `H` from 168 to **236**. Keep the existing positioning logic, which is based on `H`.
  - New y offsets:
    - title −88
    - level −64
    - HP text −42, with an HP bar 120×6 at −26
    - rule −12
    - next 8
    - Upgrade button 48
    - Repair button 98 (196×38, size 16)
  - New children ride the panel container's tween, so they tween in.
- [ ] **Step 2: `refreshUpgrade()`.**
  - HP text: `HP ${hp} / ${maxHp}`.
  - Redraw the HP bar, using the colors from Task 3.
  - Repair label:
    - full HP: `No scratches`;
    - otherwise: `Repair for ${repairCost(placed)}`.
  - Enable Repair only when HP is not full and `grapes >= cost`. A disabled button still emits on click so refusals get feedback. If `button()` swallows clicks when disabled, style it disabled without disabling it.
  - Listen to `tower-damaged` and `tower-repaired`: refresh if the id matches `upgradeFor`. `grapes-changed` already refreshes.
- [ ] **Step 3: `onRepairRefused(reason)`.** Mirror `onUpgradeRefused`:
  - shake the Repair button;
  - for `'grapes'`: shake and red-flash the Grapes panel;
  - toast from `TOAST`. Add `full: 'Not a scratch on it'`. `grapes` reuses the existing line.
- [ ] **Step 4: `onTowerDestroyed(placed)`.**
  - If `upgradeFor?.id === placed.id`: `closeUpgrade()`.
  - `showToast(\`${TOWERS[placed.type].name} was destroyed!\`)`.
- [ ] **Step 5: Run the tests and check in the browser.**
  1. Run `npm test`, then in the browser: place a tower, press `D`, click the tower.
  2. Expected:
     - The panel shows `HP 15 / 60` and `Repair for N`.
     - Clicking Repair heals the tower, spends Grapes and shows a float.
     - Clicking again shakes the button and toasts "Not a scratch on it".
     - With 0 Grapes (spend first): the Grapes panel shakes and flashes red.
- [ ] **Step 6: Commit and push.** Commit `feat: repair button and tower destruction feedback`, then push.

### Task 5: Visual verification and balance pass

**Files:**
- Modify, if needed: `src/config/enemies.js` (`SIEGE.damageMult` and attack numbers).
- Modify: `REGRET.md`, only if something broke.

- [ ] **Step 1: Playwright screenshots.** Use the dev server and `window.__game`.
  1. Wave 2 with flies lunging at a Cork Cannon.
  2. Wave 6 with a rat chewing and the HP bars visible.
  3. Press `B` near a Decanter to show the slam ring.
  4. The upgrade panel with the HP line and Repair.
  5. A tower being destroyed: press `D`, then let a wave hit it.
  - Expected: no console errors; the panel fits inside 1280×720 for towers near the top and bottom edges.
- [ ] **Step 2: Review Focus checks.**
  1. Destroy a tower while its panel is open: the panel closes.
  2. Press `1`–`7` after destruction: no stray bars or lights.
  3. Lose, then Play again: a clean run with full HP.
  4. Recruit a chewing rat: it walks back.
- [ ] **Step 3: Balance run.** Play waves 1–7 with an honest, mostly unrepaired build.
  - Target: the run is still winnable, and about 1 tower is lost by wave 6 if you never repair.
  - Too brutal: lower `SIEGE.damageMult` (e.g. 0.75).
  - Nothing ever dies: raise it to 1.25.
  - Note the final value in the commit message.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit and push.** Commit `chore: siege balance (damageMult X)`, push, then check the live site after the Pages deploy (~2 min).

### Task 6 (polish, only if before 15:15): Small extras

Pick in this order, and commit each one on its own:
1. README demo script: the `D` key and "pests fight back".
2. An HP line in the card tooltips: `statLine` appends `· ${maxHp} HP`.
3. Smoke puffs on towers below 30% HP (a slow `dust`-style emitter).
4. *Oak Reserve* tasting wine (full repair of every tower), handled in `onTastingPicked` as a special effect instead of a stat buff.
5. Per-style synth sounds in `sound.js` (no bells).
