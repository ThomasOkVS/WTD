import Phaser from 'phaser';
import { TOWERS } from '../config/towers.js';
import { WAVES } from '../config/waves.js';
import { BUILD_SPOTS } from '../config/map.js';
import { PALETTE, COLORS } from '../config/palette.js';
import { serif, body, panel, grapeIcon, button, enter, shake, fitText, INK } from '../ui/kit.js';
import { describeEffect } from './TastingScene.js';

const CARD_W = 168, CARD_H = 92, CARD_Y = 664;
const TOAST = {
  grapes: 'Not enough grapes',
  occupied: 'That spot is taken',
  unique: 'Thomas is already on duty',
  max: 'Fully upgraded',
};

// Parallel UI scene above the lit cellar. Launched by Game (with starting
// values as data) and stopped when Game shuts down; talks to Game only
// through Game's event emitter, and removes only its own listeners.
export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  init(data) {
    this.grapes = data.grapes ?? 0;
    this.lives = data.lives ?? 0;
    this.wave = data.wave ?? 0; // waves started so far
  }

  create() {
    this.game$ = this.scene.get('Game').events;
    this.input.enabled = true; // re-enable after a previous run's game-over
    this.listeners = [];
    this.selected = null;
    this.thomasPlaced = false;
    this.waveRunning = false;
    this.shownGrapes = this.grapes;
    this.upgradeFor = null;

    this.createTop();
    this.createBar();
    this.createPower();
    this.toast = this.createToast();

    this.listen('grapes-changed', this.onGrapes);
    this.listen('lives-changed', this.onLives);
    this.listen('wave-started', this.onWaveStarted);
    this.listen('wave-cleared', this.onWaveCleared);
    this.listen('tower-selected', this.onSelected);
    this.listen('tower-placed', this.onPlaced);
    this.listen('placement-refused', this.onRefused);
    this.listen('tower-clicked', this.openUpgrade);
    this.listen('tower-upgraded', this.onUpgraded);
    this.listen('upgrade-refused', this.onUpgradeRefused);
    this.listen('power-changed', this.setPower);
    this.listen('boss-spawned', () => this.banner('Le Monstre Blanc approaches!', 'Sugar-free. Ice-cold. Enormous.'));
    this.listen('buff-added', (wine) => this.banner(`Buff: ${wine.name}`, describeEffect(wine.effect).replace('\n', ', ')));
    this.listen('game-over', () => {
      this.input.enabled = false; // nothing clickable during the fade-out
      this.cameras.main.fadeOut(400, 18, 10, 13);
    });

    this.input.keyboard.on('keydown-ESC', this.closeUpgrade, this);
    this.events.once('shutdown', () => {
      for (const [name, fn] of this.listeners) this.game$.off(name, fn, this);
      this.listeners = [];
      this.input.keyboard.off('keydown-ESC', this.closeUpgrade, this);
    });
    // first styling after the entrance slide so the two don't fight over y
    this.time.delayedCall(480, () => this.refreshCards(true));
    this.cardsReady = false;
  }

  // One live tween per (object, slot): a new one stops the previous.
  to(obj, slot, props) {
    obj.__tw ??= {};
    obj.__tw[slot]?.stop();
    obj.__tw[slot] = this.tweens.add({ targets: obj, ...props });
  }

  listen(name, fn) {
    this.game$.on(name, fn, this);
    this.listeners.push([name, fn]);
  }

  emit(name, ...args) {
    this.game$.emit(name, ...args);
  }

  // ---------- top: grapes (left), wave + Grand Cru lives (right) ----------
  createTop() {
    const g = this.add.container(16, 12);
    const p = panel(this, 0, 0, 196, 66).setOrigin(0);
    const icon = grapeIcon(this, 40, 36, 1.25);
    const label = this.add.text(70, 15, 'Grapes', body(16, PALETTE.burgundy));
    this.grapesText = this.add.text(70, 29, String(this.grapes), serif(26));
    this.grapesFlash = this.add.rectangle(4, 4, 188, 58, COLORS.wineRed, 1).setOrigin(0).setAlpha(0);
    g.add([p, icon, label, this.grapesText, this.grapesFlash]);
    this.grapesPanel = g;
    enter(this, g, { dy: -24, duration: 280 });

    const r = this.add.container(1264 - 318, 12);
    const rp = panel(this, 0, 0, 318, 66).setOrigin(0);
    const waveLabel = this.add.text(22, 15, 'Wave', body(16, PALETTE.burgundy));
    this.waveText = this.add.text(22, 29, '', serif(26));
    const rule = this.add.rectangle(142, 33, 1.5, 38, COLORS.burgundy, 0.6);
    const bottle = this.add.image(176, 36, 'grand-cru').setScale(0.42);
    const livesLabel = this.add.text(198, 15, 'Grand Cru', body(16, PALETTE.burgundy));
    this.livesText = this.add.text(198, 29, String(this.lives), serif(26));
    this.livesFlash = this.add.rectangle(4, 4, 310, 58, COLORS.wineRed, 1).setOrigin(0).setAlpha(0);
    r.add([rp, waveLabel, this.waveText, rule, bottle, livesLabel, this.livesText, this.livesFlash]);
    this.bottle = bottle;
    this.livesPanel = r;
    this.updateWaveText();
    enter(this, r, { dy: -24, delay: 60, duration: 280 });
  }

  updateWaveText() {
    this.waveText.setText(`${Math.max(1, this.wave)} / ${WAVES.length}`);
  }

  // Grapes counter rolls to the new value; gains pulse gold.
  onGrapes(n) {
    const from = this.shownGrapes;
    this.grapes = n;
    this.refreshCards();
    this.refreshUpgrade();
    if (this.grapesCounter) this.grapesCounter.stop();
    this.grapesCounter = this.tweens.addCounter({
      from, to: n, duration: 320, ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        this.shownGrapes = Math.round(tw.getValue());
        this.grapesText.setText(String(this.shownGrapes));
      },
    });
    if (n > from) {
      this.tweens.killTweensOf(this.grapesText);
      this.grapesText.setScale(1).setColor(INK);
      this.tweens.add({ targets: this.grapesText, scale: 1.12, duration: 110, yoyo: true, ease: 'Sine.easeOut' });
    }
  }

  onLives(n) {
    const lost = n < this.lives;
    this.lives = n;
    this.livesText.setText(String(n));
    if (!lost) return;
    this.flash(this.livesFlash);
    this.tweens.killTweensOf(this.bottle);
    this.bottle.setAngle(0);
    this.tweens.add({ targets: this.bottle, angle: 12, duration: 50, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => this.bottle.setAngle(0) });
  }

  onWaveStarted(i) {
    this.wave = i + 1;
    this.waveRunning = true;
    this.updateWaveText();
    this.nextBtn.setEnabled(false);
    this.banner(`Wave ${i + 1}`, i === WAVES.length - 1 ? 'Le Monstre Blanc stirs' : `of ${WAVES.length}`);
  }

  onWaveCleared(i) {
    this.waveRunning = false;
    if (i < WAVES.length - 1) {
      this.nextBtn.setEnabled(true);
      this.banner(`Wave ${i + 1} cleared`, 'Build, then call the next wave');
    }
  }

  flash(rect) {
    this.tweens.killTweensOf(rect);
    rect.setAlpha(0.7);
    this.tweens.add({ targets: rect, alpha: 0, delay: 120, duration: 480, ease: 'Cubic.easeIn' });
  }

  // ---------- bottom bar: tower cards, Taureau Rouge, Next wave ----------
  createBar() {
    // soft dark strip so the bar reads over the floor (not interactive)
    const strip = this.add.graphics();
    strip.fillGradientStyle(0x120a0d, 0x120a0d, 0x120a0d, 0x120a0d, 0, 0, 0.8, 0.8).fillRect(0, 598, 1280, 122);
    enter(this, strip, { duration: 300 });

    this.cards = {};
    Object.entries(TOWERS).forEach(([type, cfg], i) => {
      const x = 24 + CARD_W / 2 + i * (CARD_W + 10);
      const c = this.add.container(x, CARD_Y);
      const glow = this.add.image(0, 0, 'light-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.amber)
        .setDisplaySize(CARD_W * 1.6, CARD_H * 2.6).setAlpha(0);
      const bg = panel(this, 0, 0, CARD_W, CARD_H);
      const ring = this.add.graphics();
      ring.lineStyle(3, COLORS.amber, 1).strokeRoundedRect(-CARD_W / 2 + 1, -CARD_H / 2 + 1, CARD_W - 2, CARD_H - 2, 9);
      ring.setAlpha(0);
      const icon = this.add.image(-50, 2, `tower-${type}`);
      icon.setScale(56 / Math.max(icon.width, icon.height));
      const name = fitText(this.add.text(-20, -26, cfg.name, serif(14)), 92);
      const grape = grapeIcon(this, -12, 16, 0.62);
      const cost = this.add.text(-2, 3, String(cfg.cost), body(22, PALETTE.burgundy));
      const flash = this.add.rectangle(0, 0, CARD_W - 8, CARD_H - 8, COLORS.wineRed, 1).setAlpha(0);
      const hit = this.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      c.add([glow, bg, ring, icon, name, grape, cost, flash, hit]);
      c.baseX = x;
      Object.assign(c, { type, glow, ring, icon, cost, grape, flash, hover: false, dimmable: [bg, icon, name, grape, cost] });
      hit.on('pointerover', () => { c.hover = true; this.styleCard(c); });
      hit.on('pointerout', () => { c.hover = false; this.styleCard(c); });
      hit.on('pointerdown', () => {
        this.closeUpgrade();
        this.emit('select-tower', type);
      });
      this.cards[type] = c;
      enter(this, c, { dy: 40, delay: 80 + i * 50, duration: 280 });
    });

    this.nextBtn = button(this, 1160, CARD_Y, 190, 60, 'Next wave', () => this.emit('start-wave'), { size: 24 });
    enter(this, this.nextBtn, { dy: 40, delay: 320, duration: 280 });
  }

  cardState(type) {
    if (type === 'thomas' && this.thomasPlaced) return 'placed';
    return this.grapes >= TOWERS[type].cost ? 'ok' : 'poor';
  }

  styleCard(c) {
    const state = this.cardState(c.type);
    const sel = this.selected === c.type;
    const dim = state !== 'ok' && !sel;
    c.icon.setTint(dim ? 0x8a8078 : 0xffffff);
    c.cost.setText(state === 'placed' ? 'On duty' : String(TOWERS[c.type].cost));
    c.cost.setColor(state === 'poor' ? '#7a5a50' : PALETTE.burgundy);
    c.grape.setVisible(state !== 'placed');
    c.cost.x = state === 'placed' ? -20 : -2;
    if (!this.cardsReady) return;
    const lift = sel ? -10 : c.hover && state === 'ok' ? -4 : 0;
    this.to(c, 'y', { y: CARD_Y + lift, duration: 160, ease: 'Sine.easeOut' });
    this.to(c.ring, 'a', { alpha: sel ? 1 : 0, duration: 160 });
    this.to(c.glow, 'a', { alpha: sel ? 0.5 : c.hover && state === 'ok' ? 0.25 : 0, duration: 180 });
    for (const o of c.dimmable) this.to(o, 'a', { alpha: dim ? 0.55 : 1, duration: 180 });
  }

  refreshCards(initial) {
    if (initial === true) this.cardsReady = true;
    for (const c of Object.values(this.cards)) this.styleCard(c);
  }

  onSelected(type) {
    this.selected = type;
    this.refreshCards();
  }

  onPlaced(placed) {
    if (placed.type === 'thomas') this.thomasPlaced = true;
    this.refreshCards();
  }

  onRefused(reason) {
    const c = this.cards[this.selected];
    if (c) {
      shake(this, c, c.baseX); // kills c's tweens: restyle after
      c.__tw = {};
      this.flash(c.flash);
      this.styleCard(c);
    }
    if (reason === 'grapes') {
      shake(this, this.grapesPanel, 16);
      this.flash(this.grapesFlash);
    }
    this.showToast(TOAST[reason] || 'Cannot build there');
  }

  banner(title, sub) {
    this.bannerChain?.stop();
    if (this.bannerBox) this.bannerBox.destroy();
    const b = this.add.container(640, 236);
    const t = this.add.text(0, -12, title, serif(30)).setOrigin(0.5);
    const s = this.add.text(0, 22, sub, body(18, PALETTE.burgundy)).setOrigin(0.5);
    const p = panel(this, 0, 0, Math.max(340, t.width + 70, s.width + 70), 92); // long titles (boss, buffs) widen it
    b.add([p, t, s]);
    this.bannerBox = b;
    b.setAlpha(0).setScale(0.92);
    this.bannerChain = this.tweens.chain({
      targets: b,
      tweens: [
        { alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' },
        { alpha: 0, y: 220, duration: 300, delay: 1300, ease: 'Sine.easeIn' },
      ],
      onComplete: () => b.destroy(),
    });
  }

  createToast() {
    const t = this.add.container(640, 588).setAlpha(0);
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, '', body(20, PALETTE.parchment)).setOrigin(0.5);
    t.add([bg, text]);
    t.text = text;
    t.bg = bg;
    return t;
  }

  showToast(msg) {
    const t = this.toast;
    t.text.setText(msg);
    const w = t.text.width + 36;
    t.bg.clear().fillStyle(COLORS.burgundy, 0.95).fillRoundedRect(-w / 2, -17, w, 34, 17)
      .lineStyle(1.5, COLORS.candleGold, 0.9).strokeRoundedRect(-w / 2, -17, w, 34, 17);
    this.toastChain?.stop();
    this.tweens.killTweensOf(t);
    t.y = 598;
    this.toastChain = this.tweens.chain({
      targets: t,
      tweens: [
        { alpha: 1, y: 588, duration: 180, ease: 'Cubic.easeOut' },
        { alpha: 0, duration: 300, delay: 1100 },
      ],
    });
  }

  // ---------- Taureau Rouge power button (Task 9 drives it) ----------
  // Game emits 'power-changed' { ready, active, fraction } where fraction is
  // 0..1 charged (1 = ready). Click emits 'activate-power'.
  createPower() {
    const x = 990, y = CARD_Y - 6, r = 34;
    const c = this.add.container(x, y);
    const glow = this.add.image(0, 0, 'light-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.wineRed)
      .setDisplaySize(r * 5, r * 5).setAlpha(0);
    const disc = this.add.graphics();
    disc.fillStyle(0x120a0d, 0.6).fillCircle(2, 4, r);
    disc.fillStyle(0x3d0d14, 1).fillCircle(0, 0, r);
    disc.lineStyle(2.5, COLORS.candleGold, 1).strokeCircle(0, 0, r);
    disc.lineStyle(1, COLORS.candleGold, 0.4).strokeCircle(0, 0, r - 5);
    const can = this.add.image(0, 0, 'taureau-rouge').setScale(0.58);
    const cover = this.add.graphics();
    const label = this.add.text(0, r + 12, 'Taureau Rouge', body(15, PALETTE.candleGold)).setOrigin(0.5);
    label.setShadow(0, 1, '#120a0d', 3, false, true);
    const hit = this.add.zone(0, 0, r * 2, r * 2).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: 0.93, duration: 70, yoyo: true });
      this.emit('activate-power');
    });
    // hover only touches the glow when idle-ready; the active pulse owns it otherwise
    hit.on('pointerover', () => {
      if (!this.power.ready || this.power.active) return;
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: 0.7, duration: 160 });
    });
    hit.on('pointerout', () => {
      if (this.power.active) return;
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: this.power.ready ? 0.35 : 0, duration: 160 });
    });
    c.add([glow, disc, can, cover, label, hit]);
    this.powerUi = { c, glow, can, cover, r };
    this.power = { ready: false, active: false, fraction: 0 };
    enter(this, c, { dy: 40, delay: 280, duration: 280 });
    this.setPower(this.power);
  }

  setPower({ ready = false, active = false, fraction = 0 } = {}) {
    const wasReady = this.power.ready;
    this.power = { ready, active, fraction };
    const { cover, can, glow, r } = this.powerUi;
    cover.clear();
    if (!ready && fraction < 1) {
      // dark wedge over the not-yet-charged part, sweeping clockwise from 12
      const start = -Math.PI / 2 + Math.PI * 2 * fraction;
      cover.fillStyle(0x120a0d, 0.5).slice(0, 0, r - 1, start, Math.PI * 1.5, false).fillPath();
      if (fraction > 0) {
        // charged part of the rim glows amber
        cover.lineStyle(4, COLORS.amber, 1).beginPath().arc(0, 0, r - 1, -Math.PI / 2, start, false).strokePath();
      }
    }
    can.setTint(ready || active ? 0xffffff : 0xe0d4cc);
    if (ready && !wasReady) {
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: 0.35, duration: 250 });
    }
    if (active) {
      this.tweens.killTweensOf(glow);
      glow.setAlpha(0.8);
      this.tweens.add({ targets: glow, alpha: 0.3, duration: 260, yoyo: true, repeat: -1 });
    } else if (!ready) {
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: 0, duration: 200 });
    }
  }

  // ---------- upgrade panel ----------
  openUpgrade(placed) {
    this.closeUpgrade(true);
    const spot = BUILD_SPOTS.find((s) => s.id === placed.spotId);
    const W = 280, H = 168;
    const x = Phaser.Math.Clamp(spot.x, W / 2 + 12, 1280 - W / 2 - 12);
    const y = spot.y > 330 ? spot.y - 30 - H / 2 : spot.y + 40 + H / 2;

    // full-screen blocker: an outside click closes the panel and nothing else
    const blocker = this.add.zone(640, 360, 1280, 720).setInteractive();
    blocker.on('pointerdown', () => this.closeUpgrade());

    const c = this.add.container(x, y);
    const bg = panel(this, 0, 0, W, H);
    bg.setInteractive(); // clicks on the panel body are swallowed, not 'outside'
    bg.on('pointerdown', () => {});
    const title = this.add.text(0, -54, '', serif(19)).setOrigin(0.5);
    const level = this.add.text(0, -30, '', body(17, PALETTE.burgundy)).setOrigin(0.5);
    const rule = this.add.rectangle(0, -14, W - 70, 1.5, COLORS.burgundy, 0.55);
    const next = this.add.text(0, 6, '', body(18)).setOrigin(0.5);
    const btn = button(this, 0, 48, 196, 42, '', () => this.emit('upgrade-tower', placed), { size: 17 });
    c.add([bg, title, level, rule, next, btn]);
    this.upgradeFor = placed;
    this.upgradeUi = { c, blocker, title, level, next, btn };
    this.refreshUpgrade();
    c.setScale(0.94);
    this.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });
    enter(this, c, { dy: spot.y > 330 ? 10 : -10, duration: 220 });
  }

  refreshUpgrade() {
    const ui = this.upgradeUi;
    const placed = this.upgradeFor;
    if (!ui || !placed) return;
    const cfg = TOWERS[placed.type];
    const ups = cfg.upgrades;
    ui.title.setText(placed.level === 0 ? cfg.name : ups[placed.level - 1].name);
    fitText(ui.title.setScale(1), 240);
    ui.level.setText(`Level ${placed.level + 1} of ${ups.length + 1}`);
    const up = ups[placed.level];
    if (!up) {
      ui.next.setText('Fully aged, nothing left to add');
      ui.btn.label.setText('Maxed');
      ui.btn.enabled && ui.btn.setEnabled(false);
      return;
    }
    ui.next.setText(`Next: ${up.name}`);
    fitText(ui.next.setScale(1), 240);
    ui.btn.label.setText(`Upgrade for ${up.cost}`);
    const ok = this.grapes >= up.cost;
    if (ok !== ui.btn.enabled) ui.btn.setEnabled(ok);
  }

  onUpgraded(placed) {
    if (!this.upgradeFor || placed.id !== this.upgradeFor.id) return;
    this.refreshUpgrade();
    const t = this.upgradeUi.title;
    this.tweens.add({ targets: t, scaleX: t.scaleX * 1.12, scaleY: t.scaleY * 1.12, duration: 120, yoyo: true });
  }

  onUpgradeRefused(reason) {
    if (!this.upgradeUi) return;
    shake(this, this.upgradeUi.btn, 0);
    if (reason === 'grapes') {
      shake(this, this.grapesPanel, 16);
      this.flash(this.grapesFlash);
    }
    this.showToast(TOAST[reason] || 'Cannot upgrade');
  }

  closeUpgrade(instant = false) {
    const ui = this.upgradeUi;
    if (!ui) return;
    this.upgradeUi = null;
    this.upgradeFor = null;
    ui.blocker.destroy();
    if (instant === true) return ui.c.destroy();
    this.tweens.killTweensOf(ui.c);
    this.tweens.add({ targets: ui.c, alpha: 0, scale: 0.96, duration: 160, onComplete: () => ui.c.destroy() });
  }
}
