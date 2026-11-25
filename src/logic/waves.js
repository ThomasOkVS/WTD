import { WAVES } from '../config/waves.js';

export function waveBonus(waveIndex) {
  return 20 + 5 * waveIndex;
}

export function buildSchedule(wave) {
  const out = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) out.push({ atMs: g.delayMs + i * g.intervalMs, type: g.type, hpMult: wave.hpMult ?? 1, speedMult: wave.speedMult ?? 1 });
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

// Difficulty: waves 1-5 as scripted. From wave 6 on (scripted and Endless),
// with r = wave - 5: hp x(1 + 0.35r), counts x(1 + 0.25r) capped at 30 per
// group (perf), speed x min(1 + 0.04r, 1.4). The boss count never scales.
// Endless replays wave 7's pests; Le Monstre Blanc returns every 3rd endless wave.
const RAMP_FROM = 5; // 0-based index of wave 6
export const RAMP = { hp: 0.35, count: 0.25, speed: 0.04, speedCap: 1.4, groupCap: 30 };

export function waveAt(index) {
  const r = Math.max(0, index + 1 - RAMP_FROM);
  if (r === 0) return { ...WAVES[index], hpMult: 1, speedMult: 1 };
  const scale = (g) => (g.type === 'monstre' ? g : { ...g, count: Math.min(RAMP.groupCap, Math.round(g.count * (1 + RAMP.count * r))) });
  let groups;
  if (index < WAVES.length) {
    groups = WAVES[index].groups.map(scale);
  } else {
    const k = index - WAVES.length + 1;
    groups = WAVES[WAVES.length - 1].groups.filter((g) => g.type !== 'monstre').map(scale);
    if (k % 3 === 0) groups.push({ type: 'monstre', count: 1, intervalMs: 0, delayMs: 9000 });
  }
  return { groups, hpMult: 1 + RAMP.hp * r, speedMult: Math.min(1 + RAMP.speed * r, RAMP.speedCap) };
}
