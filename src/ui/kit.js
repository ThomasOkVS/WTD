import Phaser from 'phaser';
import { PALETTE, COLORS } from '../config/palette.js';

// Shared wine-label UI pieces: parchment panels, serif type, buttons with a
// candle glow on hover. Used by the HUD, Title and End scenes.

export const INK = PALETTE.ink;
const RES = 2; // crisp text when FIT scales the canvas up

export function serif(size, color = INK, extra = {}) {
  return { fontFamily: 'Cinzel, serif', fontStyle: '700', fontSize: `${size}px`, color, resolution: RES, ...extra };
}

export function body(size, color = INK, extra = {}) {
  return { fontFamily: '"Cormorant Garamond", serif', fontStyle: '700', fontSize: `${size}px`, color, resolution: RES, ...extra };
}

// Shrink a text object until it fits maxW (long tower names on small cards).
export function fitText(text, maxW) {
  if (text.width > maxW) text.setScale(maxW / text.width);
  return text;
}

// Parchment wine-label panel, stretched without distorting its double border.
export function panel(scene, x, y, w, h) {
  return scene.add.nineslice(x, y, 'parchment-panel', null, w, h, 22, 22, 22, 22);
}

// Small grape cluster drawn in code (canvas emoji render inconsistently).
export function grapeIcon(scene, x, y, s = 1) {
  const g = scene.add.graphics({ x, y });
  g.lineStyle(2 * s, 0x5a3d2b, 1).lineBetween(0, -11 * s, 3 * s, -16 * s);
  g.fillStyle(0x4f7a3a, 1).fillEllipse(6 * s, -13 * s, 9 * s, 5 * s);
  const berries = [[-5, -6], [0, -7], [5, -6], [-3, -1], [3, -1], [0, 4], [-6, -1], [6, -1]];
  for (const [bx, by] of berries) {
    g.fillStyle(0x4a1030, 1).fillCircle(bx * s, by * s, 4 * s);
    g.fillStyle(0x8a2a5a, 1).fillCircle(bx * s - 1 * s, by * s - 1 * s, 2.4 * s);
  }
  return g;
}

// Burgundy button with gold rules and parchment Cinzel label. Hover: lift,
// candle glow; press: dip. Returns a container with setEnabled(bool).
export function button(scene, x, y, w, h, label, onClick, { size = 24 } = {}) {
  const c = scene.add.container(x, y);
  const glow = scene.add.image(0, 0, 'light-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.amber)
    .setDisplaySize(w * 1.7, h * 3).setAlpha(0);
  const bg = scene.add.graphics();
  const draw = (hover) => {
    bg.clear();
    bg.fillStyle(0x120a0d, 0.55).fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, 8); // drop shadow
    bg.fillStyle(hover ? 0xa02436 : COLORS.burgundy, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.fillStyle(0xffffff, 0.07).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h / 2 - 3, 6);
    bg.lineStyle(2, COLORS.candleGold, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(1, COLORS.candleGold, 0.45).strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 5);
  };
  draw(false);
  const text = scene.add.text(0, 1, label, serif(size, PALETTE.parchment)).setOrigin(0.5);
  text.setShadow(0, 2, '#120a0d', 4, false, true);
  const hit = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  c.add([glow, bg, text, hit]);
  c.enabled = true;
  c.label = text;
  c.baseY = y;
  hit.on('pointerover', () => {
    if (!c.enabled) return;
    draw(true);
    scene.tweens.add({ targets: glow, alpha: 0.55, duration: 180 });
    scene.tweens.add({ targets: c, y: c.baseY - 3, scale: 1.04, duration: 150, ease: 'Sine.easeOut' });
  });
  hit.on('pointerout', () => {
    draw(false);
    scene.tweens.add({ targets: glow, alpha: 0, duration: 200 });
    scene.tweens.add({ targets: c, y: c.baseY, scale: 1, duration: 150, ease: 'Sine.easeOut' });
  });
  hit.on('pointerdown', () => {
    if (!c.enabled) return;
    scene.tweens.add({ targets: c, scale: 0.96, duration: 70, yoyo: true });
    onClick();
  });
  c.setEnabled = (on) => {
    c.enabled = on;
    hit.input.cursor = on ? 'pointer' : 'default';
    scene.tweens.add({ targets: c, alpha: on ? 1 : 0.45, duration: 200 });
    if (!on) {
      draw(false);
      scene.tweens.add({ targets: glow, alpha: 0, duration: 150 });
    }
    return c;
  };
  return c;
}

// Fade + slide an object in from (dx, dy). Nothing pops.
export function enter(scene, target, { dx = 0, dy = 0, delay = 0, duration = 260, alpha = 1 } = {}) {
  const tx = target.x, ty = target.y;
  target.setAlpha(0).setPosition(tx + dx, ty + dy);
  scene.tweens.add({ targets: target, x: tx, y: ty, alpha, delay, duration, ease: 'Cubic.easeOut' });
  return target;
}

// Horizontal shake around baseX; safe against rapid repeats.
export function shake(scene, target, baseX = target.baseX ?? target.x) {
  target.baseX = baseX;
  scene.tweens.killTweensOf(target);
  target.x = baseX;
  scene.tweens.add({
    targets: target, x: baseX + 7, duration: 45, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
    onComplete: () => (target.x = baseX),
  });
}
