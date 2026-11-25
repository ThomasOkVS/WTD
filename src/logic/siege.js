// "Enemies fight back": tower HP, repair and per-pest attacker state machines.
// Phaser-free; GameScene applies the results.
import { TOWERS } from '../config/towers.js';
import { SIEGE } from '../config/enemies.js';
import { spend } from './state.js';
import { towerStats } from './towers.js';

// Grapes sunk into a tower: base cost plus every upgrade bought.
export function investedIn(placed) {
  const cfg = TOWERS[placed.type];
  return cfg.cost + cfg.upgrades.slice(0, placed.level).reduce((sum, u) => sum + u.cost, 0);
}

export function repairCost(placed) {
  const max = towerStats(placed).maxHp;
  const missing = max - placed.hp;
  if (missing <= 0) return 0;
  return Math.max(1, Math.ceil(SIEGE.repairShare * (missing / max) * investedIn(placed)));
}

export function repairTower(state, placed) {
  const max = towerStats(placed).maxHp;
  if (placed.hp >= max) return { ok: false, reason: 'full' };
  const cost = repairCost(placed);
  if (!spend(state, cost)) return { ok: false, reason: 'grapes' };
  placed.hp = max;
  return { ok: true, cost };
}

// Returns true only for the hit that takes the tower to 0.
export function damageTower(placed, amount) {
  if (placed.hp <= 0) return false;
  placed.hp = Math.max(0, placed.hp - amount);
  return placed.hp === 0;
}

export function removeTower(state, placed) {
  const i = state.towers.indexOf(placed);
  if (i >= 0) state.towers.splice(i, 1);
}
