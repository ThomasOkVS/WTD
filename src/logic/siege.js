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

// --- Pest attackers -------------------------------------------------------
// tickAttacker(attacker, pos, towers, dtMs) -> { hits, holding, selfDestruct }
// `towers` are plain {id, x, y, hp}; the caller scales dtMs by the pest's slow.

export function createAttacker(cfg) {
  return {
    cfg, cooldownLeft: 0, chewLeft: 0, biteLeft: 0, chewTargetId: null, chewed: new Set(), spent: false,
  };
}

const hitFor = (cfg) => Math.max(1, Math.round(cfg.damage * SIEGE.damageMult));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function inReach(pos, towers, reach) {
  return towers.filter((t) => t.hp > 0 && dist(pos, t) <= reach);
}

function nearest(pos, list) {
  let best = null; let bestD = Infinity;
  for (const t of list) {
    const d = dist(pos, t);
    if (d < bestD) { best = t; bestD = d; }
  }
  return best;
}

export function tickAttacker(a, pos, towers, dtMs) {
  const { cfg } = a;
  const out = { hits: [], holding: false, selfDestruct: false };
  const reachable = inReach(pos, towers, cfg.reach);

  switch (cfg.style) {
    case 'dash':
    case 'ranged': {
      a.cooldownLeft -= dtMs;
      const target = nearest(pos, reachable);
      if (a.cooldownLeft <= 0 && target) {
        out.hits.push({ id: target.id, damage: hitFor(cfg) });
        a.cooldownLeft = cfg.cooldownMs;
      }
      break;
    }
    case 'slam': {
      a.cooldownLeft -= dtMs;
      if (a.cooldownLeft <= 0 && reachable.length) {
        for (const t of reachable) out.hits.push({ id: t.id, damage: hitFor(cfg) });
        a.cooldownLeft = cfg.cooldownMs;
      }
      break;
    }
    case 'burst': {
      const target = nearest(pos, reachable);
      if (!a.spent && target) {
        a.spent = true;
        out.hits.push({ id: target.id, damage: hitFor(cfg) });
        out.selfDestruct = true;
      }
      break;
    }
    case 'chew': {
      if (a.chewTargetId !== null) {
        a.chewLeft -= dtMs;
        a.biteLeft -= dtMs;
        const target = towers.find((t) => t.id === a.chewTargetId && t.hp > 0);
        if (a.chewLeft <= 0 || !target) {
          a.chewed.add(a.chewTargetId);
          a.chewTargetId = null;
        } else {
          out.holding = true;
          if (a.biteLeft <= 0) {
            out.hits.push({ id: target.id, damage: hitFor(cfg) });
            a.biteLeft += cfg.biteMs;
          }
        }
      } else {
        const target = nearest(pos, reachable.filter((t) => !a.chewed.has(t.id)));
        if (target) {
          a.chewTargetId = target.id;
          a.chewLeft = cfg.chewMs;
          a.biteLeft = cfg.biteMs;
          out.holding = true;
          out.hits.push({ id: target.id, damage: hitFor(cfg) });
        }
      }
      break;
    }
    default:
      break;
  }
  return out;
}
