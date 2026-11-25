import { WAVES } from '../config/waves.js';

export function waveBonus(waveIndex) {
  return 20 + 5 * waveIndex;
}

export function buildSchedule(wave) {
  const out = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) out.push({ atMs: g.delayMs + i * g.intervalMs, type: g.type, hpMult: wave.hpMult ?? 1 });
  }
  return out.sort((a, b) => a.atMs - b.atMs); // stable: group order breaks ties
}

export function createWaveRunner(schedule) {
  let elapsed = 0;
  let idx = 0;
  const runner = {
    tick(dtMs) {
      elapsed += dtMs;
      const due = [];
      while (idx < schedule.length && schedule[idx].atMs <= elapsed) due.push(schedule[idx++]);
      return due;
    },
    get done() {
      return idx >= schedule.length;
    },
  };
  return runner;
}

const PLURAL = { fly: 'Flies', corkscrew: 'Corkscrews', rat: 'Rats', can: 'Cans' };

// "Rats ×7 · Flies ×16": groups merged by type, in first-appearance order.
export function describeWave(wave) {
  if (wave.groups.some((g) => g.type === 'monstre')) return 'Le Monstre Blanc!';
  const counts = new Map();
  for (const g of wave.groups) counts.set(g.type, (counts.get(g.type) || 0) + g.count);
  return [...counts].map(([type, n]) => `${PLURAL[type] || type} ×${n}`).join(' · ');
}

// Endless: past the scripted waves, the last wave's pests (no boss) come back
// in growing numbers and tougher; Le Monstre Blanc returns every 3rd endless wave.
export function waveAt(index) {
  if (index < WAVES.length) return { ...WAVES[index], hpMult: 1 };
  const k = index - WAVES.length + 1;
  const groups = WAVES[WAVES.length - 1].groups
    .filter((g) => g.type !== 'monstre')
    .map((g) => ({ ...g, count: Math.min(30, Math.round(g.count * (1 + 0.2 * k))) })); // perf: cap per group
  if (k % 3 === 0) groups.push({ type: 'monstre', count: 1, intervalMs: 0, delayMs: 9000 });
  return { groups, hpMult: 1 + 0.15 * k };
}
