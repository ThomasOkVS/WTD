import { ENEMIES } from '../config/enemies.js';
import { applyDamage } from '../logic/combat.js';

const BAR_W = 28;

// One walking enemy. Plain object (x, y, distance, hp, alive, armour) so the
// Phaser-free combat rules (pickTarget/applyDamage) can use it directly.
export class Enemy {
  constructor(scene, type) {
    const cfg = ENEMIES[type];
    this.scene = scene;
    this.type = type;
    this.hp = this.maxHp = cfg.hp;
    this.speed = cfg.speed;
    this.armour = cfg.armour;
    this.reward = cfg.reward;
    this.leakCost = cfg.leakCost;
    this.distance = 0;
    this.alive = true;
    this.slowFactor = 1;
    this.slowUntil = 0;

    const p = scene.path.positionAt(0);
    this.x = p.x;
    this.y = p.y;
    this.sprite = scene.add.image(p.x, p.y, `enemy-${type}`).setRotation(p.angle).setAlpha(0);
    this.bar = scene.add.graphics().setVisible(false);
    scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 200 });
    // small dim halo so pests stay readable between the candle pools
    this.light = scene.lighting?.addLight(p.x, p.y, 45, 0, { strength: 0.5, glow: false });
  }

  slow(amount, ms, now) {
    this.slowFactor = Math.min(this.slowFactor, 1 - amount);
    this.slowUntil = Math.max(this.slowUntil, now + ms);
  }

  update(dt, now) {
    if (this.slowFactor < 1 && now >= this.slowUntil) this.slowFactor = 1;
    this.distance += this.speed * this.slowFactor * dt;
    const p = this.scene.path.positionAt(this.distance);
    this.x = p.x;
    this.y = p.y;
    this.sprite.setPosition(p.x, p.y).setRotation(p.angle).setDepth(p.y);
    if (this.light) {
      this.light.x = p.x;
      this.light.y = p.y;
    }
    if (this.slowFactor < 1) this.sprite.setTint(0xc9a0ff);
    else this.sprite.clearTint();
    if (this.bar.visible) this.drawBar();
  }

  get leaked() {
    return this.distance >= this.scene.path.length;
  }

  hit(damage) {
    applyDamage(this, damage);
    this.bar.setVisible(true);
    this.drawBar();
    return this.hp <= 0;
  }

  drawBar() {
    const top = this.y - this.sprite.height / 2 - 8;
    const f = Math.max(0, this.hp / this.maxHp);
    this.bar.clear().setDepth(this.y + 0.5);
    this.bar.fillStyle(0x120a0d, 0.85).fillRect(this.x - BAR_W / 2 - 1, top - 1, BAR_W + 2, 5);
    this.bar.fillStyle(f > 0.5 ? 0x8fd16a : f > 0.25 ? 0xffb35c : 0xd01a3a, 1).fillRect(this.x - BAR_W / 2, top, BAR_W * f, 3);
  }

  // Remove with a short shrink/fade (killed) or immediately.
  destroy(animated = false) {
    this.alive = false;
    this.bar.destroy();
    if (this.light) this.scene.lighting.removeLight(this.light);
    this.light = null;
    this.scene.tweens.killTweensOf(this.sprite); // the fade-in may still be running
    if (!animated) {
      this.sprite.destroy();
      return;
    }
    const s = this.sprite;
    this.scene.tweens.add({ targets: s, alpha: 0, scale: 0.4, duration: 180, onComplete: () => s.destroy() });
  }
}
