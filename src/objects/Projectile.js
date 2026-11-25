const SPEED = 520; // px/s

// Homing projectile. If the target dies mid-flight it flies on to the last
// known position and still explodes there (matters for decanter splash).
export class Projectile {
  constructor(scene, x, y, target, { texture, damage, splash = 0 }) {
    this.scene = scene;
    this.target = target;
    this.damage = damage;
    this.splash = splash;
    this.tx = target.x;
    this.ty = target.y;
    this.done = false;
    this.sprite = scene.add.image(x, y, texture).setDepth(2000);
  }

  update(dt) {
    if (this.target.alive) {
      this.tx = this.target.x;
      this.ty = this.target.y;
    }
    const s = this.sprite;
    const dx = this.tx - s.x, dy = this.ty - s.y;
    const dist = Math.hypot(dx, dy);
    const step = SPEED * dt;
    if (dist <= step + 4) {
      s.setPosition(this.tx, this.ty);
      this.impact();
      return;
    }
    s.setPosition(s.x + (dx / dist) * step, s.y + (dy / dist) * step).setRotation(Math.atan2(dy, dx));
  }

  impact() {
    this.done = true;
    const scene = this.scene;
    if (this.splash > 0) {
      for (const e of [...scene.enemies]) {
        if (Math.hypot(e.x - this.tx, e.y - this.ty) <= this.splash) scene.damageEnemy(e, this.damage);
      }
      const ring = scene.add.circle(this.tx, this.ty, this.splash, 0x8a1c2b, 0.35).setDepth(1999).setScale(0.3);
      scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    } else if (this.target.alive) {
      scene.damageEnemy(this.target, this.damage);
    }
    this.sprite.destroy();
  }

  destroy() {
    this.done = true;
    this.sprite.destroy();
  }
}
