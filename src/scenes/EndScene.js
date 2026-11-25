import Phaser from 'phaser';
import { hdCamera } from '../ui/hd.js';
import { PALETTE, COLORS } from '../config/palette.js';
import { WAVES } from '../config/waves.js';
import { drawCellar } from '../fx/cellar.js';
import { serif, body, panel, button, enter } from '../ui/kit.js';
import { play } from '../fx/sound.js';

// data: { result: 'won'|'lost', wave, kills }
export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  init(data) {
    this.result = data.result || 'lost';
    this.wave = data.wave || 0;
    this.kills = data.kills ?? null;
    this.endless = !!data.endless;
    this.lives = data.lives ?? null;
    this.leaving = false; // scene instances are reused across runs
  }

  create() {
    hdCamera(this); // HD canvas, same 1280x720 world
    const won = this.result === 'won';
    drawCellar(this, { grandCru: false });
    const veil = this.add.rectangle(640, 360, 1280, 720, 0x120a0d, 0).setDepth(2900);
    this.tweens.add({ targets: veil, fillAlpha: 0.55, duration: 400 });
    // a pocket of shadow so the bottle doesn't stand on the backdrop's candle
    const hush = this.add.image(640, 200, 'light-soft').setTint(0x120a0d).setDisplaySize(360, 300).setAlpha(0).setDepth(2950);
    this.tweens.add({ targets: hush, alpha: 0.95, duration: 400 });
    this.cameras.main.fadeIn(350, 18, 10, 13);

    // the bottle, in its own warm light
    const halo = this.add.image(640, 176, 'light-soft').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(won ? COLORS.amber : 0xff6a5a).setDisplaySize(420, 420).setAlpha(0).setDepth(3000);
    const bottle = this.add.image(640, 236, 'grand-cru').setOrigin(0.5, 0.9).setScale(1.7).setDepth(3001);
    enter(this, bottle, { dy: -16, duration: 300 });
    this.tweens.add({ targets: halo, alpha: 0.55, duration: 400 });
    if (won) { play('win'); this.celebrate(bottle, halo); }
    else this.time.delayedCall(650, () => this.shatter(bottle, halo));

    const c = this.add.container(640, 462).setDepth(3100);
    const p = panel(this, 0, 0, 640, 260);
    const title = this.add.text(0, -82, won ? 'Vintage saved!' : 'The Grand Cru has shattered', serif(won ? 44 : 34, won ? PALETTE.ink : PALETTE.burgundy)).setOrigin(0.5);
    const rule = this.add.rectangle(0, -46, 380, 1.5, COLORS.burgundy, 0.6);
    const reached = this.endless ? `Endless: held until wave ${this.wave}` : won ? `All ${WAVES.length} waves held back` : `Held until wave ${Math.max(1, this.wave)} of ${WAVES.length}`;
    const lines = [reached];
    if (this.kills !== null) lines.push(`${this.kills} pests dispatched`);
    if (this.lives !== null && won) lines.push(`Grand Cru left: ${this.lives}`);
    const stats = this.add.text(0, -32, lines.join('\n'), body(lines.length > 2 ? 22 : 24, PALETTE.ink, { align: 'center' })).setOrigin(0.5, 0).setLineSpacing(2);
    c.add([p, title, rule, stats]);
    enter(this, c, { dy: 24, duration: 300, delay: 250 });

    const again = button(this, 515, 548, 230, 58, 'Play again', () => this.leave('Game', [again, home]), { size: 26 }).setDepth(3100);
    const home = button(this, 765, 548, 230, 58, 'Back to title', () => this.leave('Title', [again, home]), { size: 22, variant: 'secondary' }).setDepth(3100);
    enter(this, again, { dy: 18, duration: 260, delay: 450 });
    enter(this, home, { dy: 18, duration: 260, delay: 520 });
  }

  // Glass-shatter burst: shards of light + wine drops, bottle gone.
  shatter(bottle, halo) {
    const { x } = bottle;
    const y = bottle.y - 70;
    play('shatter');
    this.cameras.main.shake(260, 0.008);
    this.cameras.main.flash(160, 255, 200, 170);
    this.tweens.add({ targets: bottle, scale: 1.9, alpha: 0, duration: 90 });
    this.tweens.add({ targets: halo, alpha: 0.2, duration: 600 });
    const shards = this.add.particles(x, y, 'spark', {
      speed: { min: 140, max: 420 }, angle: { min: 0, max: 360 }, rotate: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0.2 }, alpha: { start: 1, end: 0 }, lifespan: { min: 600, max: 1100 },
      gravityY: 520, tint: [0xfff3c4, 0xe8c07a, 0xffffff], emitting: false, maxAliveParticles: 80,
    }).setDepth(3050);
    const wine = this.add.particles(x, y + 20, 'drop', {
      speed: { min: 80, max: 300 }, angle: { min: 200, max: 340 },
      scale: { start: 1.1, end: 0.5 }, alpha: { start: 1, end: 0 }, lifespan: { min: 700, max: 1300 },
      gravityY: 700, tint: [COLORS.wineRed, COLORS.burgundy], emitting: false, maxAliveParticles: 80,
    }).setDepth(3040);
    shards.explode(36);
    wine.explode(48);
    // a soft wine pool spreading where it stood
    const pool = this.add.image(x, bottle.y - 4, 'light-soft').setTint(COLORS.burgundy).setDisplaySize(20, 6).setAlpha(0.95).setDepth(3000);
    this.tweens.add({ targets: pool, displayWidth: 190, displayHeight: 44, duration: 1400, ease: 'Cubic.easeOut' });
    const broken = this.add.image(x, bottle.y, 'grand-cru-broken').setOrigin(0.5, 0.9).setScale(1.7).setAlpha(0).setDepth(3001);
    this.tweens.add({ targets: broken, alpha: 1, delay: 350, duration: 500 });
    this.tweens.add({ targets: pool, displayWidth: 230, alpha: 0.75, delay: 1400, duration: 6000, ease: 'Sine.easeOut' });
  }

  celebrate(bottle, halo) {
    this.tweens.add({ targets: halo, scale: halo.scale * 1.12, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.particles(bottle.x, bottle.y - 80, 'spark', {
      speed: { min: 10, max: 40 }, angle: { min: 240, max: 300 }, scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 }, lifespan: 1800, frequency: 120, tint: [0xffb35c, 0xe8c07a], maxAliveParticles: 80,
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 60) },
    }).setDepth(3050);
  }

  leave(target, btns) {
    if (this.leaving) return;
    this.leaving = true;
    btns.forEach((b) => b.setEnabled(false));
    this.cameras.main.fadeOut(300, 18, 10, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(target));
  }
}
