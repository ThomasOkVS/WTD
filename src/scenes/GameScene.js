import Phaser from 'phaser';
import { hdCamera } from '../ui/hd.js';
import { PATH } from '../config/map.js';
import { TOWERS } from '../config/towers.js';
import { WAVES } from '../config/waves.js';
import { createPath } from '../logic/path.js';
import { createGameState, earn, loseLives } from '../logic/state.js';
import { canPlace, placeTower, upgradeTower, snap, towerStats } from '../logic/towers.js';
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
    hdCamera(this); // 2x canvas, same 1280x720 world
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
    if (pointer.worldY > 598) return true; // world coords: screen pixels are HD x larger
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
      const pos = snap({ x: pointer.worldX, y: pointer.worldY });
      const check = canPlace(this.state, this.selectedType, pos);
      // grapes/unique don't depend on where you point: the ghost judges the spot only
      const spotOk = check.ok || check.reason === 'grapes' || check.reason === 'unique';
      this.ghost.setTexture(`tower-${this.selectedType}`).setPosition(pos.x, pos.y + 20).setVisible(true)
        .setTint(spotOk ? 0xffffff : 0xff6060);
      this.drawRange(pos.x, pos.y, TOWERS[this.selectedType].range, spotOk);
      return;
    }
    const t = hud ? null : this.towerNear(pointer.worldX, pointer.worldY);
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
      const tower = this.towerNear(pointer.worldX, pointer.worldY);
      if (tower) this.events.emit('tower-clicked', tower.placed); // HUD opens the upgrade panel
      return;
    }
    this.tryPlace(snap({ x: pointer.worldX, y: pointer.worldY }));
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
    // Thomas gets a wider gold spotlight so he reads as the star of the board
    built.light = placed.type === 'thomas'
      ? this.lighting.addLight(pos.x, pos.y, 130, 0xffd36b)
      : this.lighting.addLight(pos.x, pos.y, 90);
    this.towers.push(built);
    this.events.emit('grapes-changed', this.state.grapes);
    play('place');
    this.events.emit('tower-placed', placed);
    this.selectTower(this.selectedType); // deselect after building
  }

  onEsc() {
    if (this.selectedType) this.selectTower(this.selectedType);
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

  startWave() {
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
    if (digit) this.jumpToWave(Number(digit[1]));
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
        this.damageEnemy(foe, r.hp);
      }
      if (r.distance <= 0) this.dismissRecruit(r);
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
    const dt = Math.min(delta, 100) / 1000; // clamp so a tab switch doesn't teleport enemies
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
    this.input.keyboard.off('keydown-ESC', this.onEsc, this);
    this.input.keyboard.off('keydown', this.onDemoKey, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.setDefaultCursor('default');
    this.scene.stop('HUD');
    this.scene.stop('Tasting');
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
