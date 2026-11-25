# Playtest Feedback 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Process the second round of playtest feedback. Thomas gets a nerf; the game gets a pause screen with Back to title, 2× speed, a next-wave preview with auto next wave, selling towers, and Endless mode after wave 7.

**Architecture:**
- Game rules (recruit budget, sell value, endless waves, wave preview text) go into `src/logic/` as pure, unit-tested functions.
- A new `PauseScene` modal (pattern: `TastingScene`) serves both the pause menu and the "cellar holds" victory choice.
- Speed, auto-wave and the countdown live in `GameScene`, so they run on scene time and freeze while paused. The HUD only shows them and sends events.

**Tech Stack:** Phaser 4.2.1, Vite, Vitest.

**Spec:** Decided with the user in conversation (2026-11-25, ~13:00). Leaderboard and targeting priority are **out**. Decisions:

| Item | Decision |
|---|---|
| Thomas nerf | A recruit's HP becomes a damage **budget**: each smash spends what it deals, and the recruit pops at 0. Recruit cooldown 6 s → **8 s** (upgrades 4.5 → **6 s**, 3 → **4.5 s**). Aura unchanged. He must stay the strongest tower, but not an instant win. |
| Pause | `P` or `Esc` (when there is nothing to cancel), plus a pause button in the top HUD. A parchment panel offers **Resume**, **Restart**, **Back to title**. `P`/`Esc` again resumes. |
| 2× speed | A HUD toggle (1× / 2×) plus the `F` key. All game logic runs at 2×. Speed resets to 1× on every new run. |
| Next-wave preview | A line above the Next wave button, e.g. "Next: Rats ×7 · Flies ×16", or "Next: Le Monstre Blanc!" when the boss comes. |
| Auto next wave | A HUD toggle. When on, the next wave starts **3 s** after a wave clears (and after the Wine Tasting closes). The button shows "Next wave in 3…". The setting is remembered across runs in the same page. |
| Sell | A Sell button in the upgrade panel. Value: **70% of the Grapes invested, scaled by the tower's HP fraction**, rounded down. Scaling by HP is my call, so selling never beats repairing. Two-step click: "Sell for N" → "Sure? +N" (3 s window) → sold. |
| Endless | After wave 7 is cleared, a choice: **Keep pouring (Endless)** or **Claim victory**. Endless waves scale up and Le Monstre Blanc returns every 3rd endless wave. A Wine Tasting runs after every 3rd endless wave. A loss in Endless ends on a *victory* End screen that shows "Endless: held until wave N". |

**Runs in parallel** with `docs/superpowers/plans/2026-11-25-projector-polish.md`, which another session works on in the main folder. This plan runs in a **git worktree on branch `feedback-2`**. This is a one-time exception to CLAUDE.md's "no worktrees" rule, approved by the user. See Task 7 for the merge.

## Global Constraints

- **The session starts in the main folder `C:\Users\Thoma\dev\WTD`, which the projector session is using. Do Task 0 first and never edit, build, run tests or start a dev server there.** After Task 0, every file path, command and dev server runs in `C:\Users\Thoma\dev\WTD-feedback`. Use absolute paths, and prefix shell commands with `cd /c/Users/Thoma/dev/WTD-feedback &&` (Bash) or `Set-Location C:\Users\Thoma\dev\WTD-feedback;` (PowerShell).
- Work and commit on branch `feedback-2` in the worktree. Never push `feedback-2` to `main` before Task 7.
- Time-box: feature work stops at **14:45**, and Task 7 (merge) must be done by **15:15**. The task order is the priority order: if time runs short, skip Endless (Task 6), then Sell (Task 5).
- Phaser 4 APIs only: use the project skills in `.claude/skills/` (`scenes`, `input-keyboard-mouse-touch`, `time-and-timers`, `tweens`, `text-and-bitmaptext`). Don't write Phaser 3 from memory.
- `src/logic/` stays Phaser-free. `npm test` must pass after every task.
- Reuse the UI kit (`src/ui/kit.js`: `panel`, `button`, `serif`, `body`, `enter`, `shake`) and the look of the Wine Tasting modal.
- Parody names only. Thomas is a generic sommelier, name only. Never reintroduce the Nexios sword, the victory bell or Pizza Hut.
- Keep the presenter keys working: `1`–`7`, `B`, `G`, `W`, `R`, `D`, `M`, `L` (from the projector session), and `T` on the title. New keys: `P` (pause) and `F` (speed).
- Any new HUD button must be added to `HUD_ZONES` (`src/config/map.js`), so towers can't be placed under it.
- Log anything that worked and then broke in `REGRET.md`.
- Verify visuals with screenshots of the worktree's dev server. Vite picks the next free port, probably 5174, because the projector session holds 5173. Use a 1280×720 viewport.

## Review Focus

1. **Restart and Back to title from the pause menu:** a clean new run (Grapes 150, wave 0, no leftover towers or enemies, HUD listeners not doubled, speed back to 1×), and no audio or scene left running. REGRET.md already has two scene-reuse bugs like this. Task 2 Step 5 pins it.
2. **Pausing at awkward moments:** during the Wine Tasting, during the game-over fade, with the upgrade panel open, or with a tower selected for placement. `Esc` cancels first and pauses only when nothing is open; `P` while the Tasting is open does nothing. Task 2 Step 5.
3. **2× speed with Taureau Rouge, Recruit cooldowns and the boss split:** timers are scene-time based, and nothing runs at 1× while the rest runs at 2×. Task 3 Step 3.
4. **Auto-wave around the Wine Tasting, the victory choice and pause:** the countdown never starts while a modal is open, freezes while paused, and never starts wave 8 without the Endless choice. Task 4 Step 5.
5. **Selling Thomas:** his aura, recruits, name tag (if the projector work landed) and light go with him, and he can be built again (`thomasPlaced` resets). Task 5 Step 5.

---

### Task 0: Set up the worktree (the agent does this; the user does nothing)

- [ ] **Step 1: Create it from the main folder.** If `C:\Users\Thoma\dev\WTD-feedback` already exists and is on `feedback-2`, skip to Step 2.
  ```bash
  cd /c/Users/Thoma/dev/WTD && git fetch origin && git worktree add ../WTD-feedback -b feedback-2 origin/main
  ```
  Don't run `git checkout`, `git switch`, `git stash` or `git reset` in `C:\Users\Thoma\dev\WTD`: the projector session is working there.
- [ ] **Step 2: Install and check it.**
  ```bash
  cd /c/Users/Thoma/dev/WTD-feedback && npm install && npm test && git branch --show-current
  ```
  Expected: tests pass, and the branch prints `feedback-2`.
- [ ] **Step 3: Start the dev server from the worktree** (`npm run dev` in `C:\Users\Thoma\dev\WTD-feedback`, in the background). Note the port it prints, most likely 5174, and use that URL for every screenshot. Port 5173 belongs to the projector session.
- [ ] **Step 4:** Read `CLAUDE.md` and this plan **from the worktree**, so you work on the same files you edit.

### Task 1: Nerf Thomas

**Files:**
- Modify: `src/config/towers.js` (`thomas.recruitCooldownMs` and its upgrades)
- Modify: `src/logic/combat.js` (new export)
- Modify: `src/scenes/GameScene.js` (`recruit`, `updateRecruits`)
- Test: `tests/logic/combat.test.js`, `tests/logic/towers.test.js` (update the cooldown values if asserted)

**Interfaces:**
- Produces: `recruitSmash(budget: number, foeHp: number) -> { deal: number, left: number }`, where `deal = min(budget, foeHp)` and `left = budget - deal`.

- [ ] **Step 1: Write the failing tests** in `tests/logic/combat.test.js`:
  - `recruitSmash(140, 20)` → `{ deal: 20, left: 120 }`
  - `recruitSmash(30, 60)` → `{ deal: 30, left: 0 }`
  - `recruitSmash(0, 20)` → `{ deal: 0, left: 0 }`
- [ ] **Step 2: Run** `npx vitest run tests/logic/combat.test.js`. Expected: FAIL (not exported).
- [ ] **Step 3: Implement** `recruitSmash` and change the config:
  - `recruitCooldownMs`: 6000 → **8000**.
  - Upgrades: Senior Recruiter 4500 → **6000**, Head of Talent 3000 → **4500**.
  - Fix any test in `towers.test.js` that asserts the old values.
- [ ] **Step 4: Wire it in GameScene.**
  - `recruit()` sets `enemy.budget = enemy.maxHp`.
  - `updateRecruits` uses `const { deal, left } = recruitSmash(r.budget, foe.hp)`, calls `damageEnemy(foe, deal)`, sets `r.budget = left`, and dismisses the recruit as soon as `left <= 0` (with its existing spark burst).
  - Add a small "Spent!" `floatText` when a recruit pops early.
- [ ] **Step 5: Verify.**
  - `npm test` passes.
  - On the dev server: `G G`, place Thomas plus 2 cheap towers, press `5`. Recruits pop after a few smashes instead of clearing the lane. Thomas still visibly carries the defence. Waves 1–6 are still winnable with an honest build.
- [ ] **Step 6: Commit:** `git commit -am "feat: nerf Thomas: recruits spend their HP as a damage budget"`

### Task 2: Pause screen with Restart and Back to title

**Files:**
- Create: `src/scenes/PauseScene.js`
- Modify: `src/main.js` (scene list: add `PauseScene` after `TastingScene`, before `EndScene`)
- Modify: `src/scenes/GameScene.js` (`openPause()`, `onEsc`, keys, `cleanup` also stops `'Pause'`)
- Modify: `src/scenes/HUDScene.js` (`createTop`: pause button next to the mute button)
- Modify: `src/config/map.js` (`HUD_ZONES`: widen the top-left zone if the button sits past x 272)
- Modify: `README.md` (Demo keys table: `P`)

**Interfaces:**
- Produces:
  - Scene key `'Pause'`, launched with data `{ mode: 'pause' | 'victory' }`. Task 6 uses `'victory'`; this task builds the `'pause'` mode, and the scene must accept a mode.
  - `GameScene#openPause(mode = 'pause')`: pauses Game and launches Pause. It is ignored while `tastingOpen`, `ending` or already paused. It sets `this.pauseOpen = true`.
  - `GameScene#resumeFromPause()`: `pauseOpen = false`, resumes Game.
  - The Pause scene emits nothing. It calls `game.resumeFromPause()`, `game.scene.restart()` or the to-title sequence directly through `this.scene.get('Game')`.

- [ ] **Step 1: Build `PauseScene`.**
  - A full-screen veil that swallows clicks (copy TastingScene's veil, alpha 0.7).
  - A parchment `panel` (about 420×330) with the title "Paused" (`serif(40, PALETTE.candleGold)`) and three `button`s: **Resume**, **Restart**, **Back to title**.
  - `P` and `Esc` in this scene resume.
  - Reset all per-run flags in `create()`, because the scene instance is reused (see REGRET.md 10:37).
- [ ] **Step 2: Wire the three actions.**
  - **Resume:** `this.scene.stop()`, then `game.resumeFromPause()`.
  - **Restart:** `this.scene.stop()`, then `game.scene.restart()`. Game's existing shutdown `cleanup` stops HUD and Tasting, and its `create` relaunches HUD.
  - **Back to title:** `this.scene.stop('Game')` (cleanup stops HUD/Tasting/Pause), then `this.scene.start('Title')`.
- [ ] **Step 3: Add the keys and button.**
  - In GameScene's key handler, `P` calls `openPause()`.
  - `onEsc`: when no tower is selected for placement *and* the HUD's upgrade panel is closed, call `openPause()`. Ask the HUD through an event or flag (for example `this.registry.get('upgradeOpen')` set by the HUD); the builder picks the mechanism.
  - HUD: a round pause button (two bars) next to the mute icon. A click emits `'pause'`, which GameScene listens for. Add a hover tooltip "Pause (P)".
- [ ] **Step 4: Update README.** Add a Demo keys row: `` `P` / `Esc` | Pause: Resume, Restart, Back to title ``.
- [ ] **Step 5: Verify (Review Focus 1 and 2).**
  - Pause mid-wave: enemies freeze, and the Taureau Rouge timer freezes.
  - Resume: everything continues.
  - Restart mid-wave: a clean run with 150 Grapes, no leftover towers or enemies, and a working HUD. Do it twice in a row.
  - Back to title, then Play: a clean run.
  - `Esc` with a tower selected cancels the placement (no pause); a second `Esc` pauses.
  - `P` while the Tasting is open: nothing happens.
  - No console errors.
- [ ] **Step 6: Commit:** `git commit -am "feat: pause menu with restart and back to title"` (add `src/scenes/PauseScene.js` first).

### Task 3: 2× speed

**Files:**
- Modify: `src/scenes/GameScene.js` (`update`, a `setSpeed` method, key `F`)
- Modify: `src/scenes/HUDScene.js` (`createTop`: speed toggle next to the pause button)
- Modify: `README.md` (Demo keys: `F`)

**Interfaces:**
- Produces:
  - `GameScene#speed`: 1 or 2, set to 1 in `create()`.
  - `GameScene#setSpeed(n)`: sets `speed`, `this.tweens.timeScale = n` and `this.time.timeScale = n`, then emits `'speed-changed'` with `n`.
  - The HUD emits `'toggle-speed'`, and GameScene listens for it.

- [ ] **Step 1: Speed up the logic.** In `update`, compute `const dt = (Math.min(delta, 100) / 1000) * this.speed;`. Everything already flows from `dt` and `this.clock`.
- [ ] **Step 2: Add the controls.**
  - HUD: a toggle labelled "1×" / "2×" (amber ring when 2×), with tooltip "Speed (F)".
  - `F` key in GameScene.
  - README Demo keys row: `` `F` | 2× speed ``.
- [ ] **Step 3: Verify (Review Focus 3).**
  - At 2×, a wave clears in about half the time.
  - Taureau Rouge's 10 s burst lasts about 5 s real time.
  - Recruits arrive twice as often.
  - The boss split animation still plays.
  - Pausing at 2× and resuming keeps 2×.
  - Restart returns to 1×.
- [ ] **Step 4: Commit:** `git commit -am "feat: 2x speed toggle"`

### Task 4: Next-wave preview and auto next wave

**Files:**
- Modify: `src/logic/waves.js` (new export)
- Test: `tests/logic/waves.test.js`
- Modify: `src/scenes/GameScene.js` (auto-wave countdown)
- Modify: `src/scenes/HUDScene.js` (preview line + Auto toggle above the Next wave button)
- Modify: `src/config/map.js` (`HUD_ZONES` if the new strip extends above y 598)

**Interfaces:**
- Produces:
  - `describeWave(wave: { groups }) -> string`: groups merged by type, in first-appearance order, joined with `' · '`.
    - Names: fly → `Flies`, corkscrew → `Corkscrews`, rat → `Rats`, can → `Cans`.
    - Any group of `monstre` makes the whole string `'Le Monstre Blanc!'`.
    - Example: `{ groups: [{ type: 'rat', count: 7 }, { type: 'fly', count: 16 }] }` → `'Rats ×7 · Flies ×16'`.
  - GameScene emits `'auto-wave-tick'` with the seconds left (integer, or `null` when no countdown is running), and listens for `'toggle-auto'`.
  - The auto setting lives in `this.registry` under `'autoWave'`, so it survives restarts.

- [ ] **Step 1: Write the failing tests:**
  - The example above.
  - A wave with two fly groups merges them into one entry: `Flies ×20`.
  - Wave 7 (`WAVES[6]`) returns `'Le Monstre Blanc!'`.
- [ ] **Step 2: Run** `npx vitest run tests/logic/waves.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `describeWave`. Run `npm test`. Expected: PASS.
- [ ] **Step 4: Wire it up.**
  - **HUD:** a line `Next: ${describeWave(...)}` (`body(18, PALETTE.parchment)`, right-aligned to the button) just above Next wave. It updates on `wave-started`/`wave-cleared` and is hidden while a wave runs. In Endless (Task 6), use the endless wave description.
  - **Auto toggle:** a small chip "Auto" with a checkbox look, next to the preview line.
  - **GameScene:** `this.autoIn` (ms) is set to 3000 when a wave clears with auto on. It only counts down in `update` while `!this.runner && this.enemies.length === 0 && !this.tastingOpen && !this.pauseOpen && !this.ending`, emits `'auto-wave-tick'` once per whole second, and calls `startWave()` at 0.
  - A manual Next wave click or turning auto off clears the countdown.
  - The HUD button label shows `Next wave in N…` while counting.
- [ ] **Step 5: Verify (Review Focus 4).**
  - Auto on: wave 1 clears, the Tasting opens, and no countdown runs. Pick a wine: "Next wave in 3…" counts down and the wave starts.
  - Pausing mid-countdown freezes it.
  - The preview text is right for waves 1–7.
  - After wave 7, auto never starts a wave without the Endless choice (once Task 6 exists).
- [ ] **Step 6: Commit:** `git commit -am "feat: next-wave preview and auto next wave"`

### Task 5: Sell a tower

**Files:**
- Modify: `src/logic/siege.js` (new exports next to `investedIn`)
- Test: `tests/logic/siege.test.js`
- Modify: `src/scenes/GameScene.js` (sell handler; extract the shared tower teardown)
- Modify: `src/scenes/HUDScene.js` (`openUpgrade`: Sell button; Thomas card unlocks again)

**Interfaces:**
- Consumes: `investedIn(placed)` and `towerStats(placed).maxHp`.
- Produces:
  - `sellValue(placed) -> number` = `Math.floor(0.7 * investedIn(placed) * placed.hp / maxHp)`.
  - `sellTower(state, placed) -> number`: removes the tower from `state.towers`, `earn`s the value, and returns it.
  - Event `'sell-tower'` (placed): HUD → Game. Game emits `'tower-sold'` (placed, value) and `'grapes-changed'`.

- [ ] **Step 1: Write the failing tests:**
  - A level-0 Cork Cannon (cost 50) at full HP → `sellValue` 35.
  - The same tower at half HP → 17.
  - After an upgrade (50 + 50 invested) at full HP → 70.
  - `sellTower` removes the tower from `state.towers` and adds the value to `state.grapes`.
- [ ] **Step 2: Run** `npx vitest run tests/logic/siege.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement both functions.** Run `npm test`. Expected: PASS.
- [ ] **Step 4: Wire it up.**
  - **GameScene:** extract the per-tower teardown that tower destruction already does (remove light, `t.destroy()`, splice from `this.towers`) into `removeTower(t)` and use it for both paths. The sell handler then:
    - calls `sellTower`
    - calls `removeTower`
    - shows a gold coin-burst: `this.sparks.explode` plus `floatText('+N Grapes', '#ffd36b')`
    - plays `play('place')` at a lower pitch, or any existing pleasant sound
    - emits the events.
  - **HUD:** add a third button under Repair, "Sell for N" (grow the panel). The first click changes the label to "Sure? +N" for 3 s, and a second click within that window emits `'sell-tower'`. The panel closes on `tower-sold`. On `tower-sold` for Thomas, reset `thomasPlaced` the same way the tower-destroyed handler does.
- [ ] **Step 5: Verify (Review Focus 5).**
  - Sell a full-HP Cork: +35 Grapes and the tower is gone.
  - Sell a damaged tower (`D` first): the value is lower.
  - Sell Thomas: aura ring, light and recruits are gone, and his card can be built again.
  - A single click does not sell.
- [ ] **Step 6: Commit:** `git commit -am "feat: sell towers"`

### Task 6: Endless mode

**Files:**
- Modify: `src/logic/waves.js` (new export; `buildSchedule` passes `hpMult` through)
- Test: `tests/logic/waves.test.js`
- Modify: `src/objects/Enemy.js` (constructor: optional `hpMult`)
- Modify: `src/scenes/GameScene.js` (`startWave`, `spawnEnemy`, wave-cleared branch, `endGame` data)
- Modify: `src/scenes/PauseScene.js` (`'victory'` mode)
- Modify: `src/scenes/HUDScene.js` (wave counter and banners past wave 7)
- Modify: `src/scenes/EndScene.js` (endless result line)

**Interfaces:**
- Consumes: `PauseScene` with `{ mode: 'victory' }` (Task 2) and `describeWave` (Task 4).
- Produces:
  - `waveAt(index: number) -> { groups, hpMult }`:
    - For `index < WAVES.length`, it returns `{ ...WAVES[index], hpMult: 1 }`.
    - Past that, with `k = index - WAVES.length + 1` (1 for wave 8), it returns `WAVES[WAVES.length - 1]`'s non-boss groups with `count = Math.round(count * (1 + 0.2 * k))` and `hpMult = 1 + 0.15 * k`.
    - When `k % 3 === 0`, it adds `{ type: 'monstre', count: 1, intervalMs: 0, delayMs: 9000 }`.
  - `buildSchedule(wave)` entries gain `hpMult` (default 1).
  - `spawnEnemy(type, distance = 0, hpMult = 1)`.
  - `GameScene#endless: boolean`.
  - End data gains `endless: boolean`.

- [ ] **Step 1: Write the failing tests:**
  - `waveAt(0)` deep-equals `{ ...WAVES[0], hpMult: 1 }`.
  - `waveAt(7)`: `k = 1`, `hpMult` 1.15, no monstre group, and the corkscrew count is `Math.round(12 * 1.2)` (14).
  - `waveAt(9)`: `k = 3`, contains a monstre group.
  - `buildSchedule(waveAt(7))[0].hpMult === 1.15`.
- [ ] **Step 2: Run** `npx vitest run tests/logic/waves.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `waveAt` and the `hpMult` pass-through. Run `npm test`. Expected: PASS.
- [ ] **Step 4: Wire the game.**
  - `startWave`: use `waveAt(this.waveIndex)`. The guard `state.wave >= WAVES.length` only applies when `!this.endless`.
  - `spawnEnemy` passes `hpMult` to `Enemy`, which multiplies `hp`/`maxHp`.
  - **Wave cleared at the last scripted wave:** instead of `endGame('won')`, call `openPause('victory')`. The PauseScene victory mode shows the title "The cellar holds!" and two buttons:
    - **Keep pouring:** sets `game.endless = true`, resumes, and shows the banner "Endless cellar".
    - **Claim victory:** resumes, then `game.endGame('won')`.
    - `Esc`/`P` do nothing in victory mode.
  - **Endless waves cleared:** open the Tasting when `k % 3 === 0`; otherwise go on (auto-wave countdown applies).
  - **Loss in Endless:** `endGame` sends `{ result: 'won', endless: true, wave }`. EndScene shows its victory look plus the line `Endless: held until wave N`.
  - **HUD:** the wave counter shows `Wave N` with a small `Endless` tag instead of `N / 7` once past 7. Wave banners say `Endless wave N`.
  - The `1`–`7` jump keys stay as they are.
- [ ] **Step 5: Verify.**
  - `7` → boss → clear: the victory choice appears.
  - Claim victory: End screen as today.
  - Play again → `7` → clear → Keep pouring: wave 8 starts (manually or by auto), pests are tougher, and the HUD shows Endless.
  - `G` a few times and play to wave 10: Le Monstre Blanc returns.
  - Lose on purpose: the End screen shows "Endless: held until wave N".
  - No console errors.
- [ ] **Step 6: Commit:** `git commit -am "feat: endless mode after wave 7"`

### Task 7: Merge into main (by 15:15)

The projector-polish session pushes straight to `main` from the main folder while this branch is open. Expect conflicts in `GameScene.js`, `HUDScene.js`, `main.js` and `README.md`.

- [ ] **Step 1:** `git fetch origin && git merge origin/main`. Resolve conflicts, keeping both sides:
  - Projector work: `hdCamera(...)` calls, `pointer.worldX/worldY`, `L` key, projector toast, Thomas's name tag.
  - This branch: pause/speed/auto/sell/endless.
- [ ] **Step 2: If projector Task 3 (HD rendering) landed** (`src/ui/hd.js` exists):
  - Call `hdCamera(this)` at the top of `PauseScene.create()`.
  - Make sure the new HUD buttons have no `pointer.x/y` reads.
  - **If the projector name tag landed:** `removeTower` (sell) must destroy it too. `Tower#destroy` should already do it; check.
- [ ] **Step 3:** Run `npm test`. Expected: all pass. Then a 3-minute smoke run on the dev server covering all of these with no console errors:
  - pause → restart
  - 2×
  - auto wave
  - sell Thomas
  - `7` → Keep pouring → wave 8
  - `L` (projector on)
- [ ] **Step 4:** `git push origin HEAD:main` (fast-forward; if it's rejected because main moved again, repeat from Step 1). Watch the deploy (`gh run list --limit 1`), then run the README demo script on https://thomasokvs.github.io/WTD/.
- [ ] **Step 5:** Update `docs/superpowers/HANDOVER.md` "Where things stand" with what shipped and what was cut, and update the README demo script if Endless or the new keys change it. Commit and `git push origin HEAD:main`.
- [ ] **Step 6: Clean up.**
  - Stop this worktree's dev server.
  - Tell the projector session (or the user, if you can't message it) that `feedback-2` is merged into `main`. It should run `git pull` and then its Task 4.
  - Remove the worktree:
    ```bash
    cd /c/Users/Thoma/dev/WTD && git worktree remove ../WTD-feedback && git branch -d feedback-2
    ```
    If removal fails because a process still holds files, leave it and say so. It's harmless.
