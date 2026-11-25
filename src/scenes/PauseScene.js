import Phaser from 'phaser';
import { PALETTE } from '../config/palette.js';
import { serif, body, panel, button, enter } from '../ui/kit.js';
import { hdCamera } from '../ui/hd.js';

// Button cheat sheet (Pause > Controls). Keep in sync with README "Demo keys".
const PLAY_KEYS = [
  ['Click', 'Pick a card, click the cellar to build'],
  ['Right-click', 'Cancel building (or Esc)'],
  ['Click tower', 'Upgrade, Repair or Sell'],
  ['P / Esc', 'Pause'],
  ['F', '2x speed'],
  ['M', 'Mute / unmute'],
  ['L', 'Projector mode (brighter cellar)'],
];
const PRESENTER_KEYS = [
  ['1 – 7', 'Start that wave right away'],
  ['G', '+500 Grapes'],
  ['W', "Thomas's Wine Tasting"],
  ['R', 'Recharge Taureau Rouge'],
  ['D', 'Pests bite back: towers to 25% HP'],
  ['B', 'Spawn Le Monstre Blanc'],
];

// Modal over a paused Game (pattern: TastingScene). Two modes:
//  'pause'   Resume / Controls / Restart / Back to title; P or Esc resumes
//            (or closes the Controls sheet first).
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
    hdCamera(this); // HD canvas, same 1280x720 world
    this.done = false; // instance is reused: reset per-run flags here (REGRET.md 10:37)
    this.gameScene = this.scene.get('Game');

    const veil = this.add.rectangle(640, 360, 1280, 720, 0x120a0d, 1).setAlpha(0).setInteractive();
    this.tweens.add({ targets: veil, alpha: 0.7, duration: 200 });

    const victory = this.mode === 'victory';
    const H = victory ? 300 : 396;
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
        button(this, 0, -72, 280, 52, 'Resume', () => this.resume(), { size: 22 }),
        button(this, 0, -6, 280, 52, 'Controls', () => this.showControls(true), { size: 22 }),
        button(this, 0, 60, 280, 52, 'Restart', () => this.restart(), { size: 22 }),
        button(this, 0, 126, 280, 52, 'Back to title', () => this.toTitle(), { size: 22 }),
      ]);
      this.menu = c;
      this.controls = this.buildControls();
      this.input.keyboard.on('keydown', this.onKey, this);
    }
    c.setScale(0.94);
    this.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });
    enter(this, c, { dy: -12, duration: 220 });

    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
  }

  onKey(e) {
    const k = (e.key || '').toLowerCase();
    if (e.repeat || (k !== 'p' && k !== 'escape')) return;
    if (this.controls?.visible) this.showControls(false);
    else this.resume();
  }

  // Cheat sheet panel: two columns of key chip + effect, hidden until opened.
  buildControls() {
    const c = this.add.container(640, 360).setVisible(false);
    const p = panel(this, 0, 0, 1000, 540);
    const title = this.add.text(0, -222, 'Controls', serif(36, PALETTE.candleGold)).setOrigin(0.5);
    title.setShadow(0, 3, '#120a0d', 6, false, true);
    c.add([p, title]);
    const column = (x, heading, rows) => {
      c.add(this.add.text(x, -168, heading, serif(20, PALETTE.burgundy)).setOrigin(0, 0.5));
      rows.forEach(([key, what], i) => {
        const y = -122 + i * 44;
        const kt = this.add.text(0, 0, key, serif(16, PALETTE.parchment)).setOrigin(0.5);
        const w = Math.max(40, kt.width + 22);
        const chip = this.add.graphics();
        chip.fillStyle(0x5a1520, 1).fillRoundedRect(x, y - 15, w, 30, 7)
          .lineStyle(1.5, 0xffd36b, 0.9).strokeRoundedRect(x, y - 15, w, 30, 7);
        kt.setPosition(x + w / 2, y + 1);
        const label = this.add.text(x + 140, y, what, body(19, PALETTE.ink)).setOrigin(0, 0.5);
        c.add([chip, kt, label]);
      });
    };
    column(-460, 'Playing', PLAY_KEYS);
    column(30, 'Presenter shortcuts', PRESENTER_KEYS);
    c.add(button(this, 0, 220, 220, 48, 'Back', () => this.showControls(false), { size: 20 }));
    return c;
  }

  showControls(on) {
    if (this.done) return;
    this.menu.setVisible(!on);
    this.controls.setVisible(on);
    if (on) {
      this.controls.setScale(0.96).setAlpha(0);
      this.tweens.add({ targets: this.controls, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
    }
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
