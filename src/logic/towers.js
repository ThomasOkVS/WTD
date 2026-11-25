import { TOWERS } from '../config/towers.js';
import { spend } from './state.js';
import { distanceToPath } from './path.js';
import {
  PATH, CANDLES, BARRELS, PLAYFIELD, HUD_ZONES, PATH_CLEARANCE, TOWER_SPACING, DECOR_FOOTPRINT, GRID,
} from '../config/map.js';

let nextId = 1;

export function snap({ x, y }, grid = GRID) {
  return { x: Math.round(x / grid) * grid, y: Math.round(y / grid) * grid };
}

const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) < d;

// Where a tower may stand. Position refusals first (so the ghost shows why a
// spot is bad even when you're broke), then the unique / money rules.
export function canPlace(state, towerType, pos) {
  const cfg = TOWERS[towerType];
  const { x, y } = pos;
  const f = PLAYFIELD;
  if (x < f.minX || x > f.maxX || y < f.minY || y > f.maxY) return { ok: false, reason: 'bounds' };
  if (HUD_ZONES.some((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)) return { ok: false, reason: 'bounds' };
  if (distanceToPath(PATH, pos) < PATH_CLEARANCE) return { ok: false, reason: 'path' };
  if (state.towers.some((t) => near(t, pos, TOWER_SPACING))) return { ok: false, reason: 'occupied' };
  if ([...CANDLES, ...BARRELS].some((d) => near(d, pos, DECOR_FOOTPRINT))) return { ok: false, reason: 'decor' };
  if (cfg.unique && state.towers.some((t) => t.type === towerType)) return { ok: false, reason: 'unique' };
  if (state.grapes < cfg.cost) return { ok: false, reason: 'grapes' };
  return { ok: true };
}

export function placeTower(state, towerType, pos) {
  if (!canPlace(state, towerType, pos).ok) return null;
  spend(state, TOWERS[towerType].cost);
  const tower = { id: nextId++, type: towerType, x: pos.x, y: pos.y, level: 0 };
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
