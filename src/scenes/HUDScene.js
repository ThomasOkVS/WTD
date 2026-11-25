import Phaser from 'phaser';
import { hdCamera } from '../ui/hd.js';
import { TOWERS, statLine } from '../config/towers.js';
import { towerStats } from '../logic/towers.js';
import { repairCost, sellValue } from '../logic/siege.js';
import { WAVES } from '../config/waves.js';
import { describeWave, waveAt } from '../logic/waves.js';
import { nestPests } from '../logic/nests.js';
import { PALETTE, COLORS } from '../config/palette.js';
import { serif, body, panel, grapeIcon, button, enter, shake, fitText, INK } from '../ui/kit.js';
import { describeEffect } from './TastingScene.js';
import { play, isMuted, setMuted } from '../fx/sound.js';
import { onProjectorChange } from '../fx/projector.js';

const CARD_W = 168, CARD_H = 92, CARD_Y = 664;
const TOAST = {
  grapes: 'Not enough grapes',
  occupied: 'Too close to another tower',
  path: 'Not on the path: build beside it',
  decor: 'Mind the candles and barrels',
  bounds: 'Build inside the cellar',
  unique: 'Thomas is already on duty',
  max: 'Fully upgraded',
  full: 'Not a scratch on it',
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
    hdCamera(this); // HD canvas, same 1280x720 world
    this.game$ = this.scene.get('Game').events;
    this.input.enabled = true; // re-enable after a previous run's game-over
    this.listeners = [];
    this.nestHinted = false; // one nest toast per run
    this.selected = null;
    this.thomasPlaced = false;
    this.endless = false;
    this.shownGrapes = this.grapes;
    this.upgradeFor = null;
    this.upgradeUi = null;
    this.bannerBox = null;
    this.bannerChain = null;
    this.toastChain = null;
    this.tip = null;
    this.powerHover = false;
    this.powerInfo = null;
    this.powerHinted = false;

    this.createTop();
    this.createBar();
    this.createPower();
    this.createMute();
    this.createPauseBtn();
    this.createSpeedBtn();
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
    this.listen('tower-damaged', this.onTowerHp);
    this.listen('tower-repaired', this.onTowerHp);
    this.listen('repair-refused', this.onRepairRefused);
    this.listen('tower-destroyed', this.onTowerDestroyed);
    this.listen('tower-sold', this.onTowerSold);
    this.listen('power-changed', this.setPower);
    this.listen('auto-wave-tick', this.onAutoTick);
    this.listen('endless-started', this.onEndless);
    this.listen('speed-changed', (n) => { this.speed = n; this.speedUi.draw(); });
    this.listen('power-refused', () => this.showToast('Save it for the pests!'));
    this.listen('nest-created', () => {
      if (!this.nestHinted) this.showToast('Destroyed towers become pest nests next wave. Repair in time!', 3200);
      this.nestHinted = true;
      this.refreshPreview(this.preview.visible);
    });
    this.bossBar = this.createBossBar();
    this.listen('boss-spawned', () => this.banner('Le Monstre Blanc approaches!', 'Sugar-free. Ice-cold. Enormous.'));
    this.listen('boss-enraged', () => this.banner('Le Monstre Blanc is furious!', 'Sugar rush incoming'));
    this.listen('buff-added', (wine) => this.banner(`Buff: ${wine.name}`, describeEffect(wine.effect).replace('\n', ', ')));
    this.listen('game-over', () => {
      this.input.enabled = false; // nothing clickable during the fade-out
      this.cameras.main.fadeOut(400, 18, 10, 13);
    });

    // Esc is Game's (onEsc): cancel placement, then close this panel, then pause.
    const offProjector = onProjectorChange((on) => this.showToast(on ? 'Projector mode on' : 'Projector mode off'));
    this.events.once('shutdown', () => {
      offProjector();
      for (const [name, fn] of this.listeners) this.game$.off(name, fn, this);
      this.listeners = [];
    });
    // first styling after the entrance slide so the two don't fight over y
    this.time.delayedCall(480, () => this.refreshCards(true));
    this.buildHint = null;
    this.time.delayedCall(900, () => this.showBuildHint());
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
    this.endlessTag = this.add.text(0, 40, 'Endless', body(16, PALETTE.wineRed ?? PALETTE.burgundy)).setVisible(false);
    const rule = this.add.rectangle(142, 33, 1.5, 38, COLORS.burgundy, 0.6);
    const bottle = this.add.image(176, 36, 'grand-cru').setScale(0.42);
    const livesLabel = this.add.text(198, 15, 'Grand Cru', body(16, PALETTE.burgundy));
    this.livesText = this.add.text(198, 29, String(this.lives), serif(26));
    this.livesFlash = this.add.rectangle(4, 4, 310, 58, COLORS.wineRed, 1).setOrigin(0).setAlpha(0);
    r.add([rp, waveLabel, this.waveText, this.endlessTag, rule, bottle, livesLabel, this.livesText, this.livesFlash]);
    this.bottle = bottle;
    this.livesPanel = r;
    this.updateWaveText();
    enter(this, r, { dy: -24, delay: 60, duration: 280 });
  }

  // Small speaker toggle next to the grapes panel; M does the same (main.js).
  createMute() {
    const c = this.add.container(244, 45);
    const g = this.add.graphics();
    const hit = this.add.zone(0, 0, 40, 40).setInteractive({ useHandCursor: true });
    c.add([g, hit]);
    this.muteUi = { c, g, hover: false, shown: null };
    hit.on('pointerdown', () => {
      setMuted(!isMuted());
      play('click');
      this.tweens.add({ targets: c, scale: 0.9, duration: 70, yoyo: true });
    });
    hit.on('pointerover', () => { this.muteUi.hover = true; this.drawMute(); });
    hit.on('pointerout', () => { this.muteUi.hover = false; this.drawMute(); });
    this.drawMute();
    enter(this, c, { dy: -24, delay: 120, duration: 280 });
  }

  // Round icon button in the mute button's style (pause, speed). draw(g, hover) paints the icon.
  roundBtn(x, delay, tipTitle, tipLine, onClick, drawIcon) {
    const c = this.add.container(x, 45);
    const g = this.add.graphics();
    const hit = this.add.zone(0, 0, 40, 40).setInteractive({ useHandCursor: true });
    c.add([g, hit]);
    const ui = { c, g, hover: false };
    ui.draw = () => {
      g.clear();
      g.fillStyle(0x120a0d, 0.55).fillCircle(1, 3, 19);
      g.fillStyle(ui.hover ? 0x5a1420 : 0x3d0d14, 1).fillCircle(0, 0, 19);
      g.lineStyle(2, COLORS.candleGold, ui.hover ? 1 : 0.85).strokeCircle(0, 0, 19);
      drawIcon(g, ui);
    };
    hit.on('pointerdown', () => {
      play('click');
      this.tweens.add({ targets: c, scale: 0.9, duration: 70, yoyo: true });
      onClick();
    });
    hit.on('pointerover', () => { ui.hover = true; ui.draw(); this.showTip(x, 80 + 90, tipTitle, tipLine); });
    hit.on('pointerout', () => { ui.hover = false; ui.draw(); this.hideTip(); });
    ui.draw();
    enter(this, c, { dy: -24, delay, duration: 280 });
    return ui;
  }

  createPauseBtn() {
    this.pauseUi = this.roundBtn(292, 150, 'Pause (P)', 'Resume, restart or go back to the title.', () => {
      this.hideTip(true);
      this.emit('pause');
    }, (g) => {
      g.fillStyle(COLORS.candleGold, 1).fillRect(-7, -8, 5, 16).fillRect(2, -8, 5, 16);
    });
  }

  createSpeedBtn() {
    this.speed = 1;
    this.speedUi = this.roundBtn(340, 180, 'Speed (F)', 'Cycle 1x / 2x / 3x. Everything in the cellar runs that much faster.', () => {
      this.emit('toggle-speed');
    }, (g, ui) => {
      const fast = this.speed > 1;
      if (fast) g.lineStyle(this.speed >= 3 ? 4 : 3, this.speed >= 3 ? 0xd01a3a : COLORS.amber, 1).strokeCircle(0, 0, 22); // 3x: red ring
      if (!ui.label) {
        ui.label = this.add.text(0, 1, '', serif(18, PALETTE.candleGold)).setOrigin(0.5);
        ui.c.addAt(ui.label, 1);
      }
      ui.label.setText(`${this.speed}×`);
    });
  }

  drawMute() {
    const { g, hover } = this.muteUi;
    const muted = isMuted();
    this.muteUi.shown = muted;
    const gold = COLORS.candleGold;
    g.clear();
    g.fillStyle(0x120a0d, 0.55).fillCircle(1, 3, 19);
    g.fillStyle(hover ? 0x5a1420 : 0x3d0d14, 1).fillCircle(0, 0, 19);
    g.lineStyle(2, gold, hover ? 1 : 0.85).strokeCircle(0, 0, 19);
    // speaker body + cone
    g.fillStyle(gold, 1).fillRect(-10, -4, 5, 8);
    g.fillTriangle(-6, -1, 2, -9, 2, 9).fillRect(-6, -4, 8, 8);
    if (muted) {
      g.lineStyle(2.5, COLORS.wineRed, 1).lineBetween(5, -5, 12, 5).lineBetween(12, -5, 5, 5);
    } else {
      g.lineStyle(2, gold, 1);
      g.beginPath().arc(3, 0, 6, -0.9, 0.9).strokePath();
      g.beginPath().arc(3, 0, 11, -0.9, 0.9).strokePath();
    }
  }

  update() {
    if (this.muteUi && this.muteUi.shown !== isMuted()) this.drawMute(); // M key toggles it too
    this.updateBossBar();
  }

  // ---------- boss health bar: top centre, tracks the newest living boss ----------
  createBossBar() {
    const W = 560, H = 16;
    const c = this.add.container(640, 104).setAlpha(0).setVisible(false);
    const frame = this.add.graphics();
    frame.fillStyle(0x120a0d, 0.85).fillRoundedRect(-W / 2 - 6, -H / 2 - 6, W + 12, H + 12, 6);
    frame.lineStyle(2, 0xe9dcc0, 1).strokeRoundedRect(-W / 2 - 6, -H / 2 - 6, W + 12, H + 12, 6);
    const fill = this.add.graphics();
    const label = this.add.text(0, -24, 'Le Monstre Blanc', serif(18, PALETTE.parchment)).setOrigin(0.5);
    label.setShadow(0, 2, '#120a0d', 4, false, true);
    c.add([frame, fill, label]);
    return { c, fill, W, H, shown: 0, boss: null, on: false };
  }

  updateBossBar() {
    const bar = this.bossBar;
    const enemies = this.scene.get('Game')?.enemies || [];
    let boss = null;
    for (const e of enemies) if (e.boss && e.alive && !e.recruited) boss = e; // newest living boss
    if (!boss) {
      if (bar.on) {
        bar.on = false;
        this.to(bar.c, 'show', { alpha: 0, duration: 300, onComplete: () => bar.c.setVisible(false) });
      }
      return;
    }
    if (!bar.on) {
      bar.on = true;
      bar.shown = 1;
      bar.c.setVisible(true);
      this.to(bar.c, 'show', { alpha: 1, duration: 300 });
    }
    const f = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    bar.shown += (f - bar.shown) * 0.15; // smooth slide toward the real value
    const { W, H } = bar;
    bar.fill.clear()
      .fillStyle(boss.enraged ? 0xff2a40 : COLORS.burgundy, 1).fillRect(-W / 2, -H / 2, W * bar.shown, H)
      .fillStyle(0xffffff, 0.18).fillRect(-W / 2, -H / 2, W * bar.shown, H / 3);
  }

  updateWaveText() {
    const past = this.wave > WAVES.length;
    this.waveText.setText(past ? String(this.wave) : `${Math.max(1, this.wave)} / ${WAVES.length}`);
    this.endlessTag.setVisible(past).setX(this.waveText.x + this.waveText.width + 8);
  }

  onEndless() {
    this.endless = true;
    this.nextBtn.setEnabled(true);
    this.refreshPreview(true);
    this.banner('Endless cellar', 'The pests keep coming, tougher every wave');
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
    this.updateWaveText();
    this.nextBtn.setEnabled(false);
    this.onAutoTick(null);
    this.refreshPreview(false);
    if (i >= WAVES.length) this.banner(`Endless wave ${i + 1}`, describeWave(waveAt(i)));
    else this.banner(`Wave ${i + 1}`, i === WAVES.length - 1 ? 'Le Monstre Blanc stirs' : `of ${WAVES.length}`);
    if (!this.powerHinted && this.power.ready) {
      this.powerHinted = true; // first wave of the run, whichever number it is
      this.time.delayedCall(1700, () => this.showToast('Taureau Rouge is charged: click the can for double fire rate!', 3200));
    }
  }

  onWaveCleared(i) {
    if (i !== WAVES.length - 1 || this.endless) {
      this.refreshPreview(true);
      this.nextBtn.setEnabled(true);
      // Game opens the tasting right after emitting this: wait a tick and skip
      // the banner if it did, so it doesn't draw over the tasting's title
      this.time.delayedCall(0, () => {
        if (!this.scene.get('Game').tastingOpen) this.banner(`Wave ${i + 1} cleared`, 'Build, then call the next wave');
      });
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
    // cheapest first; sorted at build time so retuned prices reorder themselves
    const byCost = Object.entries(TOWERS).sort(([, a], [, b]) => a.cost - b.cost);
    byCost.forEach(([type, cfg], i) => {
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
      hit.on('pointerover', () => {
        c.hover = true;
        this.styleCard(c);
        this.showTip(x, CARD_Y - CARD_H / 2 - 10, cfg.name, cfg.blurb, statLine(towerStats({ type, level: 0 })));
      });
      hit.on('pointerout', () => { c.hover = false; this.styleCard(c); this.hideTip(); });
      hit.on('pointerdown', () => {
        this.hideTip();
        play('click');
        this.closeUpgrade();
        this.emit('select-tower', type);
      });
      this.cards[type] = c;
      enter(this, c, { dy: 40, delay: 80 + i * 50, duration: 280 });
    });

    this.nextBtn = button(this, 1160, CARD_Y, 190, 60, 'Next wave', () => this.emit('start-wave'), { size: 24 });
    enter(this, this.nextBtn, { dy: 40, delay: 320, duration: 280 });
    this.createPreview();
  }

  // ---------- next-wave preview + Auto toggle (just above Next wave) ----------
  createPreview() {
    const y = 584;
    this.preview = this.add.text(1172, y, '', body(18, PALETTE.parchment)).setOrigin(1, 0.5);
    this.preview.setShadow(0, 2, '#120a0d', 4, false, true);
    // Auto chip: checkbox + label; the setting lives in the registry so it survives restarts
    const c = this.add.container(1218, y);
    const g = this.add.graphics();
    const label = this.add.text(-10, 0, 'Auto', body(18, PALETTE.candleGold)).setOrigin(0, 0.5);
    label.setShadow(0, 2, '#120a0d', 4, false, true);
    const hit = this.add.zone(10, 0, 76, 28).setInteractive({ useHandCursor: true });
    c.add([g, label, hit]);
    this.autoUi = { c, g, hover: false };
    hit.on('pointerdown', () => {
      play('click');
      this.emit('toggle-auto');
      this.drawAuto();
    });
    hit.on('pointerover', () => {
      this.autoUi.hover = true; this.drawAuto();
      this.showTip(1160, y - 20, 'Auto next wave', 'The next wave starts 3s after a wave is cleared.');
    });
    hit.on('pointerout', () => { this.autoUi.hover = false; this.drawAuto(); this.hideTip(); });
    this.drawAuto();
    this.refreshPreview(true);
    enter(this, this.preview, { dy: 20, delay: 360, duration: 280 });
    enter(this, c, { dy: 20, delay: 380, duration: 280 });
  }

  drawAuto() {
    const { g, hover } = this.autoUi;
    const on = !!this.registry.get('autoWave');
    g.clear();
    g.fillStyle(0x3d0d14, 1).fillRoundedRect(-30, -9, 18, 18, 4);
    g.lineStyle(2, COLORS.candleGold, hover ? 1 : 0.8).strokeRoundedRect(-30, -9, 18, 18, 4);
    if (on) g.lineStyle(3, COLORS.amber, 1).lineBetween(-26, 0, -22, 5).lineBetween(-22, 5, -15, -5);
  }

  // Description of the wave the Next wave button would start, or null.
  nextWaveText() {
    if (this.wave >= WAVES.length && !this.endless) return null;
    const nests = this.scene.get('Game')?.state?.nests ?? [];
    const fromNests = nests.length ? ` · Nests +${nestPests(nests)}` : '';
    return `Next: ${describeWave(waveAt(this.wave))}${fromNests}`;
  }

  refreshPreview(show) {
    const text = show ? this.nextWaveText() : null;
    this.preview.setText(text || '').setVisible(!!text);
    fitText(this.preview.setScale(1), 300);
  }

  onAutoTick(n) {
    const label = this.nextBtn.label;
    label.setText(n == null ? 'Next wave' : `Next wave in ${n}…`);
    fitText(label.setScale(1), 168);
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

  // First 10 seconds teach the core verb: pulse the cheapest card and say what
  // to do, until the first tower goes down (or a wave starts). Once per run.
  showBuildHint() {
    const gs = this.scene.get('Game');
    if (this.wave > 0 || !gs || gs.towers?.length) return;
    const type = Object.keys(this.cards).sort((a, b) => TOWERS[a].cost - TOWERS[b].cost)[0];
    const card = this.cards[type];
    if (!card) return;
    const ring = this.add.graphics({ x: card.x, y: CARD_Y });
    ring.lineStyle(4, 0xffb35c, 1).strokeRoundedRect(-CARD_W / 2 - 6, -CARD_H / 2 - 6, CARD_W + 12, CARD_H + 12, 12);
    ring.setAlpha(0);
    this.tweens.add({ targets: ring, alpha: 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const tip = this.add.container(card.x + 150, CARD_Y - CARD_H / 2 - 40);
    const text = this.add.text(0, 0, 'Pick a tower, then click the cellar floor', body(20)).setOrigin(0.5);
    tip.add([panel(this, 0, 0, text.width + 48, 46), text]);
    enter(this, tip, { dy: 10, duration: 300 });
    this.buildHint = { ring, tip };
    this.listen('wave-started', this.hideBuildHint);
  }

  hideBuildHint() {
    const h = this.buildHint;
    if (!h) return;
    this.buildHint = null;
    this.tweens.killTweensOf(h.ring);
    this.tweens.add({ targets: [h.ring, h.tip], alpha: 0, duration: 250, onComplete: () => { h.ring.destroy(); h.tip.destroy(); } });
  }

  onPlaced(placed) {
    this.hideBuildHint();
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

  showToast(msg, hold = 1100) {
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
        { alpha: 0, duration: 300, delay: hold },
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
      this.powerHover = true;
      this.showPowerTip();
      if (!this.power.ready || this.power.active) return;
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: 0.7, duration: 160 });
    });
    hit.on('pointerout', () => {
      this.powerHover = false;
      this.hideTip();
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

  setPower({ ready = false, active = false, fraction = 0, secondsLeft = 0, frozen = false } = {}) {
    this.powerInfo = { ready, active, secondsLeft, frozen };
    if (this.powerHover) this.showPowerTip();
    const wasReady = this.power.ready;
    const wasActive = this.power.active;
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
    if (active && !wasActive) {
      this.tweens.killTweensOf(glow);
      glow.setAlpha(0.8);
      this.tweens.add({ targets: glow, alpha: 0.3, duration: 260, yoyo: true, repeat: -1 });
    } else if (!active && wasActive && !ready) {
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: 0, duration: 200 });
    } else if (!active && !ready && wasReady) {
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: 0, duration: 200 });
    }
  }

  // ---------- hover tooltips (cards, Taureau Rouge) ----------
  // A standalone parchment label whose bottom edge sits at (x, bottom); not a
  // child of the card, so the card's lift/shake tweens never drag it along.
  showTip(x, bottom, title, line, stats) {
    this.hideTip(true);
    const W = 272, PAD = 16;
    const c = this.add.container(0, 0).setDepth(50);
    const t = this.add.text(0, 0, title, serif(16)).setOrigin(0.5, 0);
    const l = this.add.text(0, 0, line, body(17, INK, { wordWrap: { width: W - PAD * 2 }, align: 'center' })).setOrigin(0.5, 0);
    const st = stats ? this.add.text(0, 0, stats, body(15, PALETTE.burgundy, { wordWrap: { width: W - PAD * 2 }, align: 'center' })).setOrigin(0.5, 0) : null;
    const H = PAD + t.height + 2 + l.height + (st ? 4 + st.height : 0) + PAD - 2;
    let y = -H / 2 + PAD - 2;
    t.y = y; y += t.height + 2;
    l.y = y; y += l.height + 4;
    if (st) st.y = y;
    c.add([panel(this, 0, 0, W, H), t, l, ...(st ? [st] : [])]);
    c.setPosition(Phaser.Math.Clamp(x, W / 2 + 8, 1280 - W / 2 - 8), bottom - H / 2);
    c.ui = { t, l, st };
    this.tip = c;
    enter(this, c, { dy: 8, duration: 180 });
    return c;
  }

  hideTip(instant = false) {
    const c = this.tip;
    if (!c) return;
    this.tip = null;
    this.tweens.killTweensOf(c);
    if (instant === true) return c.destroy();
    this.tweens.add({ targets: c, alpha: 0, duration: 120, onComplete: () => c.destroy() });
  }

  powerStateText() {
    const p = this.powerInfo || {};
    if (p.active) return `Active: ${p.secondsLeft}s left`;
    if (p.ready) return 'Ready: click it while a wave is running';
    return `Recharging: ${p.secondsLeft}s${p.frozen ? ' (paused between waves)' : ''}`;
  }

  // Built once on hover, then only its state line is rewritten (~10 Hz).
  showPowerTip() {
    const text = this.powerStateText();
    if (this.tip?.power) {
      if (this.tip.ui.st.text !== text) this.tip.ui.st.setText(text);
      return;
    }
    const { x, y } = this.powerUi.c;
    const tip = this.showTip(x, y - this.powerUi.r - 10, 'Taureau Rouge Grand Cru',
      'All towers fire twice as fast for 10s, then it recharges for 45s.', text);
    tip.power = true;
  }

  // ---------- upgrade panel ----------
  openUpgrade(placed) {
    this.closeUpgrade(true);
    const spot = { x: placed.x, y: placed.y };
    const W = 280, TOP = 118, BOTTOM = 168; // panel extent around the container's origin (Sell row added below)
    const x = Phaser.Math.Clamp(spot.x, W / 2 + 12, 1280 - W / 2 - 12);
    const y = Phaser.Math.Clamp(spot.y > 330 ? spot.y - 30 - BOTTOM : spot.y + 40 + TOP, TOP + 8, 712 - BOTTOM);

    // full-screen blocker: an outside click closes the panel and nothing else
    const blocker = this.add.zone(640, 360, 1280, 720).setInteractive();
    blocker.on('pointerdown', () => this.closeUpgrade());

    const c = this.add.container(x, y);
    const bg = panel(this, 0, (BOTTOM - TOP) / 2, W, TOP + BOTTOM);
    bg.setInteractive(); // clicks on the panel body are swallowed, not 'outside'
    bg.on('pointerdown', () => {});
    const title = this.add.text(0, -88, '', serif(19)).setOrigin(0.5);
    const level = this.add.text(0, -64, '', body(17, PALETTE.burgundy)).setOrigin(0.5);
    const hp = this.add.text(0, -42, '', body(16)).setOrigin(0.5);
    const hpBar = this.add.graphics();
    const rule = this.add.rectangle(0, -12, W - 70, 1.5, COLORS.burgundy, 0.55);
    const next = this.add.text(0, 0, '', body(18)).setOrigin(0.5);
    const effect = this.add.text(0, 19, '', body(14, PALETTE.burgundy)).setOrigin(0.5);
    const btn = button(this, 0, 52, 196, 40, '', () => this.emit('upgrade-tower', placed), { size: 17 });
    // never disabled: a refused repair still gets its shake + toast
    const repair = button(this, 0, 100, 196, 38, '', () => this.emit('repair-tower', placed), { size: 16, variant: 'secondary' });
    // two-step: "Sell for N" -> "Sure? +N" for 3 s -> sold
    const sell = button(this, 0, 145, 196, 36, '', () => this.onSellClick(), { size: 16, variant: 'danger' });
    const close = this.add.text(W / 2 - 22, -TOP + 22, '×', serif(26, PALETTE.burgundy)).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeUpgrade());
    close.on('pointerover', () => close.setScale(1.2));
    close.on('pointerout', () => close.setScale(1));
    c.add([bg, title, level, hp, hpBar, rule, next, effect, btn, repair, sell, close]);
    this.upgradeFor = placed;
    this.upgradeUi = { c, blocker, title, level, hp, hpBar, next, effect, btn, repair, sell, sellArmed: null };
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
    this.refreshHp();
    const up = ups[placed.level];
    if (!up) {
      ui.next.setText('Fully upgraded');
      ui.effect.setText('Fully aged, nothing left to add');
      ui.btn.label.setText('Maxed');
      ui.btn.enabled && ui.btn.setEnabled(false);
      return;
    }
    ui.next.setText(`Next: ${up.name}`);
    fitText(ui.next.setScale(1), 240);
    ui.effect.setText(statLine(towerStats({ type: placed.type, level: placed.level + 1 })));
    fitText(ui.effect.setScale(1), 250);
    ui.btn.label.setText(`Upgrade for ${up.cost}`);
    const ok = this.grapes >= up.cost;
    if (ok !== ui.btn.enabled) ui.btn.setEnabled(ok);
  }

  refreshHp() {
    const ui = this.upgradeUi;
    const placed = this.upgradeFor;
    if (!ui || !placed) return;
    const max = towerStats(placed).maxHp;
    const hp = Math.max(0, Math.round(placed.hp));
    const f = Math.max(0, Math.min(1, hp / max));
    ui.hp.setText(`HP ${hp} / ${max}`);
    const w = 120, h = 6;
    ui.hpBar.clear().fillStyle(0x120a0d, 0.8).fillRect(-w / 2 - 1, -27, w + 2, h + 2);
    ui.hpBar.fillStyle(f > 0.5 ? 0x8fd16a : f > 0.25 ? 0xffb35c : 0xd01a3a, 1).fillRect(-w / 2, -26, w * f, h);
    const cost = repairCost(placed);
    ui.repair.label.setText(cost > 0 ? `Repair for ${cost}` : 'No scratches');
    ui.repair.setAlpha(cost > 0 && this.grapes >= cost ? 1 : 0.55);
    if (!ui.sellArmed) ui.sell.label.setText(`Sell for ${sellValue(placed)}`);
  }

  onSellClick() {
    const ui = this.upgradeUi;
    const placed = this.upgradeFor;
    if (!ui || !placed) return;
    if (ui.sellArmed) {
      ui.sellArmed.remove();
      ui.sellArmed = null;
      this.emit('sell-tower', placed);
      return;
    }
    ui.sell.label.setText(`Sure? +${sellValue(placed)}`);
    ui.sellArmed = this.time.delayedCall(3000, () => {
      if (this.upgradeUi !== ui) return;
      ui.sellArmed = null;
      this.refreshHp();
    });
  }

  onTowerSold(placed) {
    if (this.upgradeFor?.id === placed.id) this.closeUpgrade();
    if (placed.type === 'thomas') {
      this.thomasPlaced = false;
      this.refreshCards();
    }
  }

  onTowerHp(placed) {
    if (!this.upgradeFor || placed.id !== this.upgradeFor.id) return;
    this.refreshHp();
  }

  onRepairRefused(reason) {
    if (!this.upgradeUi) return;
    shake(this, this.upgradeUi.repair, 0);
    if (reason === 'grapes') {
      shake(this, this.grapesPanel, 16);
      this.flash(this.grapesFlash);
    }
    this.showToast(TOAST[reason] || 'Cannot repair');
  }

  onTowerDestroyed(placed) {
    if (this.upgradeFor?.id === placed.id) this.closeUpgrade();
    if (placed.type === 'thomas') {
      this.thomasPlaced = false;
      this.refreshCards();
    }
    this.showToast(`${TOWERS[placed.type].name} was destroyed!`);
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
    ui.sellArmed?.remove();
    ui.blocker.destroy();
    if (instant === true) return ui.c.destroy();
    this.tweens.killTweensOf(ui.c);
    this.tweens.add({ targets: ui.c, alpha: 0, scale: 0.96, duration: 160, onComplete: () => ui.c.destroy() });
  }
}
