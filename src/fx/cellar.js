import Phaser from 'phaser';
import { PATH, CANDLES, BARRELS, GRAND_CRU } from '../config/map.js';
import { createLighting, LIGHT_DEPTH } from './lighting.js';

export const PATH_W = 56;
const EDGE = 0x1f140f;
const AMBIENT_STEP = 170;
const DECOR_DEPTH = -85; // floor -100 < path -90 < decor < build-spot rings -80


// Floor, worn path with a dark soft edge, barrels, candles, the Grand Cru and
// the candle lighting. Shared by the title (backdrop) and the game.
export function drawCellar(scene, { grandCru = true } = {}) {
  scene.add.tileSprite(0, 0, 1280, 720, 'stone-floor').setOrigin(0).setDepth(-100);

  // dark, soft-edged trench under the path (three passes = soft falloff).
  // Plain rectangles: several fillRects in one Graphics filled the whole
  // S-bend interior in Phaser 4, so each band is its own Rectangle.
  for (const [extra, alpha] of [[40, 0.2], [24, 0.4], [10, 0.75]]) {
    const w = PATH_W + extra;
    segments((a, b, len, ang) => {
      const horiz = Math.abs(Math.cos(ang)) > 0.5;
      scene.add
        .rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, horiz ? len + w : w, horiz ? w : len + w, EDGE, alpha)
        .setDepth(-95);
    });
  }

  segments((a, b, len, ang) => {
    scene.add
      .tileSprite((a.x + b.x) / 2, (a.y + b.y) / 2, len + PATH_W, PATH_W, 'path-tile')
      .setRotation(ang)
      .setDepth(-90);
  });

  for (const b of BARRELS) scene.add.image(b.x, b.y, 'barrel').setScale(b.s).setRotation(b.r).setDepth(DECOR_DEPTH);
  // flame of the candle texture sits ~10px from its top: put the flame on the light
  for (const c of CANDLES) scene.add.image(c.x, c.y, 'candle').setOrigin(0.5, 0.22).setDepth(DECOR_DEPTH);

  const lighting = createLighting(scene, { candles: CANDLES });
  // faint ambient along the route so pests read between the light pools
  segments((a, b, len) => {
    const n = Math.max(1, Math.round(len / AMBIENT_STEP));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      lighting.addLight(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 90, 0, { strength: 0.4, glow: false });
    }
  });
  drawEntrance(scene, lighting);
  if (grandCru) {
    scene.add.image(GRAND_CRU.x, GRAND_CRU.y + 10, 'grand-cru').setOrigin(0.5, 0.9).setDepth(GRAND_CRU.y + 10);
    lighting.addLight(GRAND_CRU.x, GRAND_CRU.y - 20, 120, 0xff8a6a);
  }
  return lighting;
}

function segments(fn) {
  for (let i = 1; i < PATH.length; i++) {
    const a = PATH[i - 1], b = PATH[i];
    fn(a, b, Math.hypot(b.x - a.x, b.y - a.y), Math.atan2(b.y - a.y, b.x - a.x));
  }
}

// Where the pests come in: a dark arched doorway on the first path point's
// wall, a faint pulsing red glow and chevrons pointing along the path.
function drawEntrance(scene, lighting) {
  const a = PATH[0], b = PATH[1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const x = Math.max(0, Math.min(1280, a.x)) + Math.cos(ang) * 30;
  const y = Math.max(0, Math.min(720, a.y)) + Math.sin(ang) * 30;
  const door = scene.add.graphics({ x, y }).setRotation(ang).setDepth(DECOR_DEPTH);
  // stone frame, then the black opening (arch faces along the path)
  door.fillStyle(0x8a6e52, 1).fillRoundedRect(-30, -44, 40, 88, { tl: 0, tr: 36, br: 36, bl: 0 });
  door.fillStyle(0x0a0507, 1).fillRoundedRect(-30, -34, 30, 68, { tl: 0, tr: 28, br: 28, bl: 0 });
  door.fillStyle(0x6a1020, 0.8).fillRoundedRect(-30, -24, 20, 48, { tl: 0, tr: 20, br: 20, bl: 0 }); // red glow inside
  door.lineStyle(2, 0x2a1d14, 1).strokeRoundedRect(-30, -44, 40, 88, { tl: 0, tr: 36, br: 36, bl: 0 });
  const glow = scene.add.image(x, y, 'light-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2a40)
    .setDisplaySize(240, 240).setAlpha(0.6).setDepth(LIGHT_DEPTH.glow);
  scene.tweens.add({ targets: glow, alpha: 1, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  lighting.addLight(x + Math.cos(ang) * 30, y + Math.sin(ang) * 30, 130, 0xd01a3a, { strength: 0.9, glow: false });
  for (let i = 0; i < 3; i++) {
    const d = 40 + i * 22;
    const chev = scene.add.graphics({ x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d }).setRotation(ang).setDepth(LIGHT_DEPTH.glow);
    chev.lineStyle(4, 0xe8c07a, 1).beginPath().moveTo(-5, -9).lineTo(4, 0).lineTo(-5, 9).strokePath();
    chev.setAlpha(0.45);
    scene.tweens.add({ targets: chev, alpha: 1, duration: 500, delay: i * 180, yoyo: true, repeat: -1, hold: 200, repeatDelay: 400 });
  }
}
