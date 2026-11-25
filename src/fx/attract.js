import Phaser from 'phaser';
import { PATH } from '../config/map.js';
import { createPath } from '../logic/path.js';
import { serif } from '../ui/kit.js';
import { corkPop, wineRing, splash, shatter } from './particles.js';

// Attract mode: a small scripted battle behind the title card. Purely
// cosmetic and self-contained: no game state, no Grapes, no lives, nothing
// that can end. Deterministic (fixed spawn order, HP and timers); only the
// particle scatter is random. Everything is pooled up front, one update
// handler drives it and one shutdown listener tears it all down.
export const ATTRACT_ENABLED = true;

const MAX_PESTS = 12;
const MAX_CORKS = 6;
const SPAWN_MS = 1500;
const SEQUENCE = ['fly', 'rat', 'corkscrew', 'fly', 'fly', 'corkscrew', 'rat', 'fly', 'corkscrew', 'fly'];
const PESTS = {
  fly: { hp: 2, speed: 95 },
  corkscrew: { hp: 3, speed: 75 },
  rat: { hp: 4, speed: 62 },
};
// Beside the path, clear of the title card (screen centre) and the Play button.
const TOWERS = [
  { type: 'decanter', x: 170, y: 214, every: 2600, range: 110, light: 90 },
  { type: 'sommelier', x: 146, y: 392, every: 900, range: 150, light: 90 },
  { type: 'thomas', x: 330, y: 566, every: 5200, range: 190, light: 130, tint: 0xffd36b },
  { type: 'cork', x: 1122, y: 384, every: 650, range: 190, light: 90 },
];
const WASH_EVERY = 17000;
const SLOW = 0.45;
const SLOW_TINT = 0xc9a0ff;
const GOLD = 0xffd36b;
const PEST_SCALE = 1.15; // a touch bigger than in game: reads from the back of the room

// startAttract(scene, { ui, lighting }) -> { stop }
// ui: the title's unzoomed UI camera (attract objects are hidden from it, so
// they draw only in the zoomed, drifting world camera). lighting: what
// drawCellar returned (one light per tower). Stops itself on shutdown.
export function startAttract(scene, { ui, lighting } = {}) {
  if (!ATTRACT_ENABLED) return { stop() {} };
  // The title makes its world camera ignore anything added after create;
  // own() overrides that: visible to every camera except the UI one.
  const own = (go) => {
    go.cameraFilter = ui ? ui.id : 0;
    return go;
  };
  const path = createPath(PATH);
  const objects = [];
  const keep = (go) => (objects.push(own(go)), go);
  const lights = [];

  // Particle emitters in particles.js are created lazily: create them now
  // (off-screen) so they can be owned like everything else.
  const before = new Set(scene.children.list);
  corkPop(scene, -500, -500);
  wineRing(scene, -500, -500, 10);
  splash(scene, -500, -500);
  shatter(scene, -500, -500);
  for (const go of scene.children.list) if (!before.has(go)) own(go);

  // ---- towers ----
  const towers = TOWERS.map((t, i) => {
    const scale = t.type === 'thomas' ? 1.25 : 1;
    const sprite = keep(scene.add.image(t.x, t.y + 20, `tower-${t.type}`).setOrigin(0.5, 0.85).setDepth(t.y + 20).setScale(scale));
    const light = lighting?.addLight(t.x, t.y, t.light, t.tint ?? 0xffb35c);
    if (light) {
      lights.push(light);
      if (light.sprite) own(light.sprite);
    }
    let tag = null;
    if (t.type === 'thomas') {
      const plate = scene.add.graphics();
      plate.fillStyle(0x120a0d, 0.85).fillRoundedRect(-46, -12, 92, 24, 8)
        .lineStyle(1.5, GOLD, 1).strokeRoundedRect(-46, -12, 92, 24, 8);
      const label = scene.add.text(0, 1, 'THOMAS', serif(15, '#ffd36b')).setOrigin(0.5);
      tag = keep(scene.add.container(t.x, t.y - 76, [plate, label]).setDepth(2610));
      own(plate);
      own(label);
      scene.tweens.add({ targets: tag, y: { from: t.y - 79, to: t.y - 73 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    return { ...t, sprite, scale, tag, next: 1200 + i * 450 };
  });

  // ---- pools ----
  const pests = [];
  for (let i = 0; i < MAX_PESTS; i++) {
    const sprite = keep(scene.add.image(-100, -100, 'enemy-fly').setVisible(false));
    pests.push({ sprite, state: 'free', gen: 0 });
  }
  const corks = [];
  for (let i = 0; i < MAX_CORKS; i++) {
    corks.push(keep(scene.add.image(-100, -100, 'proj-cork').setVisible(false).setDepth(2100)));
  }
  // beams (Sommelier red, Thomas gold) sit above the darkness so they read
  const beams = [keep(scene.add.graphics().setDepth(2560)), keep(scene.add.graphics().setDepth(2560))];
  const washRed = keep(scene.add.image(120, 360, 'light-soft').setDisplaySize(1700, 1500).setTint(0xd01a3a)
    .setDepth(2650).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD));
  const washBlue = keep(scene.add.image(1160, 360, 'light-soft').setDisplaySize(1700, 1500).setTint(0x2a5cff)
    .setDepth(2650).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD));

  let clock = 0;
  let spawnIn = 300;
  let seq = 0;
  let washIn = 6000;

  function spawn() {
    const p = pests.find((q) => q.state === 'free');
    if (!p) return;
    const type = SEQUENCE[seq++ % SEQUENCE.length];
    Object.assign(p, { state: 'walk', type, hp: PESTS[type].hp, speed: PESTS[type].speed, d: 0, dir: 1, slowUntil: 0, recruitLeft: 0 });
    p.gen++;
    scene.tweens.killTweensOf(p.sprite);
    p.sprite.setTexture(`enemy-${type}`).setVisible(true).setAlpha(0).setScale(PEST_SCALE).clearTint();
    scene.tweens.add({ targets: p.sprite, alpha: 1, duration: 200 });
    // small dim halo, as in game (one erase each, no glow sprite)
    p.light = lighting?.addLight(0, 0, 60, 0, { strength: 0.9, glow: false }) ?? null;
    place(p);
  }

  function place(p) {
    const pos = path.positionAt(p.d);
    p.x = pos.x;
    p.y = pos.y;
    p.sprite.setPosition(pos.x, pos.y).setRotation(p.dir > 0 ? pos.angle : pos.angle + Math.PI).setDepth(pos.y);
    if (p.light) {
      p.light.x = pos.x;
      p.light.y = pos.y;
    }
  }

  function release(p, fade = true) {
    p.state = 'dying';
    if (p.light) lighting.removeLight(p.light);
    p.light = null;
    scene.tweens.killTweensOf(p.sprite);
    if (!fade) {
      p.state = 'free';
      p.sprite.setVisible(false);
      return;
    }
    scene.tweens.add({
      targets: p.sprite, alpha: 0, scale: 0.4, duration: 220,
      onComplete: () => {
        p.state = 'free';
        p.sprite.setVisible(false);
      },
    });
  }

  function hit(p, dmg) {
    if (p.state !== 'walk') return;
    p.hp -= dmg;
    p.sprite.setTintMode(Phaser.TintModes.FILL).setTint(0xffffff);
    scene.time.delayedCall(70, () => {
      if (p.state === 'walk') tintFor(p);
    });
    if (p.hp <= 0) {
      splash(scene, p.x, p.y);
      release(p);
    }
  }

  function tintFor(p) {
    p.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
    if (p.state === 'recruit') p.sprite.setTint(GOLD);
    else if (p.slowUntil > clock) p.sprite.setTint(SLOW_TINT);
    else p.sprite.clearTint();
  }

  function beam(g, color, x0, y0, x1, y1) {
    scene.tweens.killTweensOf(g);
    g.clear().setAlpha(1).lineStyle(3, color, 0.9).lineBetween(x0, y0, x1, y1);
    scene.tweens.add({ targets: g, alpha: 0, duration: 420 });
  }

  // furthest-along walking pest in range (what the game's towers prefer)
  function target(t) {
    let best = null;
    for (const p of pests) {
      if (p.state !== 'walk') continue;
      if (Math.hypot(p.x - t.x, p.y - t.y) > t.range) continue;
      if (!best || p.d > best.d) best = p;
    }
    return best;
  }

  function recoil(t) {
    scene.tweens.add({ targets: t.sprite, scaleY: t.scale * 0.9, duration: 70, yoyo: true });
  }

  function fire(t) {
    const p = target(t);
    if (!p) return false;
    if (t.type === 'cork') {
      const c = corks.find((k) => !k.visible);
      if (!c) return false;
      const gen = p.gen;
      corkPop(scene, t.x, t.y - 22);
      recoil(t);
      c.setPosition(t.x, t.y - 22).setVisible(true);
      scene.tweens.add({
        targets: c, x: p.x, y: p.y, angle: 540, duration: 200,
        onComplete: () => {
          c.setVisible(false);
          if (p.gen === gen) hit(p, 1);
        },
      });
    } else if (t.type === 'decanter') {
      wineRing(scene, t.x, t.y, t.range);
      recoil(t);
      for (const q of pests) {
        if (q.state === 'walk' && Math.hypot(q.x - t.x, q.y - t.y) <= t.range) hit(q, 2);
      }
    } else if (t.type === 'sommelier') {
      beam(beams[0], 0x8a1c2b, t.x, t.y - 10, p.x, p.y);
      p.slowUntil = clock + 1600;
      tintFor(p);
      hit(p, 1);
    } else if (t.type === 'thomas') {
      beam(beams[1], GOLD, t.x, t.y - 20, p.x, p.y);
      p.state = 'recruit';
      p.dir = -1;
      p.recruitLeft = 2600;
      tintFor(p);
      scene.tweens.add({ targets: p.sprite, scale: PEST_SCALE * 1.25, duration: 160, yoyo: true, ease: 'Sine.easeOut' });
    }
    return true;
  }

  function pulseWash() {
    scene.tweens.killTweensOf([washRed, washBlue]);
    scene.tweens.add({ targets: washRed, alpha: { from: 0.32, to: 0 }, duration: 400, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => washRed.setAlpha(0) });
    scene.tweens.add({ targets: washBlue, alpha: { from: 0, to: 0.32 }, duration: 400, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => washBlue.setAlpha(0) });
  }

  function update(_time, delta) {
    const dt = Math.min(delta, 100); // a hidden tab must not teleport pests
    clock += dt;

    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawnIn += SPAWN_MS;
      spawn();
    }

    for (const p of pests) {
      if (p.state === 'walk') {
        if (p.slowUntil && p.slowUntil <= clock) {
          p.slowUntil = 0;
          tintFor(p);
        }
        p.d += (p.speed * (p.slowUntil ? 1 - SLOW : 1) * dt) / 1000;
        if (p.d >= path.length) {
          release(p); // no lives: it just slips into the dark
          continue;
        }
        place(p);
      } else if (p.state === 'recruit') {
        p.d -= (p.speed * 1.3 * dt) / 1000;
        p.recruitLeft -= dt;
        place(p);
        // smashes every pest it walks through
        for (const q of pests) {
          if (q.state === 'walk' && Math.hypot(q.x - p.x, q.y - p.y) < 22) {
            corkPop(scene, q.x, q.y);
            hit(q, 99);
          }
        }
        if (p.recruitLeft <= 0 || p.d <= 0) {
          shatter(scene, p.x, p.y);
          release(p);
        }
      }
    }

    for (const t of towers) {
      t.next -= dt;
      if (t.next > 0) continue;
      // nothing in range: look again soon instead of waiting a full cycle
      t.next = fire(t) ? t.every : 250;
    }

    washIn -= dt;
    if (washIn <= 0) {
      washIn += WASH_EVERY;
      pulseWash();
    }
  }

  scene.events.on('update', update);
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    scene.events.off('update', update);
    scene.events.off('shutdown', stop);
    for (const go of objects) scene.tweens.killTweensOf(go);
    for (const l of lights) lighting.removeLight(l);
    for (const p of pests) if (p.light) lighting.removeLight(p.light);
    for (const go of objects) go.destroy();
    objects.length = 0;
  }
  scene.events.once('shutdown', stop);
  return { stop };
}
