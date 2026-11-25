import { BUILD_SPOTS } from '../config/map.js';
import { pickTarget } from '../logic/combat.js';
import { towerStats } from '../logic/towers.js';
import { Projectile } from './Projectile.js';

// Placed tower (state object) -> merged stats + its build-spot position.
export function towerInfo(placed) {
  const spot = BUILD_SPOTS.find((s) => s.id === placed.spotId);
  return { ...towerStats(placed), x: spot.x, y: spot.y };
}

const PROJ = { cork: 'proj-cork', decanter: 'proj-wine', thomas: 'proj-cork' };

// Visual + firing behaviour for one placed tower. 3/4 front view: never rotated.
export class Tower {
  constructor(scene, placed) {
    this.scene = scene;
    this.placed = placed;
    this.stats = towerInfo(placed);
    this.cooldown = 0;
    const { x, y } = this.stats;
    this.sprite = scene.add.image(x, y + 20, `tower-${placed.type}`).setOrigin(0.5, 0.85).setDepth(y + 20).setScale(0);
    scene.tweens.add({ targets: this.sprite, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  refresh() {
    this.stats = towerInfo(this.placed);
    this.scene.tweens.add({ targets: this.sprite, scale: 1.2, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
  }

  update(dt, enemies, now) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const s = this.stats;
    const target = pickTarget(s, enemies);
    if (!target) return;
    this.cooldown = 1 / s.rate;
    this.scene.tweens.add({ targets: this.sprite, scaleY: 0.92, duration: 60, yoyo: true });

    if (s.type === 'sommelier') {
      // Slow instead of damage: a quick wine "pour" streak to the target.
      target.slow(s.slow, s.slowMs, now);
      const g = this.scene.add.graphics().setDepth(1999);
      g.lineStyle(3, 0x8a1c2b, 0.8).lineBetween(s.x, s.y - 10, target.x, target.y);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
      return;
    }
    this.scene.projectiles.push(
      new Projectile(this.scene, s.x, s.y - 14, target, {
        texture: PROJ[s.type] || 'proj-cork',
        damage: s.damage,
        splash: s.splash || 0,
      }),
    );
  }

  destroy() {
    this.sprite.destroy();
  }
}
