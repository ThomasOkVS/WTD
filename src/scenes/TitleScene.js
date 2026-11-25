import Phaser from 'phaser';
import { HD, hdCamera } from '../ui/hd.js';
import { PALETTE, COLORS } from '../config/palette.js';
import { bindTextureGridKey } from '../art/textureGrid.js';
import { drawCellar } from '../fx/cellar.js';
import { startAttract } from '../fx/attract.js';
import { initSound, startMusic, isSoundReady } from '../fx/sound.js';
import { serif, body, panel, button, enter } from '../ui/kit.js';

const ZOOM = 1.12;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.starting = false; // scene instances are reused
    // lit-cellar backdrop; no Grand Cru: at the title zoom it sat cut off at the right edge
    const lighting = drawCellar(this, { grandCru: false });
    const backdrop = this.children.list.slice();

    // Main camera drifts slowly across the zoomed-in cellar; a second,
    // unzoomed camera draws the title so it stays put and sharp.
    this.cameras.main.setBounds(0, 0, 1280, 720);
    const cam = hdCamera(this, ZOOM, 600, 350);
    const ui = (this.uiCam = this.cameras.add(0, 0, 1280 * HD, 720 * HD).setZoom(HD).centerOn(640, 360));
    ui.ignore(backdrop);
    startAttract(this, { ui, lighting }); // scripted battle behind the card; tears itself down on shutdown
    // Chain legs on PAN_COMPLETE: a pan started inside the pan's own update
    // callback is wiped by effectComplete() right after (Phaser 4).
    let toRight = true;
    const drift = () => {
      cam.pan(toRight ? 690 : 590, toRight ? 375 : 345, 11000, 'Sine.easeInOut', true);
      toRight = !toRight;
    };
    cam.on(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, drift);
    this.events.once('shutdown', () => cam.off(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, drift));
    drift();

    const uiObjects = this.buildLabel();
    cam.ignore(uiObjects);
    // Anything added later (e.g. the T texture grid) draws once, unzoomed.
    const onAdded = (go) => cam.ignore(go);
    this.events.on('addedtoscene', onAdded);
    this.events.once('shutdown', () => this.events.off('addedtoscene', onAdded));

    cam.fadeIn(400, 18, 10, 13);
    ui.fadeIn(400, 18, 10, 13);
    bindTextureGridKey(this);
    this.setupSoundUnlock();
  }

  // Browsers block audio until the first user gesture, so music can't start on
  // load. Start it on the first click or key press anywhere on the title.
  setupSoundUnlock() {
    if (isSoundReady()) return;
    const hint = this.add.text(640, 690, 'Click anywhere for sound', body(18, PALETTE.candleGold)).setOrigin(0.5);
    hint.setShadow(0, 2, '#120a0d', 6, false, true);
    enter(this, hint, { duration: 300, delay: 700, alpha: 0.7 });
    const unlock = () => {
      this.input.off('pointerdown', unlock);
      this.input.keyboard?.off('keydown', unlock);
      initSound();
      startMusic();
      this.tweens.add({ targets: hint, alpha: 0, duration: 400, onComplete: () => hint.destroy() });
    };
    this.input.on('pointerdown', unlock);
    this.input.keyboard?.on('keydown', unlock);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', unlock);
      this.input.keyboard?.off('keydown', unlock);
    });
  }

  // The title is a wine label: parchment, double border, Cinzel name.
  buildLabel() {
    const c = this.add.container(640, 316);
    const glow = this.add.image(0, 0, 'light-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.amber)
      .setDisplaySize(1300, 760).setAlpha(0.32);
    const shadow = this.add.rectangle(6, 12, 700, 300, 0x120a0d, 0.55);
    const p = panel(this, 0, 0, 700, 300);
    const top = this.add.text(0, -104, 'Appellation Cave Contrôlée', body(20, PALETTE.burgundy)).setOrigin(0.5);
    const ruleA = this.add.rectangle(0, -80, 420, 1.5, COLORS.burgundy, 0.6);
    const title = this.add.text(0, -26, 'Wine Cellar Siege', serif(64)).setOrigin(0.5);
    title.setLetterSpacing(2);
    const sub = this.add.text(0, 32, 'A Candle-lit Tower Defense', body(28, PALETTE.burgundy)).setOrigin(0.5);
    const ruleB = this.add.rectangle(0, 70, 420, 1.5, COLORS.burgundy, 0.6);
    const foot = this.add.text(0, 96, 'Grand Cru, defended by hand in the cellar', body(18, PALETTE.ink)).setOrigin(0.5).setAlpha(0.8);
    c.add([glow, shadow, p, top, ruleA, title, sub, ruleB, foot]);
    enter(this, c, { dy: 18, duration: 300, delay: 100 });

    const play = button(this, 640, 548, 220, 64, 'Play', () => this.start(play), { size: 30 });
    enter(this, play, { dy: 18, duration: 260, delay: 320 });
    const hint = this.add.text(640, 610, 'Hold seven waves, then pour on into Endless', body(19, PALETTE.candleGold)).setOrigin(0.5);
    hint.setShadow(0, 2, '#120a0d', 6, false, true);
    enter(this, hint, { duration: 300, delay: 480, alpha: 0.85 });
    const keys = this.add.text(640, 642, 'Click a card, click the floor to build  ·  P pause  ·  F speed  ·  M mute', body(16, PALETTE.parchment)).setOrigin(0.5);
    keys.setShadow(0, 2, '#120a0d', 6, false, true);
    enter(this, keys, { duration: 300, delay: 560, alpha: 0.75 });
    return [c, play, hint, keys];
  }

  start(play) {
    if (this.starting) return;
    this.starting = true;
    play.setEnabled(false);
    // Task 10 hook: first user gesture unlocks WebAudio here.
    initSound();
    startMusic();
    this.cameras.main.fadeOut(300, 18, 10, 13);
    this.uiCam.fadeOut(300, 18, 10, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
  }
}
