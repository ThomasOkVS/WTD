import Phaser from 'phaser';
import { hdCamera } from '../ui/hd.js';
import { PALETTE, COLORS } from '../config/palette.js';
import { TOWERS } from '../config/towers.js';
import { drawTasting } from '../logic/buffs.js';
import { serif, body, panel, enter } from '../ui/kit.js';
import { play } from '../fx/sound.js';

const STAT_LABEL = {
  range: 'range',
  damage: 'damage',
  rate: 'fire rate',
  slowMs: 'slow duration',
  splash: 'splash radius',
  reward: 'Grapes per kill',
};

// "+20% range, all towers"
export function describeEffect({ stat, mult, tower }) {
  const pct = Math.round((mult - 1) * 100);
  const who = stat === 'reward' ? 'every pest' : stat === 'slowMs' ? 'Sommeliers' : tower ? `${TOWERS[tower].name} only` : 'all towers';
  return `+${pct}% ${STAT_LABEL[stat] || stat}\n${who}`;
}

// Each wine's bottle is coloured by what it does, so the three differ at a glance.
const WINE_COLOR = { damage: 0x8a1c2b, rate: 0xc8862a, reward: 0x5a2a6a };
export const wineColor = (stat) => WINE_COLOR[stat] ?? 0xd77a8a;

const CARD_W = 214, CARD_H = 300, CARD_Y = 430;
const CARD_X = [600, 840, 1080];

// Thomas's Annual Wine Tasting. Modal scene launched by Game after every
// cleared wave except the last; Game is paused while it is open. A pick is
// sent to Game as 'tasting-picked' (wine); Game applies the buff.
export class TastingScene extends Phaser.Scene {
  constructor() {
    super('Tasting');
  }

  create() {
    hdCamera(this); // HD canvas, same 1280x720 world
    this.picked = false; // instance is reused every wave: reset here
    this.game$ = this.scene.get('Game').events;
    this.wines = drawTasting();

    // full-screen blocker: dims the cellar and swallows clicks meant for HUD/Game
    const veil = this.add.rectangle(640, 360, 1280, 720, 0x120a0d, 1).setAlpha(0).setInteractive();
    this.tweens.add({ targets: veil, alpha: 0.78, duration: 260 });

    const title = this.add.text(640, 70, "Thomas's Annual Wine Tasting", serif(40, PALETTE.candleGold)).setOrigin(0.5);
    title.setShadow(0, 3, '#120a0d', 6, false, true);
    const sub = this.add.text(640, 116, 'Choose one wine. Its effect lasts all evening.', body(22, PALETTE.parchment)).setOrigin(0.5);
    enter(this, title, { dy: -20, duration: 280 });
    enter(this, sub, { dy: -14, delay: 60, duration: 280 });

    this.createThomas();
    this.cards = this.wines.map((wine, i) => this.createCard(wine, i));
    this.say(this.wines[0].line);

    this.events.once('shutdown', () => {
      this.cards = [];
      this.bubble = null;
    });
  }

  createThomas() {
    const x = 210, feet = 560;
    const halo = this.add.image(x, feet - 110, 'light-soft').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(COLORS.amber).setDisplaySize(420, 420).setAlpha(0);
    this.tweens.add({ targets: halo, alpha: 0.45, duration: 400 });
    const thomas = this.add.image(x, feet, 'tower-thomas').setOrigin(0.5, 1).setScale(3);
    enter(this, thomas, { dx: -40, delay: 80, duration: 300 });
    this.tweens.add({ targets: thomas, scaleY: 3.06, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const name = this.add.text(x, feet + 22, 'Thomas, sommelier', body(20, PALETTE.candleGold)).setOrigin(0.5);
    enter(this, name, { delay: 140, duration: 260 });

    // parchment speech bubble above his head, tail pointing down at him
    const b = this.add.container(250, 196);
    const W = 430, H = 132;
    const tail = this.add.graphics();
    tail.fillStyle(0xe9dcc0, 1).fillTriangle(-70, H / 2 - 8, -30, H / 2 - 8, -64, H / 2 + 26);
    tail.lineStyle(2, COLORS.burgundy, 0.8).lineBetween(-70, H / 2 - 2, -64, H / 2 + 26).lineBetween(-64, H / 2 + 26, -30, H / 2 - 2);
    const p = panel(this, 0, 0, W, H);
    const text = this.add.text(0, 0, '', body(23, PALETTE.ink, { align: 'center', wordWrap: { width: W - 56 } })).setOrigin(0.5);
    b.add([tail, p, text]);
    b.setScale(0.9);
    enter(this, b, { dy: 12, delay: 200, duration: 260 });
    this.tweens.add({ targets: b, scale: 1, delay: 200, duration: 260, ease: 'Back.easeOut' });
    this.bubble = { b, text, wrap: W - 56 };
  }

  say(line) {
    const { text } = this.bubble;
    if (text.text === `“${line}”`) return;
    this.tweens.killTweensOf(text);
    this.tweens.add({
      targets: text, alpha: 0, duration: text.text ? 90 : 0,
      onComplete: () => {
        text.setText(`“${line}”`);
        // no one-word last line ("I would hire / it."): narrow the wrap until it balances
        for (const w of [this.bubble.wrap, this.bubble.wrap - 50, this.bubble.wrap - 100]) {
          text.setWordWrapWidth(w, true);
          const lines = text.getWrappedText();
          if (lines.length < 2 || lines[lines.length - 1].trim().length >= 8) break;
        }
        this.tweens.add({ targets: text, alpha: 1, duration: 140 });
      },
    });
  }

  createCard(wine, i) {
    const c = this.add.container(CARD_X[i], CARD_Y);
    const glow = this.add.image(0, 0, 'light-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.amber)
      .setDisplaySize(CARD_W * 1.8, CARD_H * 1.5).setAlpha(0);
    const bg = panel(this, 0, 0, CARD_W, CARD_H);
    const hue = wineColor(wine.effect.stat);
    const bottleGlow = this.add.image(0, -70, 'light-soft').setTint(hue).setDisplaySize(170, 170).setAlpha(0.35);
    const bottle = this.add.image(0, -66, 'grand-cru').setScale(1.05).setTint(hue).setTintMode(Phaser.TintModes.SCREEN);
    const name = this.add.text(0, 20, wine.name, serif(19, PALETTE.ink, { align: 'center', wordWrap: { width: CARD_W - 36 } })).setOrigin(0.5, 0);
    const rule = this.add.rectangle(0, 76, CARD_W - 70, 1.5, COLORS.burgundy, 0.6);
    const effect = this.add.text(0, 110, describeEffect(wine.effect), body(21, PALETTE.burgundy, { align: 'center' })).setOrigin(0.5);
    const hit = this.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    c.add([glow, bg, bottleGlow, bottle, name, rule, effect, hit]);
    Object.assign(c, { wine, glow });

    // flip in: scaleX 0 -> 1, staggered
    c.setScale(0, 1).setAlpha(0);
    this.tweens.add({ targets: c, scaleX: 1, alpha: 1, delay: 320 + i * 150, duration: 340, ease: 'Back.easeOut' });

    hit.on('pointerover', () => {
      if (this.picked) return;
      this.say(wine.line);
      this.tweens.add({ targets: c, y: CARD_Y - 12, duration: 160, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: glow, alpha: 0.5, duration: 180 });
    });
    hit.on('pointerout', () => {
      if (this.picked) return;
      this.tweens.add({ targets: c, y: CARD_Y, duration: 160, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: glow, alpha: 0, duration: 180 });
    });
    hit.on('pointerdown', () => this.pick(c));
    return c;
  }

  pick(card) {
    if (this.picked) return; // a double-click must not push two buffs
    this.picked = true;
    play('click');
    this.say(card.wine.line);
    for (const c of this.cards) {
      this.tweens.killTweensOf(c);
      if (c === card) {
        this.tweens.add({ targets: c, scale: 1.08, duration: 180, yoyo: true, ease: 'Sine.easeOut' });
      } else {
        this.tweens.add({ targets: c, alpha: 0.25, scaleX: 0, duration: 260, ease: 'Cubic.easeIn' });
      }
    }
    // linger on the choice, then fade the whole tasting out and resume the cellar
    // (an alpha fade, not a camera fade: a camera fade would go opaque over the cellar)
    this.time.delayedCall(650, () => {
      this.tweens.add({
        targets: [...this.children.list], alpha: 0, duration: 280, ease: 'Sine.easeIn',
        onComplete: () => {
          // sent on close so the HUD's "Buff: ..." banner isn't hidden under the tasting
          this.game$.emit('tasting-picked', card.wine);
          this.scene.resume('Game');
          this.scene.stop();
        },
      });
    });
  }
}
