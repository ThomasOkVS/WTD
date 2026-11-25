# WTD: Wine Cellar Siege Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A polished, candle-lit top-down tower defense game in Phaser 4 that runs in a desktop browser for a 16:00 hackathon demo.

**Architecture:** Game rules live in small pure-JS modules under `src/logic/` (unit-tested with Vitest, no Phaser import). Phaser scenes under `src/scenes/` own rendering, input and audio and call into the logic modules. All tunable numbers live in `src/config/`. Custom art is drawn procedurally into textures at boot (`src/art/`), so the game runs with zero external assets; CC0 assets are an optional upgrade.

**Tech Stack:** Phaser `4.2.1` (pinned exactly), Vite, Vitest, plain JavaScript (ES modules), Playwright MCP for screenshots, Google Fonts (Cinzel + Cormorant Garamond).

**Spec:** `docs/superpowers/specs/2026-11-25-wine-cellar-siege-design.md`

## Global Constraints

- Browser only; desktop, mouse + keyboard. Logical resolution **1280×720**, `Phaser.Scale.FIT` + `CENTER_BOTH`.
- Currency is **Grapes**. Lose when the Grand Cru's lives reach 0.
- Vite `base: '/WTD/'` (repo `WTD`, user's personal GitHub, public).
- Parody names only: **Taureau Rouge Grand Cru**, **Le Monstre Blanc**. No real Red Bull / Monster logos or names in code, art or copy.
- Thomas = generic sommelier, name only, no likeness.
- Removed, never reintroduce: Nexios sword, victory bell (incl. bell sound), Pizza Hut.
- Assets CC0 only, or credited in `README.md`. **Downloading any asset pack needs the user's explicit OK first.**
- Palette (`src/config/palette.js`): amber `#ffb35c`, candle-gold `#e8c07a`, burgundy `#8a1c2b`, wine-red `#d01a3a`, stone `#3a2a22`, path `#5a3d2b`, shadow `#120a0d`, parchment `#e9dcc0`, ink `#3a1a12`.
- Every UI element enters with a tween (fade/slide, 150–300 ms). No instant pops.
- Keep `REGRET.md` updated whenever something that worked breaks.
- Commit after every task.

## Review Focus

1. **Invalid placement** (not enough Grapes, on the path, on an occupied spot, a second Thomas) → refused with a visible shake/red flash and a "nope" sound, Grapes unchanged. Tests in Tasks 3 and 8.
2. **Restart after Game Over / Victory** → a clean new run: Grapes, lives, wave, towers, buffs, timers and Taureau Rouge cooldown all reset. Test in Task 3 (`createGameState`), check in Task 6.
3. **Audio autoplay blocked by the browser** → no sound until the first click; music starts on the Title "Play" click, never throws. Task 10.
4. **Projector resolution / window resize** → game letterboxes and stays sharp, UI never clipped. Task 1 config, check in Task 7.
5. **Paused states** (Wine Tasting open, between waves) → enemies, cooldowns and Taureau Rouge timer do not tick. Test in Task 9 (`tickPowerUp` with `paused`).

---

## File Structure

```
index.html                     fonts, #game container
vite.config.js                 base '/WTD/', vitest config
package.json
REGRET.md  README.md
.github/workflows/deploy.yml   (Task 11)
src/main.js                    Phaser.Game config + scene list
src/config/palette.js          colours (hex strings + 0x numbers)
src/config/map.js              PATH points, BUILD_SPOTS, CANDLES
src/config/towers.js           TOWERS table
src/config/enemies.js          ENEMIES table
src/config/waves.js            WAVES table
src/config/tastings.js         TASTING_WINES table
src/logic/path.js              path length / position at distance
src/logic/state.js             createGameState, grapes, lives
src/logic/combat.js            damage, armour, slow, targeting
src/logic/waves.js             spawn schedule
src/logic/towers.js            placement + upgrade rules
src/logic/buffs.js             tasting buffs + Taureau Rouge timer
src/art/textures.js            procedural textures at boot
src/fx/lighting.js             darkness overlay, candle lights, vignette
src/fx/particles.js            splash, cork, dust, shatter emitters
src/fx/sound.js                sound manager wrapper
src/objects/Enemy.js  Tower.js  Projectile.js
src/scenes/BootScene.js TitleScene.js GameScene.js HUDScene.js TastingScene.js EndScene.js
tests/logic/*.test.js
```

---

### Task 1: Skeleton (Vite + Phaser 4 + Vitest)

**Files:** Create `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/scenes/BootScene.js`, `src/scenes/TitleScene.js`, `src/config/palette.js`, `REGRET.md`, `README.md`, `tests/logic/smoke.test.js`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test`; `PALETTE` (hex strings) and `COLORS` (0x numbers) from `src/config/palette.js`; scene keys `'Boot' 'Title' 'Game' 'HUD' 'Tasting' 'End'`.

- [ ] **Step 1:** `npm init -y`; `npm i phaser@4.2.1 --save-exact`; `npm i -D vite vitest`. Scripts: `dev: vite`, `build: vite build`, `preview: vite preview`, `test: vitest run`.
- [ ] **Step 2:** `vite.config.js`: `base: '/WTD/'`, `test: { environment: 'node', include: ['tests/**/*.test.js'] }`.
- [ ] **Step 3:** `index.html` loads Google Fonts Cinzel (600,700) + Cormorant Garamond (500,700), body background `#120a0d`, `<div id="game">`.
- [ ] **Step 4:** `src/main.js`: `type: Phaser.AUTO`, `width 1280, height 720`, `backgroundColor '#120a0d'`, `scale: { mode: FIT, autoCenter: CENTER_BOTH }`, scenes `[BootScene, TitleScene]` for now. Boot waits for `document.fonts.ready` then starts `'Title'`. Title shows "Wine Cellar Siege" in Cinzel, candle-gold.
- [ ] **Step 5:** `tests/logic/smoke.test.js`: `expect(PALETTE.burgundy).toBe('#8a1c2b')`. Run `npm test` → PASS.
- [ ] **Step 6:** Run `npm run dev`, open in Playwright, screenshot → title text visible, no console errors. Run `npm run build` → `dist/` created.
- [ ] **Step 7:** `REGRET.md` with heading and format line (`## HH:MM — what broke — why — fix`). `README.md`: title, how to run, "Assets & licences" section.
- [ ] **Step 8:** Commit `feat: skeleton with Phaser 4, Vite, Vitest`.

### Task 2: Map and path logic

**Files:** Create `src/config/map.js`, `src/logic/path.js`, `tests/logic/path.test.js`

**Interfaces:**
- Produces: `PATH: {x,y}[]` (polyline in 1280×720, enters off-screen left, ends at the Grand Cru near the right edge), `BUILD_SPOTS: {id, x, y}[]` (≈ 12, none within 50 px of the path), `CANDLES: {x, y, radius}[]` (≈ 6), `GRAND_CRU: {x, y}`.
- Produces: `createPath(points) -> { length: number, positionAt(d: number) -> {x, y, angle} }`. `d` clamps to `[0, length]`.

- [ ] **Step 1: Failing tests** in `path.test.js`:
```js
const p = createPath([{x:0,y:0},{x:100,y:0},{x:100,y:50}]);
expect(p.length).toBe(150);
expect(p.positionAt(50)).toMatchObject({x:50, y:0});
expect(p.positionAt(125)).toMatchObject({x:100, y:25});
expect(p.positionAt(999)).toMatchObject({x:100, y:50});
expect(p.positionAt(-5)).toMatchObject({x:0, y:0});
// every build spot is ≥ 50px from every path segment
```
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `createPath` (precompute cumulative segment lengths) and `map.js` with a winding S-shaped path.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: map and path logic`.

### Task 3: Game state, combat and towers logic

**Files:** Create `src/config/towers.js`, `src/config/enemies.js`, `src/logic/state.js`, `src/logic/combat.js`, `src/logic/towers.js`, `tests/logic/state.test.js`, `tests/logic/combat.test.js`, `tests/logic/towers.test.js`

**Interfaces:**
- `ENEMIES`: `fly {hp 20, speed 120, armour 0, reward 3}`, `corkscrew {hp 60, speed 70, armour 4, reward 6}`, `rat {hp 140, speed 45, armour 0, reward 10}`, `monstre {hp 2500, speed 25, armour 6, reward 200, splitInto: {type:'can', count:6}}`, `can {hp 80, speed 60, armour 2, reward 4}`. Leak cost: 1 life; `monstre` 10.
- `TOWERS`: `sommelier {cost 70, range 130, slow 0.5, slowMs 1200, rate 1.0}`, `cork {cost 50, range 150, damage 12, rate 3.0}`, `decanter {cost 90, range 120, damage 18, splash 60, rate 0.8}`, `thomas {cost 120, range 140, damage 8, rate 1.5, recruitCooldownMs 12000, unique: true}`. Each has `upgrades: [{cost, ...statOverrides}]` (1–2 entries; e.g. Thomas `[{cost 150, name 'Senior Recruiter', recruitCooldownMs 8000}, {cost 250, name 'Head of Talent', recruitCooldownMs 5000}]`).
- `createGameState() -> { grapes: 150, lives: 20, wave: 0, towers: [], buffs: [], status: 'playing' }`
- `spend(state, amount) -> boolean` (false and unchanged if not enough), `earn(state, amount)`, `loseLives(state, n)` (sets `status 'lost'` at ≤ 0).
- `applyDamage(enemy, rawDamage) -> number` dealt: `max(1, raw - armour)`; reduces `enemy.hp`.
- `pickTarget(tower, enemies) -> enemy | null`: alive enemy in range with the greatest `distance` travelled ("first").
- `canPlace(state, towerType, spotId) -> {ok: boolean, reason?: 'grapes'|'occupied'|'unique'}`; `placeTower(state, towerType, spotId) -> tower | null`; `upgradeTower(state, tower) -> boolean`; `towerStats(tower) -> merged base + upgrade stats`.

- [ ] **Step 1: Failing tests:**
```js
// state
const s = createGameState();
expect(spend(s, 200)).toBe(false); expect(s.grapes).toBe(150);
expect(spend(s, 50)).toBe(true);  expect(s.grapes).toBe(100);
loseLives(s, 20); expect(s.status).toBe('lost');
expect(createGameState().grapes).toBe(150);          // fresh run is clean (Review Focus 2)
// combat
expect(applyDamage({hp:60, armour:4}, 12)).toBe(8);
expect(applyDamage({hp:60, armour:20}, 12)).toBe(1);
pickTarget(towerAt(0,0,range 100), [enemy d=10 at (50,0), enemy d=40 at (90,0), enemy d=99 at (300,0)]) // → the d=40 one
// towers (Review Focus 1)
canPlace(s,'cork','A')       → ok; placeTower → grapes -50
canPlace(s,'cork','A')       → {ok:false, reason:'occupied'}
canPlace(poorState,'decanter','B') → reason 'grapes'
place thomas on B, then canPlace(s,'thomas','C') → reason 'unique'
upgradeTower thomas → towerStats(t).recruitCooldownMs === 8000
```
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement the modules to the signatures above.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: game state, combat and tower rules`.

### Task 4: Waves logic

**Files:** Create `src/config/waves.js`, `src/logic/waves.js`, `tests/logic/waves.test.js`

**Interfaces:**
- `WAVES: { groups: {type, count, intervalMs, delayMs}[] }[]` — 7 waves, ramping flies → corkscrews → rats → mixed; **wave 7 ends with one `monstre`**. Wave-clear bonus: `20 + 5 × waveIndex` Grapes.
- `buildSchedule(wave) -> {atMs, type}[]` sorted by `atMs`.
- `createWaveRunner(schedule) -> { tick(dtMs) -> type[] (spawns due), done: boolean }`.

- [ ] **Step 1: Failing tests:** `buildSchedule({groups:[{type:'fly',count:3,intervalMs:100,delayMs:0},{type:'rat',count:1,intervalMs:0,delayMs:50}]})` → `[0 fly, 50 rat, 100 fly, 200 fly]`; runner `tick(60)` → `['fly','rat']`, `tick(200)` → `['fly','fly']`, then `done === true`; `WAVES.at(-1)` contains a `monstre` group; `WAVES.length === 7`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: wave schedule and runner`.

### Task 5: Procedural art

**Files:** Create `src/art/textures.js`; modify `src/scenes/BootScene.js`

**Interfaces:**
- Produces: `generateTextures(scene)` called in `Boot.create()`; texture keys: `stone-floor`, `path-tile`, `barrel`, `candle`, `light-soft` (white radial gradient, 256 px), `vignette`, `grand-cru`, `enemy-fly`, `enemy-corkscrew`, `enemy-rat`, `enemy-monstre`, `enemy-can`, `tower-sommelier`, `tower-cork`, `tower-decanter`, `tower-thomas`, `proj-cork`, `proj-wine`, `drop`, `spark`, `taureau-rouge`, `parchment-panel`.
- Draw with `Graphics` + `generateTexture`, or a `CanvasTexture` for gradients. Pests = dark silhouettes with one coloured glint. `enemy-monstre` = big white bottle with green claw marks. `taureau-rouge` = slim can-shaped bottle, red/blue halves, bull-horn silhouette, no text logos. `tower-thomas` = sommelier with apron + wine glass + small "THOMAS" name plate.

- [ ] **Step 1:** Implement `generateTextures`. Add a debug key in Title (`T`) that shows every texture in a grid.
- [ ] **Step 2:** Playwright screenshot of the grid → every key renders, nothing blank, palette respected.
- [ ] **Step 3:** Commit `feat: procedural textures`.

### Task 6: Core loop in GameScene

**Files:** Create `src/objects/Enemy.js`, `src/objects/Tower.js`, `src/objects/Projectile.js`, `src/scenes/GameScene.js`, `src/scenes/EndScene.js`; modify `src/main.js`, `TitleScene.js`

**Interfaces:**
- Consumes: Tasks 2–5.
- `GameScene` holds `this.state = createGameState()`, `this.path = createPath(PATH)`. Emits on `this.events`: `'grapes-changed'(n)`, `'lives-changed'(n)`, `'wave-started'(i)`, `'wave-cleared'(i)`, `'tower-placed'(tower)`, `'placement-refused'(reason)`, `'enemy-killed'(enemy)`. Listens: `'start-wave'`, `'select-tower'(type)`, `'upgrade-tower'(tower)`.
- `Enemy(scene, type)`: moves `distance += speed × slowFactor × dt`, positions via `path.positionAt`, rotates to `angle`, hp bar on damage. Leak at `distance ≥ path.length` → `loseLives`.
- `Tower`: picks target each tick via `pickTarget`, fires `Projectile` at `rate`; sommelier applies slow instead of a projectile; decanter splash damages all within `splash`.
- Placement: clicking a build spot with a tower selected calls `canPlace`/`placeTower`; on refusal emit `'placement-refused'`.
- `EndScene` receives `{result: 'won'|'lost', wave}`, has "Play again" that restarts `Game` with a fresh state.

- [ ] **Step 1:** Implement scenes and objects. Title "Play" → `Game`.
- [ ] **Step 2:** Playwright: place a cork cannon, start wave 1, wait, screenshot → enemies walk the path, get shot, Grapes increase. Let enemies leak → lives drop → End "lost".
- [ ] **Step 3:** Click "Play again" → Grapes 150, lives 20, no towers or enemies (Review Focus 2).
- [ ] **Step 4:** Commit `feat: playable core loop`.

### Task 7: Candle lighting and the cellar look

**Files:** Create `src/fx/lighting.js`; modify `GameScene.js`, `TitleScene.js`

**Interfaces:**
- `createLighting(scene, { candles }) -> { addLight(x, y, radius, tint) -> light, removeLight(light), update(time) }`.
- Method: a full-screen `RenderTexture` filled with `#120a0d` at ≈ 0.82 alpha; each frame erase `light-soft` stamps at every light (radius × flicker `1 ± 0.06·sin(time·rate + seed)`) so the room shows through; then additive `light-soft` sprites tinted amber `#ffb35c` at ≈ 0.35 alpha for the glow; `vignette` on top. Towers add a small light (radius 90) when placed.
- Floor: tiled `stone-floor`, path drawn with `path-tile` plus a darker edge, barrels dotted around the edges, `grand-cru` with its own light at the end.

- [ ] **Step 1:** Implement and wire in.
- [ ] **Step 2:** Playwright screenshot next to `docs/superpowers/specs/assets/style-a-mood.svg` → warm pools, deep edges, path, towers and pests clearly readable. Resize the window to 1920×1080 and 1024×768 → letterboxed, sharp (Review Focus 4).
- [ ] **Step 3:** Commit `feat: candle lighting and cellar look`.

### Task 8: HUD, Title and End polish (frontend-design skill)

**Files:** Create `src/scenes/HUDScene.js`; modify `TitleScene.js`, `EndScene.js`, `GameScene.js`

**Interfaces:**
- `HUDScene` runs in parallel with `Game` and only talks to it through `Game`'s events (Task 6).
- HUD: parchment panels (Cinzel headings, Cormorant body, ink `#3a1a12`). Top-left 🍇 Grapes (counter tweens when it changes); top-right wave `n / 7` and Grand Cru lives; bottom tower bar (4 cards with icon, name, cost; greyed when unaffordable; Thomas greyed once placed); "Next wave" button; Taureau Rouge button with radial cooldown (wired in Task 9). Clicking a placed tower opens an upgrade panel (name, next upgrade, cost).
- Refusal feedback: card shake + red flash, for each `'placement-refused'` reason (Review Focus 1).
- Title: slow camera pan across the lit cellar, title + subtitle "Wine Cellar Siege", Play button with hover glow. End: "The Grand Cru has shattered" (lost, glass-shatter burst) / "Vintage saved!" (won), stats, Play again.

- [ ] **Step 1:** Load the `frontend-design` skill for the visual pass, then implement.
- [ ] **Step 2:** Playwright: full flow Title → Game → buy/upgrade → End. Screenshot each screen; every panel animates in; refused placement shows feedback.
- [ ] **Step 3:** Commit `feat: HUD, title and end screens`.

### Task 9: Nexios features

**Files:** Create `src/config/tastings.js`, `src/logic/buffs.js`, `src/scenes/TastingScene.js`, `tests/logic/buffs.test.js`; modify `GameScene.js`, `HUDScene.js`, `src/objects/Tower.js`, `src/objects/Enemy.js`

**Interfaces:**
- `TASTING_WINES`: ≥ 6 entries `{id, name, line, effect: {stat, mult}}` (e.g. "Château Range" +20 % range, "Cork Reserve" +25 % cork damage, "Slow Pinot" +30 % slow duration, "Grape Harvest" +25 % Grapes per kill). `line` = Thomas's one-liner.
- `drawTasting(rng = Math.random) -> wine[3]` (distinct). `applyBuffs(stats, buffs) -> stats` (multiplies matching stats).
- `createPowerUp({durationMs: 10000, cooldownMs: 45000}) -> {active, ready, activate() -> boolean, tick(dtMs, {paused}), fireRateMult() -> 2|1}`.
- **Thomas Recruit:** every `recruitCooldownMs` Thomas picks the strongest non-boss enemy in range; it turns gold, reverses direction along the path and damages the first enemy it touches (its remaining hp as damage), then disappears.
- **Le Monstre Blanc:** on death spawn `splitInto.count` `can` enemies at its distance, spread ± 20 px; camera shake while it walks (small) and on death (big).
- **TastingScene:** opens after each `'wave-cleared'` except the last; Game paused while open; Thomas portrait + speech bubble; 3 cards flip in; pick → buff pushed to `state.buffs`, closes, Game resumes.

- [ ] **Step 1: Failing tests:**
```js
expect(new Set(drawTasting().map(w=>w.id)).size).toBe(3);
expect(applyBuffs({range:100}, [{stat:'range', mult:1.2}]).range).toBe(120);
const p = createPowerUp({durationMs:10000, cooldownMs:45000});
expect(p.activate()).toBe(true); expect(p.fireRateMult()).toBe(2);
p.tick(5000, {paused:true});  expect(p.active).toBe(true);   // Review Focus 5
p.tick(10000, {paused:false}); expect(p.active).toBe(false); expect(p.activate()).toBe(false);
p.tick(45000, {paused:false}); expect(p.ready).toBe(true);
```
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement logic, then wire Recruit, Monstre split, Tasting and Taureau Rouge (button, 2× fire rate, red/blue screen tint + sparks). **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Playwright: clear wave 1 → Tasting appears, pick works; activate Taureau Rouge → tint + faster fire; Recruit visible; spawn Monstre (dev key, Task 10) → splits into cans.
- [ ] **Step 6:** Commit `feat: Thomas, Wine Tasting, Taureau Rouge, Le Monstre Blanc`.

### Task 10: Juice, sound and demo keys

**Files:** Create `src/fx/particles.js`, `src/fx/sound.js`; modify `GameScene.js`, `HUDScene.js`, `TitleScene.js`, `BootScene.js`

**Interfaces:**
- `particles.js`: `splash(scene,x,y)`, `corkPop(scene,x,y)`, `shatter(scene,x,y)`, `startDust(scene)`. Cap live particles (≈ 400).
- `sound.js`: `initSound(scene)` (call on Title "Play" click, Review Focus 3), `play(key, opts)`, `setMuted(bool)`, `startMusic()`. Keys: `place`, `cork`, `splash`, `hit`, `kill`, `leak`, `nope`, `heartbeat`, `shatter`, `wave`, `music`, `ambience`. **Ask the user before downloading Kenney CC0 audio packs**; if declined or slow, synthesise short effects with WebAudio (`zzfx`-style) and play without music.
- Mute toggle (M key + HUD icon).
- **Demo keys (dev only, no UI):** `1`–`7` jump to that wave, `B` spawn Le Monstre Blanc, `G` +500 Grapes, `W` open Wine Tasting, `R` charge Taureau Rouge.

- [ ] **Step 1:** Implement, hook into events (hit, kill, place, leak, wave start, power-up, game over).
- [ ] **Step 2:** Playwright playthrough via demo keys → every Nexios reference shown in < 2 minutes; no console errors.
- [ ] **Step 3:** Update `README.md` asset credits and demo keys. Commit `feat: juice, sound and demo keys`.

### Task 11: Deploy (last; optional)

**Files:** Create `.github/workflows/deploy.yml`

- [ ] **Step 1:** Workflow: on push to `main` → `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact` (`dist`), `actions/deploy-pages`.
- [ ] **Step 2:** **Ask the user before** `gh repo create WTD --public --source . --push` and enabling Pages (`build_type: workflow`).
- [ ] **Step 3:** Open `https://<user>.github.io/WTD/` → game loads. If it fails by 15:40, fall back to `npm run build && npm run preview` over HDMI and log the failure in `REGRET.md`.
- [ ] **Step 4:** Commit `ci: GitHub Pages deploy`.
