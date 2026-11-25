import { NESTS } from '../config/enemies.js';

// Pest nests: a tower destroyed by pests leaves a nest. The nest arms at the
// next wave start, adds its pests to that wave's schedule, and collapses when
// that wave is cleared. Phaser-free.

let nextId = 1;

export function createNest(placed) {
  return { id: nextId++, x: placed.x, y: placed.y, type: placed.type, level: placed.level ?? 0, armed: false };
}

// Call at wave start, before building the schedule: every standing nest spawns this wave.
export function armNests(nests) {
  for (const n of nests) n.armed = true;
}

const pestsOf = (n) => NESTS.base + NESTS.perLevel * n.level;

// Total pests the given nests will release (armed or not): for the wave preview.
export function nestPests(nests) {
  return nests.reduce((sum, n) => sum + pestsOf(n), 0);
}

// Schedule entries for the armed nests; entryDistance(nest) = where on the path they join.
export function nestSchedule(nests, entryDistance, hpMult = 1) {
  const out = [];
  for (const n of nests) {
    if (!n.armed) continue;
    const distance = entryDistance(n);
    for (let i = 0; i < pestsOf(n); i++) {
      out.push({ atMs: NESTS.delayMs + i * NESTS.intervalMs, type: NESTS.spawn[n.type], hpMult, distance, nestId: n.id });
    }
  }
  return out;
}

// At wave clear: the armed nests are spent. Returns them (for their collapse effect).
export function collapseNests(state) {
  const gone = state.nests.filter((n) => n.armed);
  state.nests = state.nests.filter((n) => !n.armed);
  return gone;
}
