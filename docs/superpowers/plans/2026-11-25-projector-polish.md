# Projector Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game read well when projected on a white wall at the 16:00 demo: a brighter projector mode on `L`, Thomas who stands out on the board, and sharp art instead of stretched 1× pixels.

**Architecture:** A tiny Phaser-free display-state module (`src/fx/projector.js`) is toggled by a window key listener and observed by the lighting module and HUD. Thomas gets a larger sprite, a real text name banner and a gold spotlight. Sharpness comes from rendering the canvas at 2× (2560×1440) with every scene camera zoomed 2× around the old 1280×720 world, plus generated textures drawn at 2× and mapped back to their logical size, so no game coordinates change.

**Tech Stack:** Phaser 4.2.1, Vite, Vitest.

**Spec:** No separate spec. Decided with the user in conversation (2026-11-25, ~12:30):
- Projector mode on `L`. Today's dark, moody look stays the default.
- Sharper art everywhere, so Thomas's card icon and sprite stop looking low quality.
- Thomas obvious on the board: today his name is 6.5 px text baked into a 64×72 texture.

**Prerequisite:** The "Enemies fight back" work (`docs/superpowers/plans/2026-11-25-enemies-fight-back.md`) is pushed to `main`. Run `git pull` and `npm test` before starting. Line numbers below are from before that work and will have moved; find code by the names given.

## Global Constraints

- Git: commit and push straight to `main` after each task. No branches, no worktrees, no PRs. A push deploys to https://thomasokvs.github.io/WTD/ in 1–2 minutes.
- Time-box: stop feature work by 15:15. The task order is the priority order. If time runs short, drop Task 3 (HD rendering) before anything else.
- Phaser 4 APIs only: read the project skills in `.claude/skills/` (`cameras`, `game-setup-and-config`, `text-and-bitmaptext`, `filters-and-postfx`, `tweens`) instead of writing Phaser 3 APIs from memory.
- Parody names only. Thomas is a generic sommelier, name only. Never reintroduce the Nexios sword, the victory bell or Pizza Hut.
- `src/logic/` stays Phaser-free. `npm test` must pass after every task.
- Keep the presenter keys working: `1`–`7`, `B`, `G`, `W`, `R`, `D`, `M`, and `T` on the title screen. `L` is new and must not clash with them.
- Log anything that worked and then broke in `REGRET.md` (`## HH:MM — what broke — why — fix`).
- Verify visuals with screenshots of the dev server (`npm run dev`, http://localhost:5173/WTD/, `window.__game` in dev) at a 1280×720 viewport **and** at 1920×1080.

## Review Focus

1. **Placement after the 2× zoom:** the ghost and the placed tower land exactly under the cursor, and the "under the HUD" refusal still triggers at the same spot. GameScene reads `pointer.x/y` (screen pixels), and those double under zoom. Task 3 Step 4 pins this.
2. **Play again / Title → Game restarts:** the projector state and the 2× zoom survive a restart, and the lighting/HUD listeners are not duplicated. Task 1 Step 6 and Task 3 Step 6.
3. **`L` while the Wine Tasting is open, or on the title/end screens:** the toggle still works (window listener, like `M`), and the cellar looks right when the Tasting closes. Task 1 Step 6.
4. **Textures used by particles, the lighting eraser and the texture grid** (`spark`, `drop`, `light-soft`, `T` on the title) keep their on-screen size after supersampling. Task 3 Step 3.
5. **Frame rate at 2560×1440** with the per-frame darkness erase: it must stay at or above 55 fps on the demo laptop. If not, set `HD = 1`, which is the revert switch. Task 3 Step 7.

---

### Task 1: Projector mode on `L`

**Files:**
- Create: `src/fx/projector.js`
- Create: `tests/fx/projector.test.js`
- Modify: `src/main.js` (window keydown listener, next to the `M` one)
- Modify: `src/fx/lighting.js` (`createLighting`)
- Modify: `src/scenes/HUDScene.js` (toast on toggle)
- Modify: `README.md` (Demo keys table)

**Interfaces:**
- Produces:
  - `isProjector(): boolean`
  - `toggleProjector(): boolean` (returns the new state)
  - `onProjectorChange(fn: (on: boolean) => void): () => void` (returns an unsubscribe function)
  - The state persists in `localStorage` key `wcs.projector`, as `'1'` or `'0'`.

- [ ] **Step 1: Write the failing tests** in `tests/fx/projector.test.js`:
  - `defaults to off`: `isProjector() === false` with empty storage.
  - `toggle flips and returns the new state`: `toggleProjector() === true`, then `isProjector() === true`, then `toggleProjector() === false`.
  - `notifies subscribers and stops after unsubscribe`: `const seen = []; const off = onProjectorChange(v => seen.push(v)); toggleProjector(); off(); toggleProjector();` gives `seen` equal to `[true]`.
  - `survives a throwing localStorage`: stub `globalThis.localStorage` with `getItem`/`setItem` that throw; `toggleProjector()` does not throw and returns a boolean.
  - Reset module state between tests with `vi.resetModules()` and a dynamic `import()`.

- [ ] **Step 2: Run** `npx vitest run tests/fx/projector.test.js`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/fx/projector.js`.** Phaser-free. Read the initial state lazily from `localStorage` inside try/catch (no storage means off), and write on toggle inside try/catch.

- [ ] **Step 4: Run** `npm test`. Expected: all pass.

- [ ] **Step 5: Wire it up.**
  - **`src/main.js`:** in the existing window `keydown` listener, `l` (via `e.key.toLowerCase()`, not repeated) calls `toggleProjector()`.
  - **`src/fx/lighting.js`:** add `applyProjector(on)` inside `createLighting`. Call it once at creation with `isProjector()` and subscribe with `onProjectorChange`. Unsubscribe in the existing `shutdown` handler.
    - Darkness: the render texture's alpha goes from `DARK_ALPHA` (0.82) to **0.45**.
    - Vignette: alpha goes from 1 to **0.4**.
    - Glow: glowing light sprites target alpha `GLOW_ALPHA * strength`, with `GLOW_ALPHA` 0.35 → **0.5**. Store the target alpha so new lights pick up the current mode.
    - Tween the change over 250 ms.
  - **`src/scenes/HUDScene.js`:** subscribe with `onProjectorChange` (unsubscribe on shutdown, the same way the HUD removes its other listeners) and call `this.showToast(on ? 'Projector mode on' : 'Projector mode off')`.
  - **`README.md`:** add a Demo keys row: `` `L` | Projector mode: brighter cellar for big screens (remembered) ``.

- [ ] **Step 6: Verify on the dev server.**
  - Start a game and place a tower.
  - Press `L`: the cellar visibly brightens, the toast shows, and the candles still glow. Press `L` again: back to today's look.
  - Press `L` while the Wine Tasting is open (`W`): no error. Close it: the brighter look is right.
  - Go to the End screen, press Play again, and reload the page: the mode is remembered, and the toast appears once per press (not twice).
  - No console errors. Take screenshots of off and on.
  - Optional: only if "on" still looks muddy in the screenshot, also add a brightness/contrast ColorMatrix filter on the Game camera while projector mode is on. Use the `filters-and-postfx` skill for the Phaser 4 API.

- [ ] **Step 7: Commit and push.**
  ```bash
  git add src/fx/projector.js tests/fx/projector.test.js src/main.js src/fx/lighting.js src/scenes/HUDScene.js README.md
  git commit -m "feat: projector mode on L"
  git push
  ```

### Task 2: Thomas stands out

**Files:**
- Modify: `src/objects/Tower.js` (constructor, `refresh`, `drawHp`, `destroy`)
- Modify: `src/scenes/GameScene.js` (`tryPlace`: the tower's light)
- Modify: `src/art/textures.js` (`towerThomas`)

**Interfaces:**
- Consumes: `serif(size, color, extra)` from `src/ui/kit.js`; `this.lighting.addLight(x, y, radius, tint)`.
- Produces: `Tower#baseScale: number` (1, or **1.25** for Thomas). `Tower#nameTag` is a Container, or `undefined` for other towers.

- [ ] **Step 1: Make Thomas bigger.**
  - In the `Tower` constructor, set `this.baseScale = placed.type === 'thomas' ? 1.25 : 1`.
  - The build-in tween goes to `scale: this.baseScale`.
  - The `refresh()` pulse goes to `scale: this.baseScale * 1.2` (yoyo).
  - Check every other `scale:` tween or `setScale` on `this.sprite` that the "Enemies fight back" work added (hit flash, destruction) and make it relative to `baseScale` too.
  - In `drawHp`, raise the bar for Thomas so it clears his head: `top = y - 44 - (this.baseScale - 1) * 60`.

- [ ] **Step 2: Add a real name banner.**
  - In the constructor, Thomas only, add `this.nameTag`: a Container at `(x, y - 70)` (above the HP bar), depth **2610** (above the darkness 2500 and glow 2600, below the vignette 2700).
  - It holds a rounded dark plate (fill `0x120a0d` at alpha 0.85, 1.5 px gold `0xffd36b` stroke, about 92×24) and the text `'THOMAS'` in `serif(15, '#ffd36b')`.
  - Fade it in with the build tween, then bob it gently (`y` ±3 px, 1600 ms, yoyo, repeat −1, `Sine.easeInOut`).
  - Destroy it in `Tower#destroy()`, and in any destroy or tower-destroyed path the "Enemies fight back" work added.

- [ ] **Step 3: Remove the baked 6.5 px name.** In `towerThomas` (`src/art/textures.js`), delete the `fillText('THOMAS', …)` lines and the font/align setup before them. Keep the gold plate as decoration.

- [ ] **Step 4: Give him a gold spotlight.** In `GameScene#tryPlace`, if the placed type is `thomas`, call `this.lighting.addLight(pos.x, pos.y, 130, 0xffd36b)`. Every other tower keeps `addLight(pos.x, pos.y, 90)`.

- [ ] **Step 5: Verify.**
  - Place all four towers, Thomas next to the others. In a 1280×720 screenshot, Thomas is clearly the biggest and brightest, and "THOMAS" is readable.
  - The banner doesn't cover the upgrade panel's click target; clicking Thomas still opens his panel.
  - Upgrade Thomas: the pulse returns to 1.25, not 1.
  - If the tower can be destroyed (the "Enemies fight back" work), press `D` and let pests finish him: the banner goes with him.
  - `npm test` passes, with no console errors.

- [ ] **Step 6: Commit and push.**
  ```bash
  git add src/objects/Tower.js src/scenes/GameScene.js src/art/textures.js
  git commit -m "feat: Thomas stands out on the board"
  git push
  ```

### Task 3: HD rendering (2× canvas + supersampled art)

**Why both halves:** today the canvas is 1280×720 and the browser stretches it to the projector, and every generated texture is drawn at 1×. A 2× canvas alone would just upscale 1× textures. Supersampled textures alone would still be squeezed into 1280×720. Together they make everything sharp.

**Files:**
- Create: `src/ui/hd.js`
- Modify: `src/main.js` (game `width`/`height`)
- Modify: every scene's `create()`: `BootScene`, `TitleScene`, `GameScene`, `HUDScene`, `TastingScene`, `EndScene`
- Modify: `src/scenes/GameScene.js` (`overHud`, `onPointerMove`, `onPointerDown`: `pointer.x/y` → `pointer.worldX/worldY`)
- Modify: `src/art/textures.js` (`make`, `generateTextures`)
- Modify: `src/scenes/GameScene.js` `floatText`, and any `this.add.text` style not built with `serif()`/`body()`: add `resolution: 2`

**Interfaces:**
- Produces:
  - `HD: number` (**2**; setting it to 1 restores today's behaviour and is the revert switch)
  - `hdCamera(scene, zoom = 1, cx = 640, cy = 360): Camera`, which runs `scene.cameras.main.setZoom(HD * zoom).centerOn(cx, cy)` and returns the camera.
  - `SS = HD` in `textures.js`.

- [ ] **Step 1: 2× canvas.**
  - In `src/main.js`, set `width: 1280 * HD, height: 720 * HD`.
  - Call `hdCamera(this)` at the top of each scene's `create()`.
  - TitleScene keeps its framing: `hdCamera(this, ZOOM, 600, 350)` after `setBounds(0, 0, 1280, 720)`.
  - In GameScene's three pointer handlers, use `pointer.worldX/worldY`.
  - Other scenes use interactive objects only, which already account for the camera. Grep for any other `pointer.x` or `pointer.y` and convert it.

- [ ] **Step 2: Supersample generated textures.** Change `make(scene, key, w, h, draw, ss = SS)`:
  - Create the canvas at `w*ss × h*ss`, `ctx.scale(ss, ss)`, draw, then `tex.refresh()`.
  - Map the frame back to its logical size:
    ```js
    const f = tex.get();
    f.setSize(w, h);                       // logical size: width/height, displayWidth, hit areas
    f.setUVs(w * ss, h * ss, 0, 1, 1, 0);  // sample the whole supersampled canvas (v flipped like Frame#updateUVs)
    ```
  - Pass `ss = 1` for `vignette` and `light-soft` (soft gradients; 2× would only cost memory).

- [ ] **Step 3: Spike check before going further.** Open the title, press `T` (texture grid) and take a screenshot.
  - Every texture must show its old logical size in its label (for example `tower-thomas 64x72`), uncropped and not upside down.
  - In game, check `__game.scene.getScene('Game').towers[0].sprite.displayWidth === 64` for a non-Thomas tower, and that spark particles and candle light holes look the same size as before.
  - **If the frame trick crops or flips:** try `setUVs(w * ss, h * ss, 0, 0, 1, 1)`. If neither works within 15 minutes, set `ss = 1` for everything, keep the 2× canvas (text and shapes still get sharper) and log it in `REGRET.md`.

- [ ] **Step 4: Verify placement under zoom.**
  - Select a Cork Cannon and move over the field: the ghost sits exactly under the cursor.
  - Click to place: the tower lands there.
  - Move onto the card strip: the ghost hides (`overHud`).
  - Click a placed tower: its panel opens.
  - Right-click or `Esc` cancels.

- [ ] **Step 5: Sharpen remaining text.**
  - Give `floatText` and any style object not built with `serif()`/`body()` `resolution: 2`.
  - Grep `this.add.text(` across `src/scenes` and `src/objects`.

- [ ] **Step 6: Verify every screen at 1920×1080 and at 1280×720.**
  - Screens: Title, Game (wave running, Taureau Rouge active), upgrade panel, card tooltip, Wine Tasting, End, then Play again.
  - Thomas's card icon and his sprite are sharp at 1920×1080 (zoom-crop screenshots before and after).
  - Letterboxing still works, shake/flash/fade still look right, and there are no console errors.

- [ ] **Step 7: Check performance.** Run wave 7 with Le Monstre Blanc and Taureau Rouge active. `__game.loop.actualFps` must stay at or above 55. If it doesn't, set `HD = 1`, re-verify, and log it in `REGRET.md`.

- [ ] **Step 8: Commit and push.**
  ```bash
  git add src/ui/hd.js src/main.js src/scenes src/art/textures.js REGRET.md
  git commit -m "feat: HD rendering with supersampled art"
  git push
  ```

### Task 4: Live-site check

- [ ] **Step 1:** After the deploy finishes (about 2 minutes, `gh run list --limit 1`), open https://thomasokvs.github.io/WTD/ fullscreen at 1920×1080.
- [ ] **Step 2:** Run the README demo script with projector mode on: Play → `G G G` → place towers including Thomas → `1` → Tasting → `W` → `7` → Taureau Rouge → boss split → End. No console errors.
- [ ] **Step 3:** Update `docs/superpowers/HANDOVER.md` "Where things stand" with one bullet per task, plus anything that was cut. Commit and push.
