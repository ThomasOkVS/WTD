import { describe, it, expect } from 'vitest';
import { buildSchedule, createWaveRunner, waveBonus, describeWave, waveAt } from '../../src/logic/waves.js';
import { WAVES } from '../../src/config/waves.js';
import { ENEMIES } from '../../src/config/enemies.js';

describe('waves', () => {
  const wave = { groups: [
    { type: 'fly', count: 3, intervalMs: 100, delayMs: 0 },
    { type: 'rat', count: 1, intervalMs: 0, delayMs: 50 },
  ] };
  it('buildSchedule sorts by time', () => {
    expect(buildSchedule(wave)).toEqual([
      { atMs: 0, type: 'fly', hpMult: 1 }, { atMs: 50, type: 'rat', hpMult: 1 }, { atMs: 100, type: 'fly', hpMult: 1 }, { atMs: 200, type: 'fly', hpMult: 1 },
    ]);
  });
  it('runner releases due spawns', () => {
    const r = createWaveRunner(buildSchedule(wave));
    expect(r.done).toBe(false);
    expect(r.tick(60).map((e) => e.type)).toEqual(['fly', 'rat']);
    expect(r.done).toBe(false);
    expect(r.tick(200).map((e) => e.type)).toEqual(['fly', 'fly']);
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

describe('describeWave', () => {
  it('lists groups by type in order', () => {
    expect(describeWave({ groups: [{ type: 'rat', count: 7 }, { type: 'fly', count: 16 }] })).toBe('Rats ×7 · Flies ×16');
  });
  it('merges groups of the same type', () => {
    expect(describeWave({ groups: [{ type: 'fly', count: 12 }, { type: 'fly', count: 8 }] })).toBe('Flies ×20');
  });
  it('announces the boss', () => {
    expect(describeWave(WAVES[6])).toBe('Le Monstre Blanc!');
  });
});

describe('waveAt (endless)', () => {
  it('returns the scripted waves with hpMult 1', () => {
    expect(waveAt(0)).toEqual({ ...WAVES[0], hpMult: 1 });
  });
  it('wave 8 scales the last wave without its boss', () => {
    const w = waveAt(7);
    expect(w.hpMult).toBeCloseTo(1.15);
    expect(w.groups.some((g) => g.type === 'monstre')).toBe(false);
    expect(w.groups.find((g) => g.type === 'corkscrew').count).toBe(14);
  });
  it('Le Monstre Blanc returns every 3rd endless wave', () => {
    expect(waveAt(9).groups.some((g) => g.type === 'monstre')).toBe(true);
  });
  it('caps every endless group at 30 pests (perf)', () => {
    for (const g of waveAt(40).groups) expect(g.count).toBeLessThanOrEqual(30);
  });
  it('buildSchedule carries hpMult', () => {
    expect(buildSchedule(waveAt(7))[0].hpMult).toBeCloseTo(1.15);
    expect(buildSchedule(WAVES[0])[0].hpMult).toBe(1);
  });
});
