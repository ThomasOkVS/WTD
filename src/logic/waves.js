export function waveBonus(waveIndex) {
  return 20 + 5 * waveIndex;
}

export function buildSchedule(wave) {
  const out = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) out.push({ atMs: g.delayMs + i * g.intervalMs, type: g.type });
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
      while (idx < schedule.length && schedule[idx].atMs <= elapsed) due.push(schedule[idx++].type);
      return due;
    },
    get done() {
      return idx >= schedule.length;
    },
  };
  return runner;
}
