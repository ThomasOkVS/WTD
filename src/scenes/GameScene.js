import Phaser from 'phaser';
import { PATH } from '../config/map.js';
import { TOWERS } from '../config/towers.js';
import { WAVES } from '../config/waves.js';
import { createPath } from '../logic/path.js';
import { createGameState, earn, loseLives } from '../logic/state.js';
import { canPlace, placeTower, upgradeTower, snap, towerStats } from '../logic/towers.js';
import { recruitSmash } from '../logic/combat.js';
import { buildSchedule, createWaveRunner, waveBonus } from '../logic/waves.js';
import { Enemy } from '../objects/Enemy.js';
import { Tower } from '../objects/Tower.js';
import { drawCellar } from '../fx/cellar.js';
import { ENEMIES } from '../config/enemies.js';
import { createPowerUp } from '../logic/buffs.js';
import { play } from '../fx/sound.js';
import { startDust, shatter, splash, corkPop } from '../fx/particles.js';
import {
  damageTower as hurtTower, removeTower, repairTower, tickAttacker,
} from '../logic/siege.js';

const POWER = { durationMs: 10000, cooldownMs: 45000 };

// Every custom event on this.events (documentation). scene.events survives
// restarts, so each scene removes ONLY its own handlers on shutdown
// (off(name, fn, ctx)); never off(name) here, it would wipe the HUD's too.
// Game -> HUD: grapes-changed, lives-changed, wave-started, wave-cleared,
//   tower-placed, placement-refused, enemy-killed, tower-selected,
//   tower-clicked, tower-upgraded, upgrade-refused, power-changed, power-refused, game-over,
//   boss-spawned, buff-added (wine)
//   tower-damaged, tower-destroyed, tower-repaired, repair-refused (enemies fight back)
// HUD -> Game: start-wave, select-tower, upgrade-tower, repair-tower, activate-power
// Tasting -> Game: tasting-picked (wine)
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    // Fresh run state: everything is (re)initialised here, never in the constructor.
    this.state = createGameState();
    this.path = createPath(PATH);
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.selectedType = null;
    this.runner = null;
    this.waveIndex = -1;
    this.clock = 0; // ms of unpaused scene time
    this.ending = false;
    this.kills = 0;
    this.recruits = [];
    this.tastingOpen = false;
    this.pauseOpen = false;
    // Clock and TweenManager survive restarts: a new run always starts at 1x.
    this.speed = 1;
    this.autoIn = null; // ms until the auto next wave, null = no countdown
    this.autoShown = null;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.powerUp = createPowerUp(POWER); // starts charged: demo it right away
    this.powerEmitAt = 0;
    this.heartbeatIn = 0;
    this.sparkIn = 0;
    this.shakeIn = 0;
    this.wasActive = false;

    this.lighting = drawCellar(this);
    this.createPlacement();
    this.createPowerFx();
    startDust(this);

    this.events.on('start-wave', this.startWave, this);
    this.events.on('select-tower', this.selectTower, this);
    this.events.on('upgrade-tower', this.upgrade, this);
    this.events.on('repair-tower', this.repair, this);
    this.events.on('activate-power', this.activatePower, this);
    this.events.on('tasting-picked', this.onTastingPicked, this);
    this.events.on('pause', this.onPauseClicked, this);
    this.events.on('toggle-speed', this.toggleSpeed, this);
    this.events.on('toggle-auto', this.toggleAuto, this);
    this.input.keyboard.on('keydown-ESC', this.onEsc, this);
    // Presenter keys: work in the production build too, no UI.
    this.input.keyboard.on('keydown', this.onDemoKey, this);
    this.events.once('shutdown', this.cleanup, this);

    // HUD runs in parallel and talks to Game only through this.events.
    // launch() is queued, so starting values go in as data.
    this.scene.launch('HUD', { grapes: this.state.grapes, lives: this.state.lives, wave: this.state.wave });
    this.cameras.main.fadeIn(250, 18, 10, 13);
  }

  // ---------- free placement ----------
  // With a card selected a ghost of the tower (plus its range) follows the
  // pointer, snapped to the grid, and shows whether it may stand there.
  createPlacement() {
    this.rangeRing = this.add.graphics().setDepth(2550); // placement aid: above the darkness
    this.ghost = this.add.image(0, 0, 'tower-cork').setOrigin(0.5, 0.85).setDepth(2551).setAlpha(0.75).setVisible(false);
    this.hoverTower = null;
    this.input.mouse?.disableContextMenu(); // right-click cancels instead
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerDown, this);
  }

  // Pointer over a HUD element (cards, buttons, an open upgrade panel)?
  // HUD runs above Game, so those clicks are the HUD's, never a placement.
  overHud(pointer) {
    if (pointer.y > 598) return true;
    const hud = this.scene.get('HUD');
    return !!(hud?.sys.isActive() && hud.input.hitTestPointer(pointer).length);
  }

  towerNear(x, y) {
    let best = null, bestD = 34;
    for (const t of this.towers) {
      const d = Math.hypot(t.stats.x - x, t.stats.y - 8 - y); // the sprite's visual centre sits a bit above its foot
      if (d < bestD) { best = t; bestD = d; }
    }
    return best;
  }

  drawRange(x, y, range, ok = true) {
    const c = ok ? 0xe8c07a : 0xd01a3a;
    this.rangeRing.clear().lineStyle(2, c, ok ? 0.55 : 0.7).fillStyle(c, ok ? 0.08 : 0.1).fillCircle(x, y, range).strokeCircle(x, y, range);
  }

  hideGhost() {
    this.ghost.setVisible(false);
    this.rangeRing.clear();
  }

  onPointerMove(pointer) {
    if (this.ending) return;
    const hud = this.overHud(pointer);
    if (this.selectedType) {
      if (hud) return this.hideGhost();
      const pos = snap(pointer);
      const check = canPlace(this.state, this.selectedType, pos);
      // grapes/unique don't depend on where you point: the ghost judges the spot only
      const spotOk = check.ok || check.reason === 'grapes' || check.reason === 'unique';
      this.ghost.setTexture(`tower-${this.selectedType}`).setPosition(pos.x, pos.y + 20).setVisible(true)
        .setTint(spotOk ? 0xffffff : 0xff6060);
      this.drawRange(pos.x, pos.y, TOWERS[this.selectedType].range, spotOk);
      return;
    }
    const t = hud ? null : this.towerNear(pointer.x, pointer.y);
    if (t === this.hoverTower) return;
    this.hoverTower = t;
    this.rangeRing.clear();
    this.input.setDefaultCursor(t ? 'pointer' : 'default');
    if (t) this.drawRange(t.stats.x, t.stats.y, t.stats.range);
  }

  onPointerDown(pointer) {
    if (this.ending || this.tastingOpen) return;
    if (pointer.rightButtonDown()) {
      if (this.selectedType) this.selectTower(this.selectedType);
      return;
    }
    if (this.overHud(pointer)) return;
    if (!this.selectedType) {
      const tower = this.towerNear(pointer.x, pointer.y);
      if (tower) this.events.emit('tower-clicked', tower.placed); // HUD opens the upgrade panel
      return;
    }
    this.tryPlace(snap(pointer));
  }

  tryPlace(pos) {
    const check = canPlace(this.state, this.selectedType, pos);
    if (!check.ok) {
      play('nope');
      this.events.emit('placement-refused', check.reason);
      if (this.ghost.visible) {
        this.tweens.killTweensOf(this.ghost);
        this.ghost.x = pos.x;
        this.tweens.add({ targets: this.ghost, x: pos.x + 6, duration: 45, yoyo: true, repeat: 3, onComplete: () => this.ghost.setX(pos.x) });
      }
      return;
    }
    const placed = placeTower(this.state, this.selectedType, pos);
    const built = new Tower(this, placed);
    built.light = this.lighting.addLight(pos.x, pos.y, 90);
    this.towers.push(built);
    this.events.emit('grapes-changed', this.state.grapes);
    play('place');
    this.events.emit('tower-placed', placed);
    this.selectTower(this.selectedType); // deselect after building
  }

  // Esc cancels first (placement, then the upgrade panel) and pauses only when nothing is open.
  onEsc() {
    if (this.selectedType) return this.selectTower(this.selectedType);
    const hud = this.scene.get('HUD');
    if (hud?.upgradeUi) return hud.closeUpgrade();
    this.openPause();
  }

  onPauseClicked() {
    this.scene.get('HUD')?.closeUpgrade(true);
    if (this.selectedType) this.selectTower(this.selectedType);
    this.openPause();
  }

  // ---------- 2x speed: game logic (dt), scene timers and tweens all scale ----------
  setSpeed(n) {
    this.speed = n;
    this.time.timeScale = n;
    this.tweens.timeScale = n;
    this.events.emit('speed-changed', n);
  }

  toggleSpeed() {
    if (this.ending) return;
    this.setSpeed(this.speed === 2 ? 1 : 2);
  }

  // ---------- pause menu ----------
  openPause(mode = 'pause') {
    if (this.pauseOpen || this.tastingOpen || (this.ending && mode === 'pause')) return;
    this.pauseOpen = true;
    this.scene.launch('Pause', { mode });
    this.scene.pause();
  }

  resumeFromPause() {
    this.pauseOpen = false;
    this.scene.resume();
  }

  // Same type again (or ESC) toggles the selection off.
  selectTower(type) {
    this.selectedType = !type || type === this.selectedType ? null : type;
    if (!this.selectedType) {
      this.hideGhost();
    } else {
      this.hoverTower = null;
      this.input.setDefaultCursor('default');
      const p = this.input.activePointer; // show the ghost right away if the pointer is on the field
      if (p && !this.overHud(p)) this.onPointerMove(p);
    }
    this.events.emit('tower-selected', this.selectedType);
  }

  upgrade(placed) {
    const tower = this.towers.find((t) => t.placed.id === placed.id);
    if (!tower) return;
    if (!upgradeTower(this.state, tower.placed)) {
      const maxed = tower.placed.level >= TOWERS[placed.type].upgrades.length;
      play('nope');
      this.events.emit('upgrade-refused', maxed ? 'max' : 'grapes');
      return;
    }
    tower.refresh();
    play('place', { pitch: 1.25 });
    this.events.emit('grapes-changed', this.state.grapes);
    this.events.emit('tower-upgraded', tower.placed);
  }

  // ---------- enemies fight back ----------
  // Every pest's attacker decides what it does this frame; hits go through
  // damageTower; destroyed towers are swept once, after the loop.
  enemyAttacks(dtMs) {
    const targets = this.towers.filter((t) => !t.dead)
      .map((t) => ({ id: t.placed.id, x: t.stats.x, y: t.stats.y, hp: t.placed.hp }));
    this.attackTargets = targets;
    for (const e of [...this.enemies]) {
      if (!e.alive || !e.attacker) continue;
      const r = tickAttacker(e.attacker, e, targets, dtMs * e.slowFactor);
      e.holding = r.holding;
      if (r.hits.length && e.attacker.cfg.style === 'slam') this.slamFx(e);
      for (const h of r.hits) {
        const tower = this.towers.find((t) => t.placed.id === h.id);
        if (!tower || tower.dead) continue;
        this.attackFx(e, tower);
        this.damageTower(tower, h.damage);
      }
      if (r.selfDestruct) {
        splash(this, e.x, e.y);
        play('splash');
        this.removeEnemy(e, true); // no reward: it spent itself on your tower
      }
    }
    this.attackTargets = null;
    this.sweepTowers();
  }

  attackFx(e, tower) {
    const { x, y } = tower.stats;
    switch (e.attacker.cfg.style) {
      case 'dash': { // lunge 60% of the way and back
        this.tweens.killTweensOf(e);
        e.offX = 0; e.offY = 0;
        this.tweens.add({ targets: e, offX: (x - e.x) * 0.6, offY: (y - 10 - e.y) * 0.6, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
        play('hit', { pitch: 1.4 });
        break;
      }
      case 'ranged': {
        const cork = this.add.image(e.x, e.y, 'proj-cork').setDepth(1999);
        this.tweens.add({ targets: cork, x, y: y - 14, duration: 180, onComplete: () => cork.destroy() });
        play('cork', { pitch: 0.6 });
        break;
      }
      case 'chew': {
        this.tweens.killTweensOf(e);
        e.rotOff = 0;
        this.tweens.add({ targets: e, rotOff: 0.35, duration: 60, yoyo: true, repeat: 1, onComplete: () => { e.rotOff = 0; } });
        corkPop(this, x, y - 10);
        play('hit');
        break;
      }
      case 'burst':
        splash(this, x, y - 10);
        break;
      default:
        break;
    }
  }

  slamFx(e) {
    const reach = e.attacker.cfg.reach;
    const ring = this.add.circle(e.x, e.y, reach, 0xe9dcc0, 0.25).setDepth(2545).setScale(0.2);
    ring.setStrokeStyle(4, 0xe9dcc0, 0.9);
    this.tweens.add({ targets: ring, scale: 1, duration: 300, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: ring, alpha: 0, duration: 480, ease: 'Quad.easeIn', onComplete: () => ring.destroy() });
    this.cameras.main.shake(200, 0.006);
    play('hit', { pitch: 0.6 });
  }

  damageTower(tower, amount) {
    if (tower.dead) return;
    const destroyed = hurtTower(tower.placed, amount);
    const target = this.attackTargets?.find((t) => t.id === tower.placed.id);
    if (target) target.hp = tower.placed.hp; // later hits this frame see it
    tower.drawHp();
    tower.hitFlash();
    this.events.emit('tower-damaged', tower.placed);
    if (destroyed) tower.dead = true;
  }

  // Destroyed towers are gone for good (with their upgrades); the spot is free again.
  sweepTowers() {
    const dead = this.towers.filter((t) => t.dead);
    if (!dead.length) return;
    this.towers = this.towers.filter((t) => !t.dead);
    for (const t of dead) {
      const { x, y } = t.stats;
      shatter(this, x, y - 10);
      play('shatter');
      this.cameras.main.shake(150, 0.004);
      if (t.light) this.lighting.removeLight(t.light);
      t.light = null;
      t.destroy();
      removeTower(this.state, t.placed);
      if (this.hoverTower === t) {
        this.hoverTower = null;
        this.input.setDefaultCursor('default');
        if (!this.selectedType) this.rangeRing.clear();
      }
      this.floatText(x, y - 40, `${TOWERS[t.placed.type].name} destroyed!`, '#ff6b6b');
      this.events.emit('tower-destroyed', t.placed);
    }
  }

  repair(placed) {
    const tower = this.towers.find((t) => t.placed.id === placed.id);
    if (!tower || tower.dead || this.ending) return;
    const r = repairTower(this.state, tower.placed);
    if (!r.ok) {
      play('nope');
      this.events.emit('repair-refused', r.reason);
      return;
    }
    const { x, y } = tower.stats;
    play('place');
    const fx = this.add.particles(x, y - 20, 'spark', {
      emitting: false, lifespan: 600, speed: { min: 40, max: 140 }, scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [0xffd36b, 0x8fd16a], blendMode: 'ADD',
    }).setDepth(2660);
    fx.explode(12);
    this.time.delayedCall(700, () => fx.destroy());
    this.floatText(x, y - 40, 'Repaired!', '#8fd16a');
    tower.drawHp();
    this.events.emit('grapes-changed', this.state.grapes);
    this.events.emit('tower-repaired', tower.placed);
  }

  // ---------- auto next wave ----------
  hasNextWave() {
    return this.state.wave < WAVES.length;
  }

  toggleAuto() {
    const on = !this.registry.get('autoWave');
    this.registry.set('autoWave', on);
    // between waves (after at least one), turning it on starts the countdown right away
    if (on && !this.runner && this.state.wave > 0 && this.enemies.length === 0 && this.hasNextWave()) this.autoIn = 3000;
    if (!on) this.clearAuto();
  }

  clearAuto() {
    this.autoIn = null;
    this.emitAuto(null);
  }

  emitAuto(n) {
    if (n === this.autoShown) return;
    this.autoShown = n;
    this.events.emit('auto-wave-tick', n);
  }

  // Counts only while the cellar is idle and nothing modal is open (pause freezes update anyway).
  updateAuto(dtMs) {
    if (this.autoIn == null) return;
    if (this.runner || this.enemies.length || this.tastingOpen || this.pauseOpen || this.ending) return;
    this.autoIn -= dtMs;
    if (this.autoIn <= 0) {
      this.clearAuto();
      this.startWave();
    } else this.emitAuto(Math.ceil(this.autoIn / 1000));
  }

  startWave() {
    this.clearAuto();
    if (this.runner || this.ending || this.tastingOpen || this.state.wave >= WAVES.length) return;
    this.waveIndex = this.state.wave;
    this.state.wave += 1;
    this.runner = createWaveRunner(buildSchedule(WAVES[this.waveIndex]));
    play('wave');
    this.events.emit('wave-started', this.waveIndex);
  }

  damageEnemy(enemy, damage) {
    if (!enemy.alive || enemy.recruited) return;
    if (!enemy.hit(damage)) {
      play('hit');
      return;
    }
    play('kill');
    this.removeEnemy(enemy, true);
    this.kills += 1;
    const reward = Math.round(enemy.reward * this.rewardMult());
    earn(this.state, reward);
    this.floatText(enemy.x, enemy.y - 16, `+${reward}`);
    this.events.emit('grapes-changed', this.state.grapes);
    this.events.emit('enemy-killed', enemy);
    if (ENEMIES[enemy.type].splitInto) this.splitBoss(enemy);
  }

  rewardMult() {
    return this.state.buffs.reduce((m, b) => (b.stat === 'reward' ? m * b.mult : m), 1);
  }

  spawnEnemy(type, distance = 0) {
    const e = new Enemy(this, type, distance);
    this.enemies.push(e);
    if (e.boss) this.events.emit('boss-spawned', type);
    return e;
  }

  // ---------- Le Monstre Blanc ----------
  // Cans are pushed synchronously so the last wave can't clear on the boss kill.
  splitBoss(boss) {
    const { type, count } = ENEMIES[boss.type].splitInto;
    for (let i = 0; i < count; i++) {
      const off = count > 1 ? -40 + (80 * i) / (count - 1) : 0;
      const can = this.spawnEnemy(type, Math.min(this.path.length - 1, Math.max(0, boss.distance + off)));
      can.update(0, this.clock); // place it now, not at the entrance
      this.tweens.killTweensOf(can.sprite);
      can.sprite.setAlpha(1).setScale(0.2);
      this.tweens.add({ targets: can.sprite, scale: 1, duration: 260, delay: i * 30, ease: 'Back.easeOut' });
    }
    this.cameras.main.shake(450, 0.012);
    this.cameras.main.flash(180, 233, 220, 192);
    play('shatter');
    this.sparks.explode(28, boss.x, boss.y);
    shatter(this, boss.x, boss.y);
    this.floatText(boss.x, boss.y - 44, 'Le Monstre Blanc splits!', '#e9dcc0');
  }

  // ---------- presenter keys (undocumented on screen) ----------
  // 1-7 jump to that wave, B Le Monstre Blanc, G +500 Grapes,
  // W Wine Tasting, R charge Taureau Rouge, D every tower to 25% HP. Dead while Game is paused
  // (Tasting open): a paused scene's keyboard doesn't fire.
  onDemoKey(e) {
    if (e.repeat || this.ending || this.tastingOpen) return;
    // digits by physical key (AZERTY needs Shift for 1-7), letters by character
    const digit = /^(?:Digit|Numpad)([1-7])$/.exec(e.code);
    const k = (e.key || '').toLowerCase();
    if (k === 'p') this.openPause();
    else if (k === 'f') this.toggleSpeed();
    else if (digit) this.jumpToWave(Number(digit[1]));
    else if (k === 'b') this.spawnEnemy('monstre');
    else if (k === 'g') {
      earn(this.state, 500);
      this.floatText(640, 110, '+500 Grapes', '#ffd36b');
      this.events.emit('grapes-changed', this.state.grapes);
    } else if (k === 'w') this.openTasting();
    else if (k === 'd') {
      for (const t of this.towers) {
        t.placed.hp = Math.max(1, Math.round(towerStats(t.placed).maxHp * 0.25));
        t.drawHp();
        t.hitFlash();
        this.events.emit('tower-damaged', t.placed);
      }
      this.floatText(640, 110, 'The pests bite back!', '#ff6b6b');
    }
    else if (k === 'r') {
      if (this.powerUp.active) return;
      this.powerUp = createPowerUp(POWER);
      this.emitPower();
    }
  }

  jumpToWave(n) {
    for (const e of [...this.enemies]) this.removeEnemy(e, false);
    for (const p of this.projectiles) p.destroy();
    this.projectiles = [];
    for (const r of [...this.recruits]) this.dismissRecruit(r);
    this.runner = null;
    this.state.wave = Math.min(WAVES.length, n) - 1;
    this.startWave();
  }

  // Thomas's Annual Wine Tasting: modal, Game paused until a wine is picked
  openTasting() {
    if (this.tastingOpen || this.ending) return;
    this.tastingOpen = true;
    this.scene.launch('Tasting');
    this.scene.pause();
  }

  // ---------- Thomas Recruit ----------
  recruit(enemy, tower) {
    const i = this.enemies.indexOf(enemy);
    if (i < 0) return;
    this.enemies.splice(i, 1); // towers ignore it, it can't leak
    enemy.recruit();
    enemy.struck = new Set(); // pests it already hit: each one only once
    enemy.budget = enemy.maxHp; // its HP is a damage budget: each smash spends what it deals
    this.recruits.push(enemy);
    const g = this.add.graphics().setDepth(2560);
    g.lineStyle(3, 0xffd36b, 0.9).lineBetween(tower.stats.x, tower.stats.y - 20, enemy.x, enemy.y);
    this.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
    this.floatText(enemy.x, enemy.y - 22, 'Recruited!', '#ffd36b');
  }

  updateRecruits(dt) {
    for (const r of [...this.recruits]) {
      r.update(dt, this.clock);
      // walks back to the entrance and smashes every pest it passes through
      for (const foe of [...this.enemies]) {
        if (!foe.alive || r.struck.has(foe) || Math.hypot(foe.x - r.x, foe.y - r.y) > 20) continue;
        r.struck.add(foe);
        this.sparks.explode(6, foe.x, foe.y);
        // armour is added so a smash with enough budget really kills
        const { deal, left } = recruitSmash(r.budget, foe.hp + (foe.armour || 0));
        this.damageEnemy(foe, deal);
        r.budget = left;
        if (left <= 0) break;
      }
      if (r.budget <= 0) {
        this.floatText(r.x, r.y - 18, 'Spent!', '#ffd36b');
        this.dismissRecruit(r);
      } else if (r.distance <= 0) this.dismissRecruit(r);
    }
  }

  dismissRecruit(r) {
    this.sparks.explode(10, r.x, r.y);
    r.destroy(true);
    const i = this.recruits.indexOf(r);
    if (i >= 0) this.recruits.splice(i, 1);
  }

  // ---------- Wine Tasting ----------
  onTastingPicked(wine) {
    this.state.buffs.push(wine.effect);
    for (const t of this.towers) t.recompute();
    this.tastingOpen = false;
    this.events.emit('buff-added', wine);
  }

  // ---------- Taureau Rouge Grand Cru ----------
  createPowerFx() {
    // police-light wash: red from the left, blue from the right, alternating;
    // above the darkness, below the vignette
    this.powerRed = this.add.image(120, 360, 'light-soft').setDisplaySize(1700, 1500).setTint(0xd01a3a)
      .setDepth(2650).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.powerBlue = this.add.image(1160, 360, 'light-soft').setDisplaySize(1700, 1500).setTint(0x2a5cff)
      .setDepth(2650).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.sparks = this.add.particles(0, 0, 'spark', {
      emitting: false,
      lifespan: 520,
      speed: { min: 60, max: 180 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xff3a4a, 0x5a8aff, 0xffd36b],
      blendMode: 'ADD',
      maxAliveParticles: 80,
    }).setDepth(2660);
  }

  activatePower() {
    if (this.ending || this.tastingOpen) return;
    if (!this.runner && this.enemies.length === 0) { // between waves: save it for the pests
      play('nope');
      this.events.emit('power-refused');
      return;
    }
    if (!this.powerUp.activate()) {
      play('nope');
      return;
    }
    play('power');
    play('heartbeat');
    this.heartbeatIn = 800;
    this.sparkIn = 0;
    this.cameras.main.flash(160, 208, 26, 58);
    this.tweens.killTweensOf([this.powerRed, this.powerBlue]);
    this.tweens.add({ targets: this.powerRed, alpha: { from: 0.55, to: 0.05 }, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.powerBlue, alpha: { from: 0.05, to: 0.55 }, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.emitPower();
  }

  updatePower(dtMs) {
    const p = this.powerUp;
    const idle = !this.runner && this.enemies.length === 0;
    p.tick(dtMs, { paused: idle && !p.active }); // a running burst finishes; cooldown freezes between waves
    if (p.active) {
      this.heartbeatIn -= dtMs;
      if (this.heartbeatIn <= 0) {
        this.heartbeatIn += 800;
        play('heartbeat');
      }
      this.sparkIn -= dtMs;
      if (this.sparkIn <= 0) {
        this.sparkIn = 260;
        for (const t of this.towers) this.sparks.explode(3, t.stats.x, t.stats.y - 24);
      }
    } else if (this.wasActive) {
      this.tweens.killTweensOf([this.powerRed, this.powerBlue]);
      this.tweens.add({ targets: [this.powerRed, this.powerBlue], alpha: 0, duration: 300 });
    }
    this.wasActive = p.active;
    this.powerEmitAt -= dtMs;
    if (this.powerEmitAt <= 0) this.emitPower();
  }

  emitPower() {
    this.powerEmitAt = 100; // ~10 Hz
    const p = this.powerUp;
    const fraction = p.ready ? 1 : p.active ? p.activeLeft / POWER.durationMs : 1 - p.cooldownLeft / POWER.cooldownMs;
    const secondsLeft = Math.ceil((p.active ? p.activeLeft : p.cooldownLeft) / 1000);
    const frozen = !this.runner && this.enemies.length === 0;
    this.events.emit('power-changed', { ready: p.ready, active: p.active, fraction, secondsLeft, frozen });
  }

  removeEnemy(enemy, animated) {
    enemy.destroy(animated);
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  floatText(x, y, msg, color = '#e8c07a') {
    const t = this.add
      .text(x, y, msg, { fontFamily: 'Cinzel, serif', fontStyle: '700', fontSize: '16px', color, stroke: '#120a0d', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(3000);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 700, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  update(_time, delta) {
    if (this.ending) return;
    const dt = (Math.min(delta, 100) / 1000) * this.speed; // clamp so a tab switch doesn't teleport enemies
    this.clock += dt * 1000;

    if (this.runner) for (const type of this.runner.tick(dt * 1000)) this.spawnEnemy(type);
    this.updatePower(dt * 1000);

    for (const e of [...this.enemies]) {
      e.update(dt, this.clock);
      if (!e.leaked) continue;
      this.removeEnemy(e, false);
      play('leak');
      loseLives(this.state, e.leakCost);
      this.cameras.main.shake(120, 0.004);
      this.events.emit('lives-changed', this.state.lives);
      if (this.state.status === 'lost') return this.endGame('lost');
    }
    this.enemyAttacks(dt * 1000);

    this.updateRecruits(dt);
    this.updateAuto(dt * 1000);
    // Le Monstre Blanc's footsteps rattle the cellar
    if (this.enemies.some((e) => e.boss)) {
      this.shakeIn -= dt * 1000;
      if (this.shakeIn <= 0) {
        this.shakeIn = 600;
        this.cameras.main.shake(120, 0.002);
      }
    }

    for (const t of this.towers) {
      if (this.runner) t.tickRecruit(dt * 1000, this.enemies);
      t.update(dt, this.enemies, this.clock);
    }
    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => !p.done);

    if (this.runner && this.runner.done && this.enemies.length === 0) {
      const i = this.waveIndex;
      this.runner = null;
      earn(this.state, waveBonus(i));
      this.events.emit('grapes-changed', this.state.grapes);
      for (const r of [...this.recruits]) this.dismissRecruit(r);
      this.events.emit('wave-cleared', i);
      if (this.registry.get('autoWave') && this.hasNextWave()) this.autoIn = 3000;
      if (i === WAVES.length - 1) {
        this.state.status = 'won';
        this.endGame('won');
      } else {
        this.openTasting();
      }
    }
  }

  endGame(result) {
    if (this.ending) return;
    this.ending = true;
    const data = { result, wave: this.state.wave, kills: this.kills };
    this.events.emit('game-over', result);
    this.cameras.main.fadeOut(400, 18, 10, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('End', data));
  }

  cleanup() {
    this.events.off('start-wave', this.startWave, this);
    this.events.off('select-tower', this.selectTower, this);
    this.events.off('upgrade-tower', this.upgrade, this);
    this.events.off('repair-tower', this.repair, this);
    this.events.off('activate-power', this.activatePower, this);
    this.events.off('tasting-picked', this.onTastingPicked, this);
    this.events.off('pause', this.onPauseClicked, this);
    this.events.off('toggle-speed', this.toggleSpeed, this);
    this.events.off('toggle-auto', this.toggleAuto, this);
    this.input.keyboard.off('keydown-ESC', this.onEsc, this);
    this.input.keyboard.off('keydown', this.onDemoKey, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.setDefaultCursor('default');
    this.scene.stop('HUD');
    this.scene.stop('Tasting');
    this.scene.stop('Pause');
    for (const r of this.recruits) r.destroy();
    this.recruits = [];
    for (const e of this.enemies) e.destroy();
    for (const p of this.projectiles) p.destroy();
    for (const t of this.towers) t.destroy();
    this.enemies = [];
    this.projectiles = [];
    this.towers = [];
    this.runner = null;
  }
}
