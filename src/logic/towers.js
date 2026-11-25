import { TOWERS } from '../config/towers.js';
import { spend } from './state.js';

let nextId = 1;

export function canPlace(state, towerType, spotId) {
  const cfg = TOWERS[towerType];
  if (state.towers.some((t) => t.spotId === spotId)) return { ok: false, reason: 'occupied' };
  if (cfg.unique && state.towers.some((t) => t.type === towerType)) return { ok: false, reason: 'unique' };
  if (state.grapes < cfg.cost) return { ok: false, reason: 'grapes' };
  return { ok: true };
}

export function placeTower(state, towerType, spotId) {
  if (!canPlace(state, towerType, spotId).ok) return null;
  spend(state, TOWERS[towerType].cost);
  const tower = { id: nextId++, type: towerType, spotId, level: 0 };
  state.towers.push(tower);
  return tower;
}

export function upgradeTower(state, tower) {
  const next = TOWERS[tower.type].upgrades[tower.level];
  if (!next || !spend(state, next.cost)) return false;
  tower.level += 1;
  return true;
}

// Thomas's "team morale": fire-rate multiplier for one tower from every aura
// tower (Thomas) within its auraRange. Takes positioned stats {type, x, y, ...}.
export function auraMult(all, tower) {
  let mult = 1;
  for (const a of all) {
    if (a === tower || !a.aura) continue;
    if (Math.hypot(a.x - tower.x, a.y - tower.y) <= a.auraRange) mult *= 1 + a.aura;
  }
  return mult;
}

// Base config merged with the upgrades bought so far (cost/upgrades omitted).
export function towerStats(tower) {
  const { upgrades, cost, ...base } = TOWERS[tower.type];
  const merged = { type: tower.type, ...base };
  for (const up of upgrades.slice(0, tower.level)) {
    const { cost: _c, ...overrides } = up;
    Object.assign(merged, overrides);
  }
  return merged;
}
