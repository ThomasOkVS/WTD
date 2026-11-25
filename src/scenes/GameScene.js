import Phaser from 'phaser';
import { PATH, BUILD_SPOTS } from '../config/map.js';
import { TOWERS } from '../config/towers.js';
import { WAVES } from '../config/waves.js';
import { createPath } from '../logic/path.js';
import { createGameState, earn, loseLives } from '../logic/state.js';
import { canPlace, placeTower, upgradeTower } from '../logic/towers.js';
import { buildSchedule, createWaveRunner, waveBonus } from '../logic/waves.js';
import { Enemy } from '../objects/Enemy.js';
import { Tower } from '../objects/Tower.js';
import { createDebugHud } from './DebugHud.js';
import { drawCellar } from '../fx/cellar.js';

// Every custom event on this.events. All listeners for these are removed on
// shutdown (scene.events survives restarts, so they would otherwise stack up).
export const GAME_EVENTS = [
  'grapes-changed', 'lives-changed', 'wave-started', 'wave-cleared', 'tower-placed',
  'placement-refused', 'enemy-killed', 'start-wave', 'select-tower', 'upgrade-tower',
  'tower-selected', 'tower-upgraded', 'upgrade-refused',
];

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

    this.lighting = drawCellar(this);
    this.createSpots();

    this.events.on('start-wave', this.startWave, this);
    this.events.on('select-tower', this.selectTower, this);
    this.events.on('upgrade-tower', this.upgrade, this);
    this.input.keyboard.on('keydown-ESC', () => this.selectTower(this.selectedType));
    this.events.once('shutdown', this.cleanup, this);

    createDebugHud(this); // TEMP until the HUD scene (Task 8)
    this.cameras.main.fadeIn(250, 18, 10, 13);
  }

  createSpots() {
    this.spots = {};
    this.rangeRing = this.add.graphics().setDepth(2550); // placement aid: above the darkness
    for (const spot of BUILD_SPOTS) {
      const ring = this.add.graphics().setDepth(2540).setAlpha(0); // free-spot ring above the darkness so it reads in the dark bands
      this.drawSpotRing(ring, spot, false);
      this.tweens.add({ targets: ring, alpha: 1, duration: 300 });
      const zone = this.add.zone(spot.x, spot.y, 72, 72).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.hoverSpot(spot, true));
      zone.on('pointerout', () => this.hoverSpot(spot, false));
      zone.on('pointerdown', () => this.clickSpot(spot));
      this.spots[spot.id] = { spot, ring, zone };
    }
  }

  drawSpotRing(g, spot, hover) {
    g.clear();
    g.fillStyle(0x120a0d, hover ? 0.45 : 0.3).fillCircle(spot.x, spot.y, 26);
    g.lineStyle(2, 0xe8c07a, hover ? 0.9 : 0.35).strokeCircle(spot.x, spot.y, 26);
  }

  towerAt(spotId) {
    return this.towers.find((t) => t.placed.spotId === spotId);
  }

  hoverSpot(spot, over) {
    const { ring } = this.spots[spot.id];
    const tower = this.towerAt(spot.id);
    this.rangeRing.clear();
    if (!tower) this.drawSpotRing(ring, spot, over);
    if (!over) return;
    const range = tower ? tower.stats.range : this.selectedType && TOWERS[this.selectedType].range;
    if (range) this.rangeRing.lineStyle(2, 0xe8c07a, 0.5).fillStyle(0xe8c07a, 0.08).fillCircle(spot.x, spot.y, range).strokeCircle(spot.x, spot.y, range);
  }

  clickSpot(spot) {
    if (this.ending) return;
    const tower = this.towerAt(spot.id);
    if (tower && !this.selectedType) {
      this.events.emit('upgrade-tower', tower.placed);
      return;
    }
    if (!this.selectedType) return;
    const check = canPlace(this.state, this.selectedType, spot.id);
    if (!check.ok) {
      this.events.emit('placement-refused', check.reason);
      return;
    }
    const placed = placeTower(this.state, this.selectedType, spot.id);
    const built = new Tower(this, placed);
    built.light = this.lighting.addLight(spot.x, spot.y, 90);
    this.towers.push(built);
    this.spots[spot.id].ring.setVisible(false);
    this.rangeRing.clear();
    this.events.emit('grapes-changed', this.state.grapes);
    this.events.emit('tower-placed', placed);
    this.selectTower(this.selectedType); // deselect after building
  }

  // Same type again (or ESC) toggles the selection off.
  selectTower(type) {
    this.selectedType = !type || type === this.selectedType ? null : type;
    this.events.emit('tower-selected', this.selectedType);
  }

  upgrade(placed) {
    const tower = this.towers.find((t) => t.placed.id === placed.id);
    if (!tower) return;
    if (!upgradeTower(this.state, tower.placed)) {
      const maxed = tower.placed.level >= TOWERS[placed.type].upgrades.length;
      this.events.emit('upgrade-refused', maxed ? 'max' : 'grapes');
      return;
    }
    tower.refresh();
    this.events.emit('grapes-changed', this.state.grapes);
    this.events.emit('tower-upgraded', tower.placed);
  }

  startWave() {
    if (this.runner || this.ending || this.state.wave >= WAVES.length) return;
    this.waveIndex = this.state.wave;
    this.state.wave += 1;
    this.runner = createWaveRunner(buildSchedule(WAVES[this.waveIndex]));
    this.events.emit('wave-started', this.waveIndex);
  }

  damageEnemy(enemy, damage) {
    if (!enemy.alive) return;
    if (!enemy.hit(damage)) return;
    this.removeEnemy(enemy, true);
    earn(this.state, enemy.reward);
    this.floatText(enemy.x, enemy.y - 16, `+${enemy.reward}`);
    this.events.emit('grapes-changed', this.state.grapes);
    this.events.emit('enemy-killed', enemy);
  }

  removeEnemy(enemy, animated) {
    enemy.destroy(animated);
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  floatText(x, y, msg) {
    const t = this.add
      .text(x, y, msg, { fontFamily: 'Cinzel, serif', fontStyle: '700', fontSize: '16px', color: '#e8c07a', stroke: '#120a0d', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(3000);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 700, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  update(_time, delta) {
    if (this.ending) return;
    const dt = Math.min(delta, 100) / 1000; // clamp so a tab switch doesn't teleport enemies
    this.clock += dt * 1000;

    if (this.runner) for (const type of this.runner.tick(dt * 1000)) this.enemies.push(new Enemy(this, type));

    for (const e of [...this.enemies]) {
      e.update(dt, this.clock);
      if (!e.leaked) continue;
      this.removeEnemy(e, false);
      loseLives(this.state, e.leakCost);
      this.cameras.main.shake(120, 0.004);
      this.events.emit('lives-changed', this.state.lives);
      if (this.state.status === 'lost') return this.endGame('lost');
    }

    for (const t of this.towers) t.update(dt, this.enemies, this.clock);
    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => !p.done);

    if (this.runner && this.runner.done && this.enemies.length === 0) {
      const i = this.waveIndex;
      this.runner = null;
      earn(this.state, waveBonus(i));
      this.events.emit('grapes-changed', this.state.grapes);
      this.events.emit('wave-cleared', i);
      if (i === WAVES.length - 1) {
        this.state.status = 'won';
        this.endGame('won');
      }
    }
  }

  endGame(result) {
    if (this.ending) return;
    this.ending = true;
    const data = { result, wave: this.state.wave };
    this.cameras.main.fadeOut(400, 18, 10, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('End', data));
  }

  cleanup() {
    for (const name of GAME_EVENTS) this.events.off(name);
    this.input.keyboard.off('keydown-ESC');
    for (const e of this.enemies) e.destroy();
    for (const p of this.projectiles) p.destroy();
    for (const t of this.towers) t.destroy();
    this.enemies = [];
    this.projectiles = [];
    this.towers = [];
    this.runner = null;
  }
}
