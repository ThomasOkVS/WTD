import { BUILD_SPOTS } from '../config/map.js';
import { pickTarget } from '../logic/combat.js';
import { towerStats } from '../logic/towers.js';
import { applyBuffs } from '../logic/buffs.js';
import { Projectile } from './Projectile.js';
import { play } from '../fx/sound.js';
import { corkPop, wineRing } from '../fx/particles.js';

// Placed tower (state object) -> merged stats (+ Wine Tasting buffs) + its build-spot position.
export function towerInfo(placed, buffs = []) {
  const spot = BUILD_SPOTS.find((s) => s.id === placed.spotId);
  return { ...applyBuffs(towerStats(placed), buffs), x: spot.x, y: spot.y };
}

const PROJ = { cork: 'proj-cork', decanter: 'proj-wine', thomas: 'proj-cork' };

// Visual + firing behaviour for one placed tower. 3/4 front view: never rotated.
export class Tower {
  constructor(scene, placed) {
    this.scene = scene;
    this.placed = placed;
    this.stats = towerInfo(placed, scene.state.buffs);
    this.cooldown = 0;
    // Thomas: first recruit comes quickly so the feature is visible early
    this.recruitLeft = placed.type === 'thomas' ? Math.min(3000, this.stats.recruitCooldownMs) : 0;
    const { x, y } = this.stats;
    this.sprite = scene.add.image(x, y + 20, `tower-${placed.type}`).setOrigin(0.5, 0.85).setDepth(y + 20).setScale(0);
    scene.tweens.add({ targets: this.sprite, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  // Quiet stat recompute (after a Wine Tasting buff).
  recompute() {
    this.stats = towerInfo(this.placed, this.scene.state.buffs);
  }

  refresh() {
    this.recompute();
    this.scene.tweens.add({ targets: this.sprite, scale: 1.2, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
  }

  // Thomas Recruit: only ticks while a wave is running (Game decides).
  tickRecruit(dtMs, enemies) {
    if (this.placed.type !== 'thomas') return;
    this.recruitLeft -= dtMs;
    if (this.recruitLeft > 0) return;
    const s = this.stats;
    let best = null;
    for (const e of enemies) {
      if (!e.alive || e.recruited || e.type === 'monstre') continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) > s.range) continue;
      if (!best || e.hp > best.hp) best = e;
    }
    if (!best) return; // stays charged until someone walks into range
    this.recruitLeft = s.recruitCooldownMs;
    this.scene.recruit(best, this);
  }

  update(dt, enemies, now) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const s = this.stats;
    const target = pickTarget(s, enemies);
    if (!target) return;
    this.cooldown = 1 / (s.rate * (this.scene.powerUp?.fireRateMult() ?? 1));
    // squash only when idle: overlapping the pop-in/upgrade tween left it stretched
    if (!this.scene.tweens.isTweening(this.sprite)) {
      this.scene.tweens.add({ targets: this.sprite, scaleY: { from: 1, to: 0.92 }, duration: 60, yoyo: true });
    }

    if (s.type === 'sommelier') {
      // Slow instead of damage: a quick wine "pour" streak to the target.
      target.slow(s.slow, s.slowMs, now);
      play('pour');
      const g = this.scene.add.graphics().setDepth(1999);
      g.lineStyle(3, 0x8a1c2b, 0.8).lineBetween(s.x, s.y - 10, target.x, target.y);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
      return;
    }
    if (s.type === 'decanter') {
      this.burst(s);
      return;
    }
    if (s.type === 'cork') {
      play('cork', { pitch: 0.9 + Math.random() * 0.2 });
      corkPop(this.scene, s.x, s.y - 18);
    }
    this.scene.projectiles.push(
      new Projectile(this.scene, s.x, s.y - 14, target, {
        texture: PROJ[s.type] || 'proj-cork',
        damage: s.damage,
        splash: s.splash || 0,
      }),
    );
  }

  // Decanter: wine bursts out all around the tower and hits every pest in
  // range. Copy the list: kills splice it and the boss split pushes cans.
  burst(s) {
    const scene = this.scene;
    for (const e of [...scene.enemies]) {
      if (Math.hypot(e.x - s.x, e.y - s.y) <= s.range) scene.damageEnemy(e, s.damage);
    }
    play('splash');
    wineRing(scene, s.x, s.y - 6, s.range);
    const ring = scene.add.circle(s.x, s.y, s.range, 0x8a1c2b, 0.35).setDepth(2545).setScale(0.2); // above the darkness: reads at night
    ring.setStrokeStyle(3, 0xd01a3a, 0.9);
    // grow fast, fade late: a fast-out alpha made the ring invisible after ~100ms
    scene.tweens.add({ targets: ring, scale: 1, duration: 280, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: ring, alpha: 0, duration: 420, ease: 'Quad.easeIn', onComplete: () => ring.destroy() });
  }

  destroy() {
    this.sprite.destroy();
  }
}
