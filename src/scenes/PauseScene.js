import Phaser from 'phaser';
import { PALETTE } from '../config/palette.js';
import { serif, body, panel, button, enter } from '../ui/kit.js';

// Modal over a paused Game (pattern: TastingScene). Two modes:
//  'pause'   Resume / Restart / Back to title; P or Esc resumes.
//  'victory' after the last scripted wave: Keep pouring (Endless) / Claim victory.
// Emits nothing: it calls Game directly through this.scene.get('Game').
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  init(data) {
    this.mode = data?.mode === 'victory' ? 'victory' : 'pause';
  }

  create() {
    this.done = false; // instance is reused: reset per-run flags here (REGRET.md 10:37)
    this.gameScene = this.scene.get('Game');

    const veil = this.add.rectangle(640, 360, 1280, 720, 0x120a0d, 1).setAlpha(0).setInteractive();
    this.tweens.add({ targets: veil, alpha: 0.7, duration: 200 });

    const victory = this.mode === 'victory';
    const H = victory ? 300 : 330;
    const c = this.add.container(640, 360);
    const p = panel(this, 0, 0, 440, H);
    const title = this.add.text(0, -H / 2 + 52, victory ? 'The cellar holds!' : 'Paused', serif(40, PALETTE.candleGold)).setOrigin(0.5);
    title.setShadow(0, 3, '#120a0d', 6, false, true);
    c.add([p, title]);

    if (victory) {
      const sub = this.add.text(0, -H / 2 + 96, 'Le Monstre Blanc is beaten. Pour on?', body(21, PALETTE.burgundy)).setOrigin(0.5);
      c.add([
        sub,
        button(this, 0, 20, 300, 52, 'Keep pouring', () => this.keepPouring(), { size: 22 }),
        button(this, 0, 86, 300, 52, 'Claim victory', () => this.claimVictory(), { size: 22 }),
      ]);
    } else {
      c.add([
        button(this, 0, -40, 280, 52, 'Resume', () => this.resume(), { size: 22 }),
        button(this, 0, 26, 280, 52, 'Restart', () => this.restart(), { size: 22 }),
        button(this, 0, 92, 280, 52, 'Back to title', () => this.toTitle(), { size: 22 }),
      ]);
      this.input.keyboard.on('keydown', this.onKey, this);
    }
    c.setScale(0.94);
    this.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });
    enter(this, c, { dy: -12, duration: 220 });

    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
  }

  onKey(e) {
    const k = (e.key || '').toLowerCase();
    if (!e.repeat && (k === 'p' || k === 'escape')) this.resume();
  }

  resume() {
    if (this.done) return;
    this.done = true;
    this.scene.stop();
    this.gameScene.resumeFromPause();
  }

  restart() {
    if (this.done) return;
    this.done = true;
    this.scene.stop();
    this.gameScene.scene.restart(); // Game's shutdown cleanup stops HUD/Tasting; create relaunches HUD
  }

  toTitle() {
    if (this.done) return;
    this.done = true;
    this.scene.stop('Game'); // its cleanup stops HUD, Tasting and Pause
    this.scene.start('Title');
  }

  keepPouring() {
    if (this.done) return;
    this.done = true;
    this.scene.stop();
    this.gameScene.resumeFromPause();
    this.gameScene.startEndless();
  }

  claimVictory() {
    if (this.done) return;
    this.done = true;
    this.scene.stop();
    this.gameScene.resumeFromPause();
    this.gameScene.state.status = 'won';
    this.gameScene.endGame('won');
  }
}
