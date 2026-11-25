# Attract mode on the title screen

Goal: a small scripted battle plays behind the title card so the game looks alive while the audience walks in.

## Approach

Self-contained `src/fx/attract.js`, `startAttract(scene, { ui, lighting })`. No GameScene logic, no state, no Grapes, no lives.

- 4 towers placed beside the path, outside the title card: Decanter (top-left by the entrance), Sommelier (left bend), Thomas with his gold name tag (bottom-left), Cork Cannon (right, by the Grand Cru).
- A pool of 12 pest sprites (fly / corkscrew / rat in a fixed sequence) walks `createPath(PATH)`. One `update` handler moves them and ticks the tower timers. Pests that reach the end fade out.
- Cork Cannon: pooled cork sprites tweened to the target, `corkPop`. Decanter: `wineRing` + area damage. Sommelier: red beam + slow tint. Thomas: gold link, pest turns gold and walks back, then poofs. Taureau Rouge wash pulses every ~18 s.
- Deterministic: fixed spawn sequence, fixed HP, fixed timers. Only particle scatter is random.
- Cameras: the title has a zoomed main camera and an unzoomed UI camera, and it makes the main camera ignore anything added after `create`. `attract.js` owns every object it creates by resetting `cameraFilter` to "UI camera ignores it", so it draws in the zoomed world under the card.
- Lighting: reuse the lighting `drawCellar` returns; one light per tower (Thomas gold). No per-pest lights.
- Cleanup: one `shutdown` listener removes the update handler, kills tweens, destroys pools and lights. `ATTRACT_ENABLED` constant is the kill switch.

## Steps

1. Build `attract.js` (no hook yet). Commit.
2. After the UI session's title commit lands (or 15:15), hook `startAttract` into `TitleScene.create`. Commit, push.
3. Verify: `npm test`, title screenshot, Play → Game clean (150 Grapes, wave 0), pause → title and End → title restart attract, `T` grid, FPS vs a running wave.
4. Hard stop 15:35: if not solid, set `ATTRACT_ENABLED = false`, push, log in `REGRET.md`.
