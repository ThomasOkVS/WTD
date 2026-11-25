// Procedural art: every texture is painted once into a CanvasTexture with the
// 2D context (gradients, soft shadows) so the game ships with zero image files.
// Enemies face RIGHT (angle 0 = moving right). Towers are top-down-ish 3/4 view.
import { PALETTE as P } from '../config/palette.js';
import { HD } from '../ui/hd.js';

export const TEXTURE_KEYS = [
  'stone-floor', 'path-tile', 'barrel', 'candle', 'light-soft', 'vignette', 'grand-cru',
  'enemy-fly', 'enemy-corkscrew', 'enemy-rat', 'enemy-monstre', 'enemy-can', 'nest',
  'tower-sommelier', 'tower-cork', 'tower-decanter', 'tower-thomas',
  'proj-cork', 'proj-wine', 'drop', 'spark', 'taureau-rouge', 'parchment-panel',
];

// Extra colours derived from the palette (darker/lighter steps, glints).
const C = {
  ...P,
  stoneHi: '#4a372c',
  stoneLo: '#2c1f19',
  mortar: '#1a110d',
  pathHi: '#6e4c35',
  pathLo: '#46301f',
  woodHi: '#8a5530',
  wood: '#6b3f22',
  woodLo: '#3d2414',
  iron: '#2a2220',
  ironHi: '#6a5a50',
  glassDark: '#1c0a10',
  clawGreen: '#6dff7a',
  bluePlum: '#1f3f9a',
  flame: '#fff3c4',
};

// Deterministic RNG so stone layout and speckles are identical every load.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Supersampling: textures are drawn SS x larger and their frame is mapped back
// to the logical w x h, so sprites, hit areas and particles keep their size but
// stay sharp on the HD canvas (src/ui/hd.js). 2x art also serves the 1.5x
// canvas; ?hd=1 turns supersampling off too (the full revert).
const SS = HD > 1 ? 2 : 1;

function make(scene, key, w, h, draw, ss = SS) {
  if (scene.textures.exists(key)) return;
  // The frame trick is WebGL-only: the Canvas renderer crops by cutWidth and
  // would draw a quarter-image. A blocklisted GPU falls back to Canvas (AUTO).
  if (scene.sys.game.renderer.type === 1 /* Phaser.CANVAS */) ss = 1;
  const tex = scene.textures.createCanvas(key, w * ss, h * ss);
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(ss, ss);
  draw(ctx, w, h);
  ctx.restore();
  tex.refresh(); // required: uploads the canvas to the GPU
  if (ss === 1) return;
  const f = tex.get();
  f.setSize(w, h); // logical size: width/height, displayWidth, hit areas
  f.setUVs(w * ss, h * ss, 0, 1, 1, 0); // sample the whole canvas (v flipped like Frame#updateUVs)
}

// ---------- helpers ----------
function radial(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function softShadow(ctx, x, y, rx, ry, alpha = 0.55) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, 0, rx, [[0, `rgba(10,5,6,${alpha})`], [0.6, `rgba(10,5,6,${alpha * 0.6})`], [1, 'rgba(10,5,6,0)']]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function glow(ctx, x, y, r, rgb, a = 1) {
  ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, `rgba(${rgb},${a})`], [0.35, `rgba(${rgb},${a * 0.45})`], [1, `rgba(${rgb},0)`]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
// Draw fn at the 9 wrapped offsets so shapes crossing an edge tile seamlessly.
function wrapped(size, x, y, fn) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(x + dx, y + dy);
}
function speckle(ctx, size, n, r, colors, rand) {
  for (let i = 0; i < n; i++) {
    const x = rand() * size, y = rand() * size, rr = r * (0.4 + rand());
    const col = colors[Math.floor(rand() * colors.length)];
    wrapped(size, x, y, (px, py) => ellipse(ctx, px, py, rr, rr * (0.6 + rand() * 0.4), col));
  }
}

// ---------- ground ----------
function stoneFloor(ctx, s) {
  const rand = rng(7);
  ctx.fillStyle = C.mortar;
  ctx.fillRect(0, 0, s, s);
  const rowH = 32, brickW = 64;
  for (let row = 0; row < s / rowH; row++) {
    const off = row % 2 ? brickW / 2 : 0;
    for (let col = -1; col < s / brickW + 1; col++) {
      const x = col * brickW + off, y = row * rowH;
      const shade = rand();
      const base = shade < 0.33 ? C.stone : shade < 0.66 ? C.stoneHi : '#40302a';
      wrapped(s, x, y, (px, py) => {
        if (px > s || py > s || px + brickW < 0 || py + rowH < 0) return;
        rrect(ctx, px + 2, py + 2, brickW - 4, rowH - 4, 5);
        ctx.fillStyle = linear(ctx, px, py, px + brickW * 0.4, py + rowH, [[0, C.stoneHi], [0.35, base], [1, C.stoneLo]]);
        ctx.fill();
        // worn highlight top-left
        ctx.strokeStyle = 'rgba(232,192,122,0.07)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 5, py + rowH - 6);
        ctx.lineTo(px + 5, py + 5);
        ctx.lineTo(px + brickW - 6, py + 5);
        ctx.stroke();
      });
    }
  }
  speckle(ctx, s, 140, 1.2, ['rgba(0,0,0,0.25)', 'rgba(110,80,60,0.25)', 'rgba(20,12,10,0.35)'], rand);
  // a few cracks
  ctx.strokeStyle = 'rgba(15,8,6,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    let x = rand() * s, y = rand() * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rand() - 0.5) * 14;
      y += (rand() - 0.3) * 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function pathTile(ctx, s) {
  const rand = rng(11);
  ctx.fillStyle = C.path;
  ctx.fillRect(0, 0, s, s);
  // soft blotches
  for (let i = 0; i < 10; i++) {
    const x = rand() * s, y = rand() * s, r = 10 + rand() * 14;
    const col = rand() < 0.5 ? '110,76,53' : '60,40,26';
    wrapped(s, x, y, (px, py) => glow(ctx, px, py, r, col, 0.35));
  }
  speckle(ctx, s, 90, 0.9, ['rgba(30,18,12,0.45)', 'rgba(140,100,70,0.35)'], rand);
  // pebbles
  for (let i = 0; i < 6; i++) {
    const x = rand() * s, y = rand() * s, r = 1.6 + rand() * 2;
    wrapped(s, x, y, (px, py) => {
      ellipse(ctx, px + 0.8, py + 1, r, r * 0.75, 'rgba(20,12,8,0.6)');
      ellipse(ctx, px, py, r, r * 0.75, '#7a5a44');
      ellipse(ctx, px - r * 0.3, py - r * 0.3, r * 0.4, r * 0.3, 'rgba(232,192,122,0.35)');
    });
  }
}

// ---------- props ----------
function barrel(ctx, w, h) {
  const cx = w / 2, cy = h / 2 + 1, r = 27;
  softShadow(ctx, cx + 3, cy + 4, 31, 29, 0.7);
  // outer iron hoop
  ellipse(ctx, cx, cy, r, r, C.iron);
  ctx.strokeStyle = C.ironHi;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();
  // lid wood
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = radial(ctx, cx - 6, cy - 6, 2, r, [[0, C.woodHi], [0.6, C.wood], [1, C.woodLo]]);
  ctx.fillRect(0, 0, w, h);
  // planks
  ctx.strokeStyle = 'rgba(30,16,8,0.7)';
  ctx.lineWidth = 1.2;
  for (let x = cx - r; x < cx + r; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  // grain
  const rand = rng(3);
  ctx.strokeStyle = 'rgba(160,100,60,0.18)';
  for (let i = 0; i < 14; i++) {
    const x = cx - r + rand() * r * 2;
    ctx.beginPath();
    ctx.moveTo(x, cy - r);
    ctx.quadraticCurveTo(x + (rand() - 0.5) * 4, cy, x + (rand() - 0.5) * 3, cy + r);
    ctx.stroke();
  }
  ctx.restore();
  // inner hoop ring
  ctx.strokeStyle = '#1e1612';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.stroke();
  // bung
  ellipse(ctx, cx + 8, cy + 6, 3.5, 3.5, '#2b170c');
  ellipse(ctx, cx + 7.4, cy + 5.4, 1.4, 1.4, 'rgba(232,192,122,0.4)');
  // wine stain
  glow(ctx, cx - 9, cy + 9, 7, '138,28,43', 0.55);
}

function candle(ctx, w, h) {
  const cx = w / 2;
  softShadow(ctx, cx + 1, h - 5, 11, 4, 0.6);
  glow(ctx, cx, 12, 16, '255,179,92', 0.55);
  // wax body
  rrect(ctx, cx - 6, 18, 12, h - 24, 3);
  ctx.fillStyle = linear(ctx, cx - 6, 0, cx + 6, 0, [[0, '#cbb894'], [0.35, P.parchment], [1, '#9c8866']]);
  ctx.fill();
  // drips
  ctx.fillStyle = P.parchment;
  rrect(ctx, cx - 6, 18, 3, 9, 1.5);
  ctx.fill();
  rrect(ctx, cx + 2, 18, 3, 6, 1.5);
  ctx.fill();
  ellipse(ctx, cx, 18.5, 6, 2, '#f6ecd6');
  // dish
  ellipse(ctx, cx, h - 6, 10, 3.5, '#5a4636');
  ellipse(ctx, cx, h - 7, 10, 3, P.candleGold);
  ellipse(ctx, cx, h - 7.5, 7, 2, '#8a6a3e');
  // wick + flame
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, 18);
  ctx.lineTo(cx, 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, 2);
  ctx.bezierCurveTo(cx + 5, 8, cx + 4, 15, cx, 16);
  ctx.bezierCurveTo(cx - 4, 15, cx - 5, 8, cx, 2);
  ctx.fillStyle = linear(ctx, 0, 2, 0, 16, [[0, P.amber], [0.5, '#ffd27a'], [1, C.flame]]);
  ctx.fill();
  ellipse(ctx, cx, 12, 1.6, 3, '#ffffff');
}

function lightSoft(ctx, s) {
  const c = s / 2;
  ctx.fillStyle = radial(ctx, c, c, 0, c, [
    [0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.75)'], [0.45, 'rgba(255,255,255,0.35)'],
    [0.7, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, s, s);
}

function vignette(ctx, w, h) {
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  ctx.fillStyle = radial(ctx, 0, 0, 0, 760, [
    [0, 'rgba(18,10,13,0)'], [0.5, 'rgba(18,10,13,0)'], [0.72, 'rgba(18,10,13,0.35)'],
    [0.88, 'rgba(18,10,13,0.75)'], [1, 'rgba(18,10,13,0.95)'],
  ]);
  ctx.fillRect(-w, -w, w * 2, w * 2);
}

// Upright bottle body path (centre x, top y of neck, total height).
function bottlePath(ctx, cx, top, bodyW, neckW, h, shoulder) {
  const bw = bodyW / 2, nw = neckW / 2, bottom = top + h;
  ctx.beginPath();
  ctx.moveTo(cx - nw, top);
  ctx.lineTo(cx + nw, top);
  ctx.lineTo(cx + nw, top + shoulder * 0.45);
  ctx.bezierCurveTo(cx + nw, top + shoulder * 0.8, cx + bw, top + shoulder * 0.75, cx + bw, top + shoulder);
  ctx.lineTo(cx + bw, bottom - 4);
  ctx.quadraticCurveTo(cx + bw, bottom, cx + bw - 4, bottom);
  ctx.lineTo(cx - bw + 4, bottom);
  ctx.quadraticCurveTo(cx - bw, bottom, cx - bw, bottom - 4);
  ctx.lineTo(cx - bw, top + shoulder);
  ctx.bezierCurveTo(cx - bw, top + shoulder * 0.75, cx - nw, top + shoulder * 0.8, cx - nw, top + shoulder * 0.45);
  ctx.closePath();
}

function grandCru(ctx, w, h) {
  const cx = w / 2;
  softShadow(ctx, cx + 2, h - 5, 20, 5, 0.7);
  glow(ctx, cx, h * 0.6, 30, '208,26,58', 0.25);
  bottlePath(ctx, cx, 6, 30, 10, h - 10, 34);
  ctx.fillStyle = linear(ctx, cx - 15, 0, cx + 15, 0, [[0, '#3d0d18'], [0.3, '#6a1424'], [0.55, '#2a0910'], [1, '#14060a']]);
  ctx.fill();
  ctx.strokeStyle = '#0c0406';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // gold foil capsule
  rrect(ctx, cx - 5.5, 4, 11, 18, 2);
  ctx.fillStyle = linear(ctx, cx - 6, 0, cx + 6, 0, [[0, '#8a6a3e'], [0.4, '#ffe1a0'], [1, '#7a5a2e']]);
  ctx.fill();
  ctx.fillStyle = '#5a4022';
  ctx.fillRect(cx - 5.5, 19, 11, 1.5);
  // label
  rrect(ctx, cx - 13, 52, 26, 28, 2);
  ctx.fillStyle = linear(ctx, cx - 13, 0, cx + 13, 0, [[0, '#cbb894'], [0.4, P.parchment], [1, '#b8a47e']]);
  ctx.fill();
  ctx.strokeStyle = P.burgundy;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 11, 54, 22, 24);
  // crest: little grape cluster + lines
  ctx.fillStyle = P.burgundy;
  for (const [dx, dy] of [[-3, 0], [0, 0], [3, 0], [-1.5, 2.6], [1.5, 2.6], [0, 5.2]]) ellipse(ctx, cx + dx, 59 + dy, 1.7, 1.7, P.burgundy);
  ctx.fillStyle = P.ink;
  ctx.fillRect(cx - 8, 69, 16, 1.5);
  ctx.fillRect(cx - 6, 73, 12, 1);
  // gold neck band
  ctx.fillStyle = P.candleGold;
  ctx.fillRect(cx - 13, 47, 26, 2);
  // glass highlight
  ctx.strokeStyle = 'rgba(255,230,190,0.55)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 9, 46);
  ctx.lineTo(cx - 9, h - 14);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,190,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + 10, 48);
  ctx.lineTo(cx + 10, h - 18);
  ctx.stroke();
}

// ---------- enemies (face right) ----------
function enemyFly(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  softShadow(ctx, cx + 2, cy + 4, 9, 5, 0.5);
  // wings (translucent, swept back)
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(cx - 1, cy);
    ctx.rotate(s * 0.55 + Math.PI);
    ellipse(ctx, 7, 0, 8, 4, 'rgba(200,190,170,0.35)');
    ctx.strokeStyle = 'rgba(232,220,192,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }
  // abdomen + thorax + head
  ellipse(ctx, cx - 5, cy, 6, 4.5, '#1a1012');
  ctx.strokeStyle = 'rgba(90,60,40,0.6)';
  ctx.lineWidth = 0.8;
  for (const x of [-7, -4]) {
    ctx.beginPath();
    ctx.moveTo(cx + x, cy - 4);
    ctx.lineTo(cx + x, cy + 4);
    ctx.stroke();
  }
  ellipse(ctx, cx + 2, cy, 4, 3.6, '#24161a');
  ellipse(ctx, cx + 7, cy, 3.2, 3.4, '#1a1012');
  // red glinting eyes
  ellipse(ctx, cx + 8, cy - 2, 1.8, 1.6, P.wineRed);
  ellipse(ctx, cx + 8, cy + 2, 1.8, 1.6, P.wineRed);
  ellipse(ctx, cx + 8.5, cy - 2.4, 0.6, 0.6, '#ffd0d0');
  ellipse(ctx, cx + 2, cy - 1.5, 1.5, 0.8, 'rgba(232,192,122,0.35)');
}

function enemyCorkscrew(ctx, w, h) {
  const cy = h / 2;
  softShadow(ctx, w / 2 + 2, cy + 5, 17, 7, 0.5);
  // T-handle at the back (left), worn dark wood
  rrect(ctx, 3, cy - 13, 8, 26, 4);
  ctx.fillStyle = linear(ctx, 3, 0, 11, 0, [[0, '#1c120e'], [0.5, '#3a2418'], [1, '#140c0a']]);
  ctx.fill();
  ctx.fillStyle = '#2a201c';
  ctx.fillRect(10, cy - 2.5, 6, 5);
  // helix (back strands darker, front strands lighter)
  const x0 = 15, x1 = w - 3, turns = 3.5;
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const amp = 7 * (1 - t * 0.75);
    const a = t * turns * Math.PI * 2;
    pts.push([x0 + (x1 - x0) * t, cy + Math.sin(a) * amp, Math.cos(a)]);
  }
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    for (let i = 1; i < pts.length; i++) {
      const front = pts[i][2] > 0;
      if ((pass === 1) !== front) continue;
      ctx.strokeStyle = front ? '#4a3e3a' : '#1a1416';
      ctx.lineWidth = front ? 3 : 2.5;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      if (front) {
        ctx.strokeStyle = 'rgba(232,192,122,0.35)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }
  // amber glint on the tip
  glow(ctx, x1 - 1, cy, 5, '255,179,92', 0.9);
  ellipse(ctx, x1 - 1, cy, 1.2, 1.2, C.flame);
}

function enemyRat(ctx, w, h) {
  const cx = w / 2 - 2, cy = h / 2;
  softShadow(ctx, cx + 3, cy + 4, 15, 8, 0.55);
  // tail curling back-left
  ctx.strokeStyle = '#2e1e1c';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.bezierCurveTo(cx - 18, cy + 2, cx - 16, cy + 11, cx - 21, cy + 10);
  ctx.stroke();
  // feet
  for (const [dx, dy] of [[-5, -7], [-5, 7], [6, -6], [6, 6]]) ellipse(ctx, cx + dx, cy + dy, 2.4, 1.6, '#3a2624');
  // body teardrop pointing right
  ctx.beginPath();
  ctx.moveTo(cx + 16, cy);
  ctx.bezierCurveTo(cx + 10, cy - 6, cx + 2, cy - 9, cx - 6, cy - 8);
  ctx.bezierCurveTo(cx - 13, cy - 7, cx - 13, cy + 7, cx - 6, cy + 8);
  ctx.bezierCurveTo(cx + 2, cy + 9, cx + 10, cy + 6, cx + 16, cy);
  ctx.fillStyle = radial(ctx, cx - 2, cy - 3, 1, 14, [[0, '#3e2a26'], [0.7, '#22161a'], [1, '#150d10']]);
  ctx.fill();
  // ears
  ellipse(ctx, cx + 6, cy - 6, 3, 2.6, '#3a2624');
  ellipse(ctx, cx + 6, cy + 6, 3, 2.6, '#3a2624');
  ellipse(ctx, cx + 6, cy - 6, 1.6, 1.3, '#6a3a3a');
  ellipse(ctx, cx + 6, cy + 6, 1.6, 1.3, '#6a3a3a');
  // nose + whiskers + glowing eye
  ellipse(ctx, cx + 16, cy, 1.4, 1.4, '#8a4a4a');
  ctx.strokeStyle = 'rgba(232,220,192,0.35)';
  ctx.lineWidth = 0.6;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + 14, cy + s);
    ctx.lineTo(cx + 19, cy + s * 4);
    ctx.stroke();
  }
  glow(ctx, cx + 11, cy - 2.5, 4, '255,179,92', 0.8);
  ellipse(ctx, cx + 11, cy - 2.5, 1.2, 1.2, P.amber);
  glow(ctx, cx + 11, cy + 2.5, 4, '255,179,92', 0.8);
  ellipse(ctx, cx + 11, cy + 2.5, 1.2, 1.2, P.amber);
  ctx.strokeStyle = 'rgba(232,192,122,0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 5);
  ctx.quadraticCurveTo(cx, cy - 8, cx + 8, cy - 4);
  ctx.stroke();
}

function clawMarks(ctx, x, y, len, spread, width) {
  ctx.save();
  ctx.lineCap = 'round';
  // Three parallel diagonal gashes, tapered at both ends.
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * spread;
    const sx = x + ox - len * 0.3, sy = y - len * 0.5;
    const ex = x + ox + len * 0.3, ey = y + len * 0.5;
    const nx = (ey - sy) / len * width * 0.5, ny = -(ex - sx) / len * width * 0.5;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx + nx * 2, my + ny * 2, ex, ey);
    ctx.quadraticCurveTo(mx - nx * 2, my - ny * 2, sx, sy);
    ctx.closePath();
    ctx.shadowColor = C.clawGreen;
    ctx.shadowBlur = width * 3;
    ctx.fillStyle = '#2fd14a';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d8ffd8';
    ctx.lineWidth = width * 0.3;
    ctx.stroke();
  }
  ctx.restore();
}

// Big white bottle lying along x, neck pointing right.
function enemyMonstre(ctx, w, h) {
  const cy = h / 2;
  softShadow(ctx, w / 2 + 4, cy + 8, 46, 18, 0.7);
  glow(ctx, w / 2 - 6, cy, 34, '109,255,122', 0.18);
  const left = 6, right = w - 4, bw = 19, nw = 6, shoulderX = right - 32;
  ctx.beginPath();
  ctx.moveTo(right, cy - nw);
  ctx.lineTo(shoulderX + 14, cy - nw);
  ctx.bezierCurveTo(shoulderX + 6, cy - nw, shoulderX + 6, cy - bw, shoulderX - 4, cy - bw);
  ctx.lineTo(left + 4, cy - bw);
  ctx.quadraticCurveTo(left, cy - bw, left, cy - bw + 4);
  ctx.lineTo(left, cy + bw - 4);
  ctx.quadraticCurveTo(left, cy + bw, left + 4, cy + bw);
  ctx.lineTo(shoulderX - 4, cy + bw);
  ctx.bezierCurveTo(shoulderX + 6, cy + bw, shoulderX + 6, cy + nw, shoulderX + 14, cy + nw);
  ctx.lineTo(right, cy + nw);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, cy - bw, 0, cy + bw, [[0, '#ffffff'], [0.3, '#f4f1ea'], [0.75, '#c9c6bf'], [1, '#8f8c88']]);
  ctx.fill();
  ctx.strokeStyle = '#4a4a48';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // dark cap on neck tip
  rrect(ctx, right - 9, cy - nw - 1.5, 9, nw * 2 + 3, 2);
  ctx.fillStyle = linear(ctx, 0, cy - nw, 0, cy + nw, [[0, '#3a3a3a'], [0.5, '#1a1a1a'], [1, '#0a0a0a']]);
  ctx.fill();
  // green claw marks across the body
  clawMarks(ctx, left + 30, cy, 26, 8.5, 3.2);
  // menacing green glints near the shoulder (eyes)
  glow(ctx, shoulderX + 2, cy - 8, 6, '109,255,122', 0.9);
  glow(ctx, shoulderX + 2, cy + 8, 6, '109,255,122', 0.9);
  ellipse(ctx, shoulderX + 2, cy - 8, 1.5, 1.5, '#eaffea');
  ellipse(ctx, shoulderX + 2, cy + 8, 1.5, 1.5, '#eaffea');
  // highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(left + 6, cy - bw + 5);
  ctx.lineTo(shoulderX - 6, cy - bw + 5);
  ctx.stroke();
}

// Small white "Le Monstre Blanc can" lying along x, top pointing right.
function enemyCan(ctx, w, h) {
  const cy = h / 2, left = 4, right = w - 4, r = h / 2 - 3;
  softShadow(ctx, w / 2 + 2, cy + 4, 18, 8, 0.6);
  rrect(ctx, left, cy - r, right - left, r * 2, 3);
  ctx.fillStyle = linear(ctx, 0, cy - r, 0, cy + r, [[0, '#ffffff'], [0.35, '#eeebe4'], [1, '#8f8c88']]);
  ctx.fill();
  ctx.strokeStyle = '#4a4a48';
  ctx.lineWidth = 1;
  ctx.stroke();
  // metal rims
  for (const x of [left + 1, right - 4]) {
    rrect(ctx, x, cy - r, 3, r * 2, 1);
    ctx.fillStyle = linear(ctx, 0, cy - r, 0, cy + r, [[0, '#d8d8d8'], [1, '#6a6a6a']]);
    ctx.fill();
  }
  clawMarks(ctx, w / 2 - 1, cy, 14, 4.5, 1.8);
  glow(ctx, right - 6, cy, 5, '109,255,122', 0.7);
}

// ---------- towers ----------
function pedestal(ctx, cx, cy, rx, ry, rim = P.candleGold) {
  softShadow(ctx, cx + 2, cy + 4, rx + 4, ry + 3, 0.7);
  ellipse(ctx, cx, cy + 3, rx, ry, '#1f1512');
  ellipse(ctx, cx, cy, rx, ry, linear(ctx, 0, cy - ry, 0, cy + ry, [[0, '#5a463a'], [1, '#2c201b']]));
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 1, ry - 1, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function wineGlass(ctx, x, y, s, wine = P.wineRed) {
  // bowl
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y);
  ctx.quadraticCurveTo(x - 4.5 * s, y + 6 * s, x, y + 6.5 * s);
  ctx.quadraticCurveTo(x + 4.5 * s, y + 6 * s, x + 4 * s, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(230,235,240,0.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 4.1 * s, y + 2.5 * s);
  ctx.quadraticCurveTo(x - 4.2 * s, y + 6 * s, x, y + 6.4 * s);
  ctx.quadraticCurveTo(x + 4.2 * s, y + 6 * s, x + 4.1 * s, y + 2.5 * s);
  ctx.closePath();
  ctx.fillStyle = wine;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y);
  ctx.quadraticCurveTo(x - 4.5 * s, y + 6 * s, x, y + 6.5 * s);
  ctx.quadraticCurveTo(x + 4.5 * s, y + 6 * s, x + 4 * s, y);
  ctx.stroke();
  // stem + foot
  ctx.beginPath();
  ctx.moveTo(x, y + 6.5 * s);
  ctx.lineTo(x, y + 11 * s);
  ctx.moveTo(x - 2.5 * s, y + 11 * s);
  ctx.lineTo(x + 2.5 * s, y + 11 * s);
  ctx.stroke();
}

// Chibi sommelier, 3/4 front view, standing on a pedestal.
function sommelier(ctx, w, h, opts) {
  const cx = w / 2, base = h - 12;
  pedestal(ctx, cx, base, 24, 9, opts.rim);
  if (opts.halo) glow(ctx, cx, base - 20, 30, '255,179,92', 0.35);
  // legs
  ctx.fillStyle = '#1a1214';
  ctx.fillRect(cx - 6, base - 12, 5, 12);
  ctx.fillRect(cx + 1, base - 12, 5, 12);
  // torso: white shirt + dark vest
  rrect(ctx, cx - 10, base - 34, 20, 24, 6);
  ctx.fillStyle = '#efe6d4';
  ctx.fill();
  rrect(ctx, cx - 10, base - 34, 20, 24, 6);
  ctx.fillStyle = opts.vest;
  ctx.fill();
  ctx.fillStyle = '#efe6d4';
  ctx.beginPath();
  ctx.moveTo(cx - 4, base - 34);
  ctx.lineTo(cx + 4, base - 34);
  ctx.lineTo(cx, base - 26);
  ctx.closePath();
  ctx.fill();
  // bow tie
  ctx.fillStyle = opts.tie;
  ctx.beginPath();
  ctx.moveTo(cx, base - 32);
  ctx.lineTo(cx - 3.5, base - 34);
  ctx.lineTo(cx - 3.5, base - 30);
  ctx.closePath();
  ctx.moveTo(cx, base - 32);
  ctx.lineTo(cx + 3.5, base - 34);
  ctx.lineTo(cx + 3.5, base - 30);
  ctx.closePath();
  ctx.fill();
  // apron (long, burgundy/ink)
  ctx.beginPath();
  ctx.moveTo(cx - 9, base - 22);
  ctx.lineTo(cx + 9, base - 22);
  ctx.lineTo(cx + 10, base - 3);
  ctx.lineTo(cx - 10, base - 3);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, cx - 10, 0, cx + 10, 0, [[0, opts.apronLo], [0.4, opts.apron], [1, opts.apronLo]]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,192,122,0.5)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // tastevin on a chain (gold)
  if (opts.tastevin) {
    ctx.strokeStyle = P.candleGold;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 5, base - 33);
    ctx.quadraticCurveTo(cx, base - 22, cx + 5, base - 33);
    ctx.stroke();
    ellipse(ctx, cx, base - 25, 2.8, 2.8, P.candleGold);
    ellipse(ctx, cx - 0.6, base - 25.6, 1, 1, '#fff3c4');
  }
  // arms: left down, right raised with glass
  ctx.strokeStyle = opts.vest;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 10, base - 30);
  ctx.lineTo(cx - 13, base - 18);
  ctx.moveTo(cx + 10, base - 30);
  ctx.lineTo(cx + 15, base - 33);
  ctx.stroke();
  ellipse(ctx, cx - 13, base - 17, 2.4, 2.4, '#d9a882');
  ellipse(ctx, cx + 16, base - 34, 2.4, 2.4, '#d9a882');
  wineGlass(ctx, cx + 16, base - 47, 1.1);
  // head
  ellipse(ctx, cx, base - 41, 8, 8.5, '#d9a882');
  ctx.fillStyle = opts.hair;
  ctx.beginPath();
  ctx.ellipse(cx, base - 44, 8.5, 6.5, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ellipse(ctx, cx - 2.8, base - 40, 1, 1.2, '#2a1610');
  ellipse(ctx, cx + 2.8, base - 40, 1, 1.2, '#2a1610');
  if (opts.moustache) {
    ctx.strokeStyle = opts.hair;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 4, base - 36);
    ctx.quadraticCurveTo(cx, base - 38, cx + 4, base - 36);
    ctx.stroke();
  }
  ellipse(ctx, cx - 3.5, base - 44.5, 2.5, 1.4, 'rgba(255,230,190,0.35)');
}

function towerSommelier(ctx, w, h) {
  sommelier(ctx, w, h, {
    rim: P.candleGold, vest: '#1e1416', tie: P.wineRed, apron: '#2a1c1a', apronLo: '#150d0e', hair: '#2a1a12',
  });
}

function towerThomas(ctx, w, h) {
  sommelier(ctx, w, h, {
    rim: P.amber, vest: '#2a1216', tie: P.candleGold, apron: P.burgundy, apronLo: '#4a0d18', hair: '#5a3a22',
    tastevin: true, moustache: true, halo: true,
  });
  // gold name plate on the pedestal front
  const cx = w / 2, y = h - 8;
  rrect(ctx, cx - 17, y - 4, 34, 9, 2);
  ctx.fillStyle = linear(ctx, 0, y - 4, 0, y + 5, [[0, '#ffe1a0'], [0.5, P.candleGold], [1, '#8a6a3e']]);
  ctx.fill();
  ctx.strokeStyle = '#5a4022';
  ctx.lineWidth = 0.8;
  ctx.stroke(); // plain gold plate: his name is a real text banner on the board (Tower#nameTag)
}

function towerCork(ctx, w, h) {
  const cx = w / 2, base = h - 14;
  pedestal(ctx, cx, base, 24, 10);
  // wooden cradle
  rrect(ctx, cx - 16, base - 10, 32, 10, 3);
  ctx.fillStyle = linear(ctx, 0, base - 10, 0, base, [[0, C.woodHi], [1, C.woodLo]]);
  ctx.fill();
  // champagne bottle cannon tilted up-right
  ctx.save();
  ctx.translate(cx - 2, base - 12);
  ctx.rotate(-0.75);
  const L = 34;
  ctx.beginPath();
  ctx.moveTo(-10, -8);
  ctx.lineTo(8, -8);
  ctx.bezierCurveTo(14, -8, 14, -4, 20, -4);
  ctx.lineTo(L, -4);
  ctx.lineTo(L, 4);
  ctx.lineTo(20, 4);
  ctx.bezierCurveTo(14, 4, 14, 8, 8, 8);
  ctx.lineTo(-10, 8);
  ctx.quadraticCurveTo(-13, 0, -10, -8);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, -8, 0, 8, [[0, '#3c5a3a'], [0.3, '#24402a'], [1, '#0e1a10']]);
  ctx.fill();
  ctx.strokeStyle = '#0a120b';
  ctx.lineWidth = 1;
  ctx.stroke();
  // gold foil neck
  ctx.fillStyle = linear(ctx, 0, -4, 0, 4, [[0, '#ffe1a0'], [1, '#8a6a3e']]);
  ctx.fillRect(18, -4.5, L - 18, 9);
  // cork poking out
  rrect(ctx, L - 1, -4, 7, 8, 2);
  ctx.fillStyle = linear(ctx, 0, -4, 0, 4, [[0, '#e3b97c'], [1, '#9a7040']]);
  ctx.fill();
  // wire cage
  ctx.strokeStyle = '#d8d2c4';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(L - 3, -4.5);
  ctx.lineTo(L + 3, 0);
  ctx.lineTo(L - 3, 4.5);
  ctx.stroke();
  // highlight
  ctx.strokeStyle = 'rgba(220,255,220,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-8, -5);
  ctx.lineTo(8, -5);
  ctx.stroke();
  ctx.restore();
  // small burgundy label wrap
  glow(ctx, cx + 22, base - 40, 8, '255,179,92', 0.5);
}

function towerDecanter(ctx, w, h) {
  const cx = w / 2, base = h - 12;
  pedestal(ctx, cx, base, 24, 9);
  glow(ctx, cx, base - 14, 26, '208,26,58', 0.35);
  // bulb
  const by = base - 14;
  ctx.beginPath();
  ctx.moveTo(cx - 3.5, base - 44);
  ctx.lineTo(cx - 3.5, base - 30);
  ctx.bezierCurveTo(cx - 6, base - 28, cx - 20, base - 20, cx - 19, by);
  ctx.quadraticCurveTo(cx - 18, base - 3, cx, base - 3);
  ctx.quadraticCurveTo(cx + 18, base - 3, cx + 19, by);
  ctx.bezierCurveTo(cx + 20, base - 20, cx + 6, base - 28, cx + 3.5, base - 30);
  ctx.lineTo(cx + 3.5, base - 44);
  ctx.closePath();
  ctx.fillStyle = 'rgba(210,225,235,0.22)';
  ctx.fill();
  // wine inside
  ctx.save();
  ctx.clip();
  ctx.fillStyle = linear(ctx, cx - 19, 0, cx + 19, 0, [[0, '#4a0a16'], [0.35, P.wineRed], [0.7, P.burgundy], [1, '#3a0610']]);
  ctx.fillRect(cx - 22, base - 20, 44, 20);
  ellipse(ctx, cx, base - 20, 17.5, 2.5, '#e0324c');
  ctx.restore();
  ctx.strokeStyle = 'rgba(240,245,250,0.75)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // rim + stopper
  ellipse(ctx, cx, base - 44, 5, 1.8, 'rgba(240,245,250,0.6)');
  ellipse(ctx, cx, base - 47, 3.5, 3.5, linear(ctx, cx - 3, 0, cx + 3, 0, [[0, '#8a6a3e'], [0.5, '#ffe1a0'], [1, '#8a6a3e']]));
  // highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, by, 14, Math.PI * 1.05, Math.PI * 1.35);
  ctx.stroke();
}

// ---------- projectiles & particles ----------
function projCork(ctx, w, h) {
  const cy = h / 2;
  rrect(ctx, 1, cy - 4, w - 2, 8, 2.5);
  ctx.fillStyle = linear(ctx, 0, cy - 4, 0, cy + 4, [[0, '#f0c98c'], [0.5, '#c8955a'], [1, '#7a5430']]);
  ctx.fill();
  ellipse(ctx, w - 2.5, cy, 1.6, 3.6, '#a87a48');
  for (const [x, y] of [[3, cy - 1], [6, cy + 1.5], [8, cy - 2]]) ellipse(ctx, x, y, 0.7, 0.7, '#6a4a2a');
}

function projWine(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  glow(ctx, cx, cy, 6, '208,26,58', 0.6);
  ctx.beginPath();
  ctx.moveTo(w - 1, cy);
  ctx.bezierCurveTo(cx, cy - 4.5, 1, cy - 4, 1.5, cy);
  ctx.bezierCurveTo(1, cy + 4, cx, cy + 4.5, w - 1, cy);
  ctx.fillStyle = radial(ctx, cx - 1, cy - 1, 0, 6, [[0, '#ff5a72'], [0.5, P.wineRed], [1, P.burgundy]]);
  ctx.fill();
  ellipse(ctx, cx - 1.5, cy - 1.5, 1.5, 0.9, 'rgba(255,255,255,0.8)');
}

function drop(ctx, w, h) {
  const cx = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, 1);
  ctx.bezierCurveTo(cx + 2, 6, w - 1, 8, w - 1, 11);
  ctx.arc(cx, 11, w / 2 - 1, 0, Math.PI);
  ctx.bezierCurveTo(1, 8, cx - 2, 6, cx, 1);
  ctx.fillStyle = radial(ctx, cx - 1, 10, 0, 7, [[0, '#ff5a72'], [0.5, P.wineRed], [1, P.burgundy]]);
  ctx.fill();
  ellipse(ctx, cx - 1.5, 10, 1.2, 1.8, 'rgba(255,255,255,0.75)');
}

function spark(ctx, w, h) {
  const c = w / 2;
  glow(ctx, c, c, c, '255,179,92', 0.9);
  ctx.fillStyle = '#fff6dc';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 1.6 : c - 1;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, c, c, 1.8, 1.8, '#ffffff');
}

// ---------- power-up: Taureau Rouge Grand Cru (parody, no text/logos) ----------
function taureauRouge(ctx, w, h) {
  const cx = w / 2, top = 18, bot = h - 6, bw = 13;
  softShadow(ctx, cx + 2, bot, 16, 4, 0.6);
  glow(ctx, cx, h * 0.55, 26, '208,26,58', 0.3);
  // can-shaped slim bottle body, clip and paint halves
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 5, top);
  ctx.lineTo(cx + 5, top);
  ctx.quadraticCurveTo(cx + bw, top + 6, cx + bw, top + 16);
  ctx.lineTo(cx + bw, bot - 3);
  ctx.quadraticCurveTo(cx + bw, bot, cx + bw - 3, bot);
  ctx.lineTo(cx - bw + 3, bot);
  ctx.quadraticCurveTo(cx - bw, bot, cx - bw, bot - 3);
  ctx.lineTo(cx - bw, top + 16);
  ctx.quadraticCurveTo(cx - bw, top + 6, cx - 5, top);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = linear(ctx, cx - bw, 0, cx, 0, [[0, '#0f2160'], [0.5, C.bluePlum], [1, '#2c55c8']]);
  ctx.fillRect(cx - bw, top, bw, bot - top);
  ctx.fillStyle = linear(ctx, cx, 0, cx + bw, 0, [[0, '#ff3355'], [0.5, P.wineRed], [1, '#6a0c1c']]);
  ctx.fillRect(cx, top, bw, bot - top);
  // silver bands
  ctx.fillStyle = 'rgba(220,220,230,0.85)';
  ctx.fillRect(cx - bw, top + 18, bw * 2, 2);
  ctx.fillRect(cx - bw, bot - 9, bw * 2, 2);
  // gold bull-head silhouette (horns) on the seam
  ctx.fillStyle = P.candleGold;
  const hy = top + 38;
  ctx.beginPath();
  ctx.moveTo(cx - 10, hy - 10);
  ctx.quadraticCurveTo(cx - 9, hy - 1, cx - 3, hy - 1);
  ctx.lineTo(cx - 4, hy + 6);
  ctx.quadraticCurveTo(cx, hy + 11, cx + 4, hy + 6);
  ctx.lineTo(cx + 3, hy - 1);
  ctx.quadraticCurveTo(cx + 9, hy - 1, cx + 10, hy - 10);
  ctx.quadraticCurveTo(cx + 7, hy - 4, cx + 2, hy - 4);
  ctx.lineTo(cx - 2, hy - 4);
  ctx.quadraticCurveTo(cx - 7, hy - 4, cx - 10, hy - 10);
  ctx.closePath();
  ctx.fill();
  // glass highlight
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(cx - bw + 2.5, top + 14, 2.5, bot - top - 20);
  ctx.restore();
  ctx.strokeStyle = '#0c0608';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  // neck + gold cap with horns on top
  rrect(ctx, cx - 4, top - 6, 8, 8, 1.5);
  ctx.fillStyle = linear(ctx, cx - 4, 0, cx + 4, 0, [[0, '#8a6a3e'], [0.45, '#ffe1a0'], [1, '#7a5a2e']]);
  ctx.fill();
  ctx.strokeStyle = P.candleGold;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 3, top - 5);
  ctx.quadraticCurveTo(cx - 13, top - 6, cx - 12, top - 15);
  ctx.moveTo(cx + 3, top - 5);
  ctx.quadraticCurveTo(cx + 13, top - 6, cx + 12, top - 15);
  ctx.stroke();
  ellipse(ctx, cx - 12, top - 15, 1.2, 1.2, '#fff3c4');
  ellipse(ctx, cx + 12, top - 15, 1.2, 1.2, '#fff3c4');
}

// ---------- UI ----------
function parchmentPanel(ctx, w, h) {
  const rand = rng(21);
  rrect(ctx, 2, 2, w - 4, h - 4, 10);
  ctx.fillStyle = radial(ctx, w / 2, h / 2, 10, w * 0.6, [[0, '#f3e8cf'], [0.6, P.parchment], [1, '#c9b58e']]);
  ctx.fill();
  // aged blotches
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 18; i++) glow(ctx, rand() * w, rand() * h, 6 + rand() * 18, '160,120,70', 0.12);
  // scorched edge
  ctx.strokeStyle = 'rgba(90,50,20,0.45)';
  ctx.lineWidth = 6;
  rrect(ctx, 2, 2, w - 4, h - 4, 10);
  ctx.stroke();
  ctx.restore();
  // double border like a wine label
  ctx.strokeStyle = P.burgundy;
  ctx.lineWidth = 2;
  rrect(ctx, 8, 8, w - 16, h - 16, 6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(58,26,18,0.6)';
  ctx.lineWidth = 0.8;
  rrect(ctx, 12, 12, w - 24, h - 24, 4);
  ctx.stroke();
  // corner ornaments (inside 16 px margin, nine-slice safe)
  for (const [x, y] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = P.burgundy;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.fillStyle = P.candleGold;
    ctx.fillRect(-1.5, -1.5, 3, 3);
    ctx.restore();
  }
}

// Pest nest: a rubble mound around a black burrow, red eyes peering out.
function nest(ctx, w, h) {
  const cx = w / 2, base = h - 8;
  ellipse(ctx, cx, base + 2, 28, 7, 'rgba(0,0,0,0.45)'); // ground shadow
  // rubble stones
  const stones = [[-18, -4, 10, 7, '#5a4a44'], [17, -5, 11, 8, '#4e403b'], [-8, -11, 9, 7, '#6a5850'], [9, -12, 8, 6, '#5e4c45'], [0, -2, 13, 6, '#463833']];
  for (const [dx, dy, rx, ry, col] of stones) {
    ellipse(ctx, cx + dx, base + dy, rx, ry, col);
    ctx.strokeStyle = 'rgba(20,10,12,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx + dx, base + dy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ellipse(ctx, cx + dx - rx * 0.3, base + dy - ry * 0.4, rx * 0.35, ry * 0.25, 'rgba(255,220,190,0.18)');
  }
  // burrow hole
  ellipse(ctx, cx, base - 9, 11, 7, '#0a0406');
  ellipse(ctx, cx, base - 10, 9, 5, '#000000');
  // wine-red cracks
  ctx.strokeStyle = '#8a1c2b';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx - 24, base - 2); ctx.lineTo(cx - 16, base - 6); ctx.lineTo(cx - 12, base - 3);
  ctx.moveTo(cx + 22, base - 1); ctx.lineTo(cx + 15, base - 7); ctx.lineTo(cx + 18, base - 11);
  ctx.stroke();
  // glowing eyes in the burrow and between the stones
  for (const [ex, ey, r] of [[-3.5, -10, 1.6], [3.5, -10, 1.6], [-16, -12, 1.2], [-13, -12, 1.2]]) {
    ellipse(ctx, cx + ex, base + ey, r * 2.2, r * 2.2, 'rgba(255,58,74,0.35)');
    ellipse(ctx, cx + ex, base + ey, r, r, '#ff3a4a');
  }
}

export function generateTextures(scene) {
  make(scene, 'stone-floor', 128, 128, (c, w) => stoneFloor(c, w), 1); // ss 1: TileSprite repeats source pixels
  make(scene, 'path-tile', 64, 64, (c, w) => pathTile(c, w), 1); // ss 1: TileSprite
  make(scene, 'barrel', 64, 64, barrel);
  make(scene, 'candle', 32, 48, candle);
  make(scene, 'light-soft', 256, 256, (c, w) => lightSoft(c, w), 1); // soft gradient: 2x only costs memory
  make(scene, 'vignette', 1280, 720, vignette, 1);
  make(scene, 'grand-cru', 64, 96, grandCru);
  make(scene, 'enemy-fly', 32, 32, enemyFly);
  make(scene, 'enemy-corkscrew', 40, 32, enemyCorkscrew);
  make(scene, 'enemy-rat', 44, 32, enemyRat);
  make(scene, 'enemy-monstre', 96, 48, enemyMonstre);
  make(scene, 'enemy-can', 40, 24, enemyCan);
  make(scene, 'nest', 64, 48, nest);
  make(scene, 'tower-sommelier', 64, 64, towerSommelier);
  make(scene, 'tower-cork', 64, 64, towerCork);
  make(scene, 'tower-decanter', 64, 64, towerDecanter);
  make(scene, 'tower-thomas', 64, 72, towerThomas);
  make(scene, 'proj-cork', 12, 12, projCork);
  make(scene, 'proj-wine', 12, 12, projWine);
  make(scene, 'drop', 10, 16, drop);
  make(scene, 'spark', 16, 16, spark);
  make(scene, 'taureau-rouge', 40, 96, taureauRouge);
  make(scene, 'parchment-panel', 256, 128, parchmentPanel, 1); // ss 1: NineSlice slices are in source pixels
}
