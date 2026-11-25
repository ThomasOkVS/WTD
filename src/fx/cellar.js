import { PATH, CANDLES, GRAND_CRU } from '../config/map.js';
import { createLighting } from './lighting.js';

export const PATH_W = 56;
const EDGE = 0x1f140f;
const AMBIENT_STEP = 170;
const DECOR_DEPTH = -85; // floor -100 < path -90 < decor < build-spot rings -80

// Barrels dotted around the edges, clear of the path and the build spots.
const BARRELS = [
  { x: 46, y: 52, s: 0.9, r: 0.3 },
  { x: 102, y: 70, s: 0.7, r: 1.2 },
  { x: 380, y: 62, s: 0.8, r: 2.1 },
  { x: 830, y: 58, s: 0.85, r: 0.8 },
  { x: 1222, y: 60, s: 0.95, r: 2.6 },
  { x: 1230, y: 340, s: 0.85, r: 1.7 },
  { x: 40, y: 330, s: 0.85, r: 0.5 },
  { x: 460, y: 585, s: 0.8, r: 2.9 },
  { x: 1230, y: 585, s: 0.9, r: 1.1 },
  { x: 790, y: 590, s: 0.75, r: 0.2 },
];

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
