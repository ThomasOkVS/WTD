import { ENEMIES } from '../config/enemies.js';
import { applyDamage } from '../logic/combat.js';
import { createAttacker } from '../logic/siege.js';

const GOLD = 0xffd36b;

// One walking enemy. Plain object (x, y, distance, hp, alive, armour) so the
// Phaser-free combat rules (pickTarget/applyDamage) can use it directly.
export class Enemy {
  constructor(scene, type, distance = 0, hpMult = 1, speedMult = 1) {
    const cfg = ENEMIES[type];
    this.scene = scene;
    this.type = type;
    this.hp = this.maxHp = Math.round(cfg.hp * hpMult); // Endless waves are tougher
    this.speed = cfg.speed * speedMult; // waves 6+ are faster
    this.armour = cfg.armour;
    this.reward = cfg.reward;
    this.leakCost = cfg.leakCost;
    this.distance = distance;
    this.alive = true;
    this.recruited = false;
    this.boss = type === 'monstre';
    this.enraged = false;
    this.summonIn = cfg.summon ? cfg.summon.firstMs : Infinity; // boss only: ms to the next can summon
    this.barW = this.boss ? 84 : 28;
    this.slowFactor = 1;
    this.slowUntil = 0;
    // pests fight back: attack state, chew hold and cosmetic offsets (lunge / wobble)
    this.attacker = cfg.attack ? createAttacker(cfg.attack) : null;
    this.holding = false;
    this.offX = 0;
    this.offY = 0;
    this.rotOff = 0;

    const p = scene.path.positionAt(distance);
    this.x = p.x;
    this.y = p.y;
    this.sprite = scene.add.image(p.x, p.y, `enemy-${type}`).setRotation(p.angle).setAlpha(0);
    this.bar = scene.add.graphics().setVisible(this.boss); // the boss shows its health from the start
    scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 200 });
    // small dim halo so pests stay readable between the candle pools
    // (the boss gets a bigger one so the big moment reads in the dark)
    // Perf: every light is an extra erase in the darkness pass each frame, so
    // only the first dozen pests on the field get a halo (the boss always does).
    if (this.boss || (scene.enemies?.length ?? 0) < 12) {
      this.light = scene.lighting?.addLight(p.x, p.y, this.boss ? 130 : 60, 0, { strength: 0.9, glow: false });
    }
  }

  // Thomas Recruit: turns gold, walks back towards the entrance.
  recruit() {
    this.recruited = true;
    this.holding = false; // a rat recruited mid-chew lets go and walks back
    this.slowFactor = 1;
    this.sprite.setTint(GOLD);
    if (this.light) this.scene.lighting.removeLight(this.light);
    this.light = this.scene.lighting?.addLight(this.x, this.y, 70, GOLD, { strength: 1, glow: true });
    this.scene.tweens.add({ targets: this.sprite, scale: 1.25, duration: 160, yoyo: true, ease: 'Sine.easeOut' });
  }

  // Boss: one-way switch to furious. Copies the attack cfg (shared config stays untouched).
  enrage() {
    const { enrage } = ENEMIES[this.type];
    this.enraged = true;
    this.speed *= enrage.speedMult;
    if (this.attacker) this.attacker.cfg = { ...this.attacker.cfg, cooldownMs: enrage.slamCooldownMs };
  }

  slow(amount, ms, now) {
    this.slowFactor = Math.min(this.slowFactor, 1 - amount);
    this.slowUntil = Math.max(this.slowUntil, now + ms);
  }

  update(dt, now) {
    if (this.slowFactor < 1 && now >= this.slowUntil) this.slowFactor = 1;
    const dir = this.recruited ? -1 : 1;
    if (!this.holding || this.recruited) this.distance += dir * this.speed * this.slowFactor * dt;
    const p = this.scene.path.positionAt(this.distance);
    this.x = p.x;
    this.y = p.y;
    this.sprite.setPosition(p.x + this.offX, p.y + this.offY)
      .setRotation((this.recruited ? p.angle + Math.PI : p.angle) + this.rotOff).setDepth(p.y);
    if (this.light) {
      this.light.x = p.x;
      this.light.y = p.y;
    }
    if (this.recruited) this.sprite.setTint(GOLD);
    else if (this.enraged) this.sprite.setTint(0xff5a4a); // furious wins over the slow tint
    else if (this.slowFactor < 1) this.sprite.setTint(0xc9a0ff);
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
    const w = this.barW, h = this.boss ? 6 : 3;
    this.bar.clear().setDepth(this.y + 0.5);
    this.bar.fillStyle(0x120a0d, 0.85).fillRect(this.x - w / 2 - 1, top - 1, w + 2, h + 2);
    const color = this.recruited ? GOLD : f > 0.5 ? 0x8fd16a : f > 0.25 ? 0xffb35c : 0xd01a3a;
    this.bar.fillStyle(color, 1).fillRect(this.x - w / 2, top, w * f, h);
    if (this.boss) this.bar.lineStyle(1, 0xe8c07a, 0.8).strokeRect(this.x - w / 2 - 1, top - 1, w + 2, h + 2);
  }

  // Remove with a short shrink/fade (killed) or immediately.
  destroy(animated = false) {
    this.alive = false;
    this.scene.tweens.killTweensOf(this); // lunge / wobble tweens on offX/offY/rotOff
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
