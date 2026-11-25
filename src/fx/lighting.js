import Phaser from 'phaser';
import { isProjector, onProjectorChange } from './projector.js';

// Candle lighting: a full-screen darkness RenderTexture with soft holes erased
// at every light, an additive amber glow on top and the vignette above that.
// Depth order: world (< 2500) < darkness < glow < vignette < UI (>= 3000).
export const LIGHT_DEPTH = { darkness: 2500, glow: 2600, vignette: 2700 };

const DARKNESS = 0x120a0d;
const AMBER = 0xffb35c;
// Projector mode (L) lifts the darkness and vignette and strengthens the glow.
const MODES = {
  off: { dark: 0.82, vignette: 1, glow: 0.35 },
  on: { dark: 0.45, vignette: 0.4, glow: 0.4 }, // glow 0.5 washed out clustered towers
};
const FLICKER = 0.06;
const TEX = 256; // light-soft texture size; radius r => scale r / 128

// createLighting(scene, { candles }) -> { addLight, removeLight, update }
// candles: [{x, y, radius}] get a light each (the sprites are drawn by the caller).
// addLight(x, y, radius, tint, { strength, glow }): strength < 1 and glow: false
// give a dim ambient light (used along the path). Move a light by setting
// light.x / light.y. Updates itself every frame.
export function createLighting(scene, { candles = [] } = {}) {
  let mode = MODES[isProjector() ? 'on' : 'off'];
  const rt = scene.add.renderTexture(0, 0, 1280, 720).setOrigin(0).setDepth(LIGHT_DEPTH.darkness).setAlpha(mode.dark);
  const vignette = scene.add.image(0, 0, 'vignette').setOrigin(0).setDepth(LIGHT_DEPTH.vignette).setAlpha(mode.vignette);
  const lights = [];
  let erasers = [];

  function addLight(x, y, radius, tint = AMBER, { strength = 1, glow = true } = {}) {
    // Each light owns its eraser image: erase() stores references, so one
    // shared image moved between calls would render every hole in one place.
    // Glowing lights get two holes (wide soft falloff + tighter bright core);
    // dim ambient lights get one, to keep the per-frame erase list short.
    const eraser = scene.make.image({ key: 'light-soft', add: false }).setPosition(x, y).setAlpha(strength);
    const core = glow ? scene.make.image({ key: 'light-soft', add: false }).setPosition(x, y).setAlpha(strength) : null;
    const sprite = glow
      ? scene.add.image(x, y, 'light-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0).setDepth(LIGHT_DEPTH.glow)
      : null;
    const light = { x, y, radius, eraser, core, sprite, seed: Math.random() * Math.PI * 2, rate: 0.002 + Math.random() * 0.003 };
    light.strength = strength;
    if (sprite) scene.tweens.add({ targets: sprite, alpha: mode.glow * strength, duration: 300 });
    lights.push(light);
    erasers = lights.flatMap((l) => (l.core ? [l.eraser, l.core] : [l.eraser]));
    return light;
  }

  function removeLight(light) {
    const i = lights.indexOf(light);
    if (i < 0) return;
    lights.splice(i, 1);
    erasers = lights.flatMap((l) => (l.core ? [l.eraser, l.core] : [l.eraser]));
    light.eraser.destroy();
    light.core?.destroy();
    light.sprite?.destroy();
  }

  function update(time) {
    for (const l of lights) {
      // two detuned sines: organic flicker, amplitude stays within +-FLICKER
      const f = 1 + FLICKER * (0.7 * Math.sin(time * l.rate + l.seed) + 0.3 * Math.sin(time * l.rate * 3.7 + l.seed * 2));
      const s = (l.radius / (TEX / 2)) * f;
      l.eraser.setPosition(l.x, l.y).setScale(s * 1.7);
      l.core?.setPosition(l.x, l.y).setScale(s);
      l.sprite?.setPosition(l.x, l.y).setScale(s * 1.2);
    }
    rt.fill(DARKNESS, 1);
    if (erasers.length) rt.erase(erasers);
    rt.render();
  }

  for (const c of candles) addLight(c.x, c.y, c.radius);

  // Tween to the current projector mode; new lights read `mode` when added.
  function applyProjector(on) {
    mode = MODES[on ? 'on' : 'off'];
    scene.tweens.killTweensOf([rt, vignette]);
    scene.tweens.add({ targets: rt, alpha: mode.dark, duration: 250 });
    scene.tweens.add({ targets: vignette, alpha: mode.vignette, duration: 250 });
    for (const l of lights) {
      if (!l.sprite) continue;
      scene.tweens.killTweensOf(l.sprite);
      scene.tweens.add({ targets: l.sprite, alpha: mode.glow * l.strength, duration: 250 });
    }
  }
  const offProjector = onProjectorChange(applyProjector);

  const onUpdate = (time) => update(time);
  scene.events.on('update', onUpdate);
  scene.events.once('shutdown', () => {
    scene.events.off('update', onUpdate);
    offProjector();
    for (const l of [...lights]) removeLight(l);
    rt.destroy();
    vignette.destroy();
  });

  update(0);
  return { addLight, removeLight, update };
}
