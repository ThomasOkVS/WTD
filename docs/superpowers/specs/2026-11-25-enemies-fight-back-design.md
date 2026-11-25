# Enemies Fight Back: Design

*2026-11-25. Builds on the playtest-feedback work in `docs/superpowers/HANDOVER.md`. That work must be pushed before this is built.*

## Goal

Pests attack towers as they walk past.

1. Every pest type attacks in its own way.
2. Towers have HP. A destroyed tower is gone, upgrades included.
3. Repairing costs Grapes. Upgrades raise a tower's max HP.

The game must stay winnable and fun for the 16:00 demo. The target feel is **dramatic but fair**:
- Towers near the path get chipped every wave.
- If you never repair, you lose a tower now and then.
- Le Monstre Blanc can flatten a careless defence.

## Decisions (settled with the user)

| Topic | Decision |
|---|---|
| Attack styles | Mixed set: each pest has its own style (table below). |
| Repair | One-click **full** repair from the upgrade panel. Cost scales with missing HP and the Grapes invested in the tower. |
| Destruction | No refund and no free heal between waves. Repair is the only way to heal. |
| Balance | One global `SIEGE.damageMult` knob, plus per-pest attack config. |

## Independence from free placement

Free placement (HANDOVER item 1) may or may not ship. This feature only needs each tower's `x`/`y`, and gets them from `towerInfo(placed, buffs)` (`Tower.stats.x/y`). It works with both fixed build spots and free placement.

Code references below use function names, not line numbers, because those files are being edited right now.

## Pest attack styles

All reaches are **≥ 70 px**, because towers sit at least 40–50 px from the path:
- fixed spots: at least 50 px from the path;
- free placement: refused within 40 px of the path.

A shorter melee reach would almost never connect.

| Pest | Style | Behaviour | Reach | Damage | Timing |
|---|---|---|---|---|---|
| fly | `dash` (hit and run) | Darts out to the nearest tower, stings and snaps back. It never stops walking. | 90 | 3 | every 1.8 s |
| corkscrew | `ranged` | Flings a cork shard at the nearest tower while walking. | 130 | 6 | every 2.0 s |
| rat | `chew` | Stops at the nearest tower it hasn't chewed yet and gnaws it, then walks on. Each tower is chewed at most once per rat. Standing still makes the rat an easy target. | 75 | 5 per bite | a bite every 0.5 s, for 2.0 s (20 total) |
| can | `burst` (kamikaze) | Fizzes and bursts on the nearest tower. The can dies in the blast and gives **no reward**. | 70 | 25 | once |
| Le Monstre Blanc | `slam` | Ground slam: every tower within reach is hit, with a cream shockwave ring and a camera shake. | 160 | 30 | every 4.0 s |

Rules for every style:
- **Target:** the nearest living tower within `reach` of the pest's path position.
- **Cooldown:** starts at 0, so a pest attacks as soon as a tower comes into reach. It ticks with `dtMs × slowFactor`, so the **Sommelier's slow also slows attacks**. This gives the Sommelier a defensive role.
- **Damage:** dealt the moment the attack happens. The visual is cosmetic and never delays it. Final damage = `round(damage × SIEGE.damageMult)`, minimum 1.
- **Who attacks:** only pests in `scene.enemies` attack. A recruited pest is spliced out of that list, so Thomas's recruits never attack. This is intentional. A chewing rat that gets recruited stops holding.
- **Chewing:** a chewing rat holds its position (no path progress) but can still be hit, slowed and killed. If its target dies mid-chew, the chew ends and the rat walks on.

## Tower HP

`maxHp` is a config field on the base tower and on each upgrade, so `towerStats()` merges it for free.

| Tower | Lv 1 | Lv 2 | Lv 3 | Why |
|---|---|---|---|---|
| Cork Cannon | 60 | 90 | 130 | cheap, can stand back (range 150) |
| Sommelier | 70 | 100 | 140 | support |
| Decanter | 120 | 170 | 240 | must hug the path (range 100), so it takes most hits |
| Thomas | 100 | 140 | 200 | unique and expensive |

- The placed state object gets `hp`. `placeTower` sets `hp = maxHp`.
- `upgradeTower` adds the gain: `hp += newMax − oldMax`. Damage taken so far is kept.
- **Buffs never touch HP.** `applyBuffs` only multiplies stats a buff names, and no buff names `maxHp`. Taureau Rouge only touches fire rate. A damaged tower fires at full strength.

## Repair

- `invested(placed)` = base cost + the costs of the upgrades bought.
- `repairCost(placed)` = `max(1, ceil((maxHp − hp) / maxHp × SIEGE.repairShare × invested))`, with `repairShare = 0.5`. Repairing a nearly dead tower costs about half of what was paid for it.
- `repairTower(state, placed)` returns `{ ok: true, cost }` or `{ ok: false, reason }`:
  - `reason: 'full'` when `hp === maxHp`.
  - `reason: 'grapes'` when you can't afford it.
  - On success it spends the cost and sets `hp = maxHp`.

**UX:** the upgrade panel grows from 168 to **236 px** tall and adds:
- an **HP line** with a small bar: `HP 45 / 90`;
- a second button below Upgrade: **`Repair for N`**.
  - It is greyed out (disabled style) when HP is full or you can't afford it.
  - Clicking still emits the event, so refusals get feedback.
  - When full it reads **`No scratches`**.

The panel refreshes on:
- `tower-damaged` for its tower (HP changes live during a wave);
- `grapes-changed`.

Refusals follow the project rules:
- every refusal shakes the Repair button and plays `nope`;
- `full`: toast *"Not a scratch on it"*;
- `grapes`: the Grapes panel shakes and flashes red, plus the existing not-enough-Grapes toast.

**Success:**
- `place` sound;
- green-gold sparkle on the tower;
- the HP bar refills (tweened);
- floating `Repaired!`.

## Destruction

- **Bookkeeping:**
  - `GameScene.damageTower(tower, amount)` marks `tower.dead = true` when HP reaches 0.
  - Dead towers are swept **after** the enemy, tower and projectile loops (never spliced mid-loop).
- **The sweep:**
  - plays `shatter()` particles at the tower, the `shatter` sound and a small camera shake;
  - destroys the sprite and HP bar;
  - removes `tower.light` and removes the tower from `state.towers` (`removeTower`);
  - clears the hover range ring;
  - emits `tower-destroyed` (placed).
- **HUD on `tower-destroyed`:**
  - closes the upgrade panel if `upgradeFor.id` matches;
  - toasts *"<Tower name> was destroyed!"*.
- **Other rules:**
  - No refund.
  - A destroyed Thomas can be rebuilt: the uniqueness check reads `state.towers`.
  - A spot freed up (fixed spots) or a cleared area (free placement) can be built on again.
  - Recruits already walking keep walking.

## Damage feedback

- **Towers:**
  - A small HP bar above the sprite, hidden at full HP, colored like the enemy bars (green > 50% > amber > 25% > red).
  - An 80 ms red tint flash on every hit. Use the Phaser **4** tint API: check the `sprites-and-images` / `v4-new-features` skills.
- **Fly dash:** the sprite lunges 60% of the way to the tower and back in 220 ms (yoyo). Done by tweening `offX`/`offY` on the Enemy and adding them in `update`, because `update` re-sets the position every frame.
- **Corkscrew:** a `proj-cork` image tweens from the pest to the tower in 180 ms, plus the `cork` sound at low pitch.
- **Rat:** a sprite angle wobble on each bite, a `corkPop` crumb puff at the tower, and the `hit` sound.
- **Can:** `splash` particles and sound at the tower, and the can is removed (animated).
- **Le Monstre Blanc:** a cream (`0xe9dcc0`) expanding ring of radius `reach`, like the Decanter burst ring, plus `cameras.main.shake(200, 0.006)` and the `hit` sound at pitch 0.6.

No new assets: everything reuses the existing particles and Kenney CC0 samples.

## Demo key

`D` (free; keys in use are 1–7, B, G, W, R, M and T on the title) sets every tower to 25% HP (minimum 1) and shows a float *"The pests bite back!"*. This puts repair and destruction on cue for the demo.

## Balance sanity (`damageMult = 1`)

- Wave 5: 16 flies each get at most one sting on a tower right next to the path, so ≤ 48 damage if none die first.
- Wave 6:
  - 8 rats chewing the first tower they pass deal up to 160.
  - 14 corkscrews deal about 84.
  - So an unrepaired Lv 1 Cork Cannon on the path's edge can fall, which is dramatic. A Decanter (120+) usually survives because it kills the rats while they chew, which is fair.
- Le Monstre Blanc slams 1–2 times per tower it passes (30–60 each) and more if it is slowed, then the cans burst for 25 each.

**Tuning order:**
1. `SIEGE.damageMult` (0.6 means gentle, 1.5 means brutal).
2. Per-pest `damage`.
3. Tower `maxHp`.

## Out of scope (polish tier, only if time remains)

- Per-style attack sounds (synth in `sound.js`).
- Smoke puffs on towers below 30% HP.
- *Oak Reserve* tasting wine: a full repair of every tower.
- A HUD "Repair all" button.
- An HP line in the card tooltips (`statLine`).
- README demo script: mention the `D` key.

## Project rules that apply

- Parody names only. Thomas is a generic sommelier, name only.
- No bell sounds.
- Every new UI element tweens in.
- Refused actions get a shake, a red flash and `nope`.
- Game rules live in `src/logic/` (Phaser-free, Vitest).
- Visuals are verified with Playwright screenshots.
- Log anything that worked and then broke in `REGRET.md`.
