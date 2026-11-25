# Performance plan: why the cellar lags and how to fix it (2026-11-25)

Goal: smooth on the demo laptop, looks unchanged unless a fix is clearly worth it. Freeze 15:15.
Do NOT start with anything below the "quick wins" unless there is time. Verify each fix with `?hd=...` and a before/after of the bench in "How to measure".

## 1. Measured numbers (honest caveats first)

Environment: the Claude desktop app's built-in browser on this dev PC (ANGLE / Intel UHD 630 iGPU, i.e. a typical laptop GPU, D3D11). The pane was hidden, so `requestAnimationFrame` ran at about 0.5 Hz and `loop.actualFps` was meaningless (it reported 45 to 60 on the title). Instead I called `game.step()` by hand and timed each frame, with a `gl.readPixels` to force the GPU to finish. **Treat absolute ms as pessimistic (hidden-pane overhead); trust the ratios.** Claude in Chrome was not connected, so there is no real-window fps. Check `__game.loop.actualFps` yourself in a visible tab; the numbers below tell you what to expect to move.

Median ms per frame (cpu = JS plus GL submit; total = including GPU finish). 16.7 ms = 60 fps.

| Scenario | HD 1.5 (default, 1920x1080) | HD 1 (`?hd=1`, 1280x720) |
|---|---|---|
| Idle cellar, 0 towers | cpu 22, **total 62 to 67** | cpu 15, **total 34** |
| Idle, 6 towers | total 46 | cpu 16.6, total 36 |
| Wave 5, 6 towers, 7 to 9 pests | total 59 to 71 (p90 140 to 210) | cpu 19, total 38 |
| Wave 7 and power-up (R) | total 46 to 65 | not measured |
| Endless at 2x | not measured (see the notes) | not measured |

Takeaways:

1. **The cost is GPU fill / fixed per-frame cost, not game logic.** `GameScene.update` itself costs about 0.02 ms with an empty field. The same frame costs about 62 ms at 1920x1080 and about 34 ms at 1280x720. That is roughly 1.8x, in line with the 2.25x pixel count. The idle cellar with nothing to do is already above 16.7 ms.
2. **Even at HD 1 a frame is around 35 ms in this setup, and cpu alone is 15 ms at idle.** With every game object hidden the HD 1.5 frame was still 47 ms, so there is a large fixed cost per frame that is not the sprites: the full-screen passes (darkness RT fill and erase, vignette, ADD-blended glow images, 1700x1500 power washes) and the 6 `TileSprite`s plus 15 `Rectangle`s that fill the screen. Hidden-pane compositing inflates this; the share is uncertain.
3. Lighting: `lighting.update()` costs about 4 ms per frame (fill + erase + `rt.render()` with 1 to 2 erasers per light), synchronous. Hiding the RT alone changed little (67 to 65 ms), so the darkness RT is NOT the main cost; it is the screen-sized work in general.
4. Object counts are small: about 53 world children idle, 76 to 87 in wave 5, HUD 15, tweens 0 to 4, particles 36 to 53 alive (capped per emitter, so not a hotspot), textures 48 totalling only 2.2 Mpx. **Texture memory, tweens, particles and `floatText` are not the problem.**
5. Not measured: Endless at 2x and the Le Monstre Blanc plus Taureau Rouge case (my `jumpToWave(7)` spawned nothing within the window). By code reading they scale with pest count, see fix 6.

Ruled out: update-loop allocation (`[...this.enemies]`, `filter`) is negligible at 10 pests; particles are capped (`maxAliveParticles` 80 to 150); `floatText` and tweens are tiny.

## 2. Ranked fixes (gain per minute of work)

### A. Quick, reversible (do these first)

- [ ] **A1. Lower the default HD from 1.5 to 1.** `src/ui/hd.js`, `DEFAULT_HD = 1` (one constant). Expected gain: about 1.8x less GPU time (idle 62 to 34 ms here). Risk: softer text and sprites on the 1920x1080 projector (looks change, which is the one trade-off). 1 minute. **Do this if the demo laptop is an iGPU laptop; it is the single biggest lever.** Middle ground: `DEFAULT_HD = 1.25` (about 1.4x gain). Pick by testing visually on the projector; keep `?hd=1.5` as the nice-looking override for a strong GPU.
- [ ] **A2. Use `Phaser.WEBGL` with `powerPreference` and make sure the browser uses the discrete GPU.** `src/main.js` config: add `render: { powerPreference: 'high-performance', antialias: false, roundPixels: false }` (these are Phaser 4 `render` config keys: check `.claude/skills/game-setup-and-config`). On Windows hybrid-GPU laptops also set Chrome to "High performance" in Windows Graphics settings (0 minutes of code, possibly a 2 to 3x gain on a dGPU laptop). Risk: low.
- [ ] **A3. Check hardware acceleration on the demo laptop.** `chrome://gpu` must say "WebGL: Hardware accelerated". The recent commit "1x textures on the Canvas renderer" suggests a Canvas fallback has been seen: on Canvas, the full-screen RenderTexture and ADD blends are very slow. Run `__game.renderer.type` (2 = WebGL, 1 = Canvas) in the console. If it is 1, fix the browser setting first; no code change helps as much.
- [ ] **A4. Run the demo in a fullscreen browser at 1920x1080 with nothing else open (close DevTools, other tabs, the Claude app).** DevTools open alone can halve fps. 0 minutes.

### B. Small code changes (5 to 15 minutes each)

- [ ] **B1. Lighting: skip work when nothing changed and cheapen the flicker.** `src/fx/lighting.js` `update(time)`: run the fill and erase every 2nd frame (`if ((frame++ & 1) === 0)`), or drop the `core` second eraser (`addLight` with `glow`), halving erase draws. Flicker at 30 Hz is invisible. Expected gain about 2 ms per frame (of the 4 ms). Risk: low; light positions of moving pests lag 1 frame, so keep the pest lights updating every frame if any visible jitter appears.
- [ ] **B2. Give pests a cheaper light.** `src/objects/Enemy.js:41`: each pest adds a light (erase hole). Add the light only for `this.boss` or when `lighting.lightCount < 12`, or drop the dim ambient light for small pests. Expected: fewer erases per frame in big waves and in Endless (counts grow +20 percent per wave). Risk: pests in the dark look slightly dimmer.
- [ ] **B3. Merge the per-enemy HP-bar `Graphics` into one shared `Graphics`.** `src/objects/Enemy.js` `drawBar()` and `Tower.js:59` `hpBar`: every pest owns its own `Graphics` that is cleared and redrawn, and each Graphics object breaks the sprite batch (extra draw call per pest). Replace with one `Graphics` in `GameScene`, cleared once per frame and redrawn for visible bars only. Expected: fewer draw calls; matters at 20 or more pests (Endless). Risk: depth ordering of bars (they use `y + 0.5` depth); a single graphics at a high fixed depth is fine.
- [ ] **B4. Cap Endless pest count.** `src/logic/waves.js` `waveAt()`: `count: Math.min(Math.round(...), 30)` (or cap `k` at 8). Protects the demo from an Endless spike. Expected: bounds the worst case. Risk: balance change in a long Endless run only. Add a Vitest case (logic stays tested).

### C. Larger / only if time (not recommended before the freeze)

- [ ] **C1. Replace the darkness `RenderTexture` with a pre-baked static darkness plus additive light sprites** (no per-frame fill/erase). Big rewrite of `lighting.js`; looks change. Skip.
- [ ] **C2. Pool the `floatText`, `spark` bursts.** Measured as negligible. Skip.
- [ ] **C3. `enemyAttacks`: avoid per-frame `towers.filter().map()`.** Negligible at current counts (0.02 ms `update`). Skip.
- [ ] **C4. Reduce full-screen overdraw:** the 1700x1500 Taureau Rouge `powerRed` / `powerBlue` ADD images (`GameScene.createPowerFx`) and the 6 `TileSprite`s. Shrink the washes to 1100x800 if the power-up moment stutters. Risk: slight look change.

## 3. Safe in 15 minutes (if time runs out, do exactly this)

1. [ ] A3: verify WebGL is hardware accelerated on the demo laptop (`__game.renderer.type === 2`, `chrome://gpu`). A4: close DevTools and other apps.
2. [ ] A1: set `DEFAULT_HD = 1` in `src/ui/hd.js` (or 1.25 if it looks too soft on the projector). Run `npm test`, reload, eyeball the title, cellar and the End screen.
3. [ ] B4: cap Endless counts in `waveAt()` (plus a Vitest assertion).
4. [ ] Commit to `main` and push (project rule: no branches). Log the HD change in `REGRET.md` if the softer look is a downgrade.

Do not touch lighting or the update loop in this window: they are not where the time goes.

## 4. How to measure (for whoever executes the fixes)

In a **visible** tab (real rAF), dev server `http://localhost:5173/WTD/` (add `?hd=1` for the old canvas):

```js
const g = __game; setInterval(() => console.log(g.loop.actualFps.toFixed(0)), 1000);
```

Set up the load: press `G` three times, build about 6 towers, press `5` (wave 5). For wave 7 press `7`, then `R`. For Endless use the victory dialog (Keep pouring), then `F` for 2x. Want a steady 55+ in wave 5 and no dips under 40 in Endless at 2x. If the pane is hidden or the window is in the background, rAF throttles: measure only in a foreground tab.

Scripted per-frame cost (works even in a hidden pane): call `__game.step(now, 16.7)` in a loop and time it with a `gl.readPixels(0,0,1,1,...)` after each step to force GPU completion; that is what produced the table above.
