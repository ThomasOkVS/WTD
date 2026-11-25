import { describe, it, expect } from 'vitest';
import { buildSchedule, createWaveRunner, waveBonus } from '../../src/logic/waves.js';
import { WAVES } from '../../src/config/waves.js';
import { ENEMIES } from '../../src/config/enemies.js';

describe('waves', () => {
  const wave = { groups: [
    { type: 'fly', count: 3, intervalMs: 100, delayMs: 0 },
    { type: 'rat', count: 1, intervalMs: 0, delayMs: 50 },
  ] };
  it('buildSchedule sorts by time', () => {
    expect(buildSchedule(wave)).toEqual([
      { atMs: 0, type: 'fly' }, { atMs: 50, type: 'rat' }, { atMs: 100, type: 'fly' }, { atMs: 200, type: 'fly' },
    ]);
  });
  it('runner releases due spawns', () => {
    const r = createWaveRunner(buildSchedule(wave));
    expect(r.done).toBe(false);
    expect(r.tick(60)).toEqual(['fly', 'rat']);
    expect(r.done).toBe(false);
    expect(r.tick(200)).toEqual(['fly', 'fly']);
    expect(r.done).toBe(true);
    expect(r.tick(100)).toEqual([]);
  });
  it('WAVES config', () => {
    expect(WAVES.length).toBe(7);
    expect(WAVES.at(-1).groups.some((g) => g.type === 'monstre')).toBe(true);
    for (const w of WAVES) for (const g of w.groups) expect(ENEMIES[g.type]).toBeDefined();
  });
  it('monstre is last to spawn in wave 7', () => {
    const s = buildSchedule(WAVES.at(-1));
    expect(s.at(-1).type).toBe('monstre');
  });
  it('waveBonus', () => {
    expect(waveBonus(0)).toBe(20);
    expect(waveBonus(6)).toBe(50);
  });
});
