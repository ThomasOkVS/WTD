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
      { atMs: 0, type: 'fly', hpMult: 1, speedMult: 1 }, { atMs: 50, type: 'rat', hpMult: 1, speedMult: 1 }, { atMs: 100, type: 'fly', hpMult: 1, speedMult: 1 }, { atMs: 200, type: 'fly', hpMult: 1, speedMult: 1 },
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

describe('waveAt (difficulty curve)', () => {
  it('waves 1-5 are unchanged', () => {
    for (let i = 0; i < 5; i++) expect(waveAt(i)).toEqual({ ...WAVES[i], hpMult: 1, speedMult: 1 });
  });
  it('wave 6 ramps hp, speed and counts', () => {
    const w = waveAt(5);
    expect(w.hpMult).toBeCloseTo(1.35);
    expect(w.speedMult).toBeCloseTo(1.04);
    WAVES[5].groups.forEach((g, i) => expect(w.groups[i].count).toBe(Math.min(30, Math.round(g.count * 1.25))));
  });
  it('wave 7 keeps a single boss', () => {
    const w = waveAt(6);
    expect(w.hpMult).toBeCloseTo(1.7);
    expect(w.groups.find((g) => g.type === 'monstre').count).toBe(1);
  });
  it('the scripted wave-7 boss is not wave-scaled, the Endless boss is', () => {
    const boss = (i) => buildSchedule(waveAt(i)).find((e) => e.type === 'monstre');
    expect(boss(6)).toMatchObject({ hpMult: 1, speedMult: 1 });
    expect(boss(9).hpMult).toBeCloseTo(2.75);
  });
  it('wave 8 (endless) continues the curve without the boss', () => {
    const w = waveAt(7);
    expect(w.hpMult).toBeCloseTo(2.05);
    expect(w.groups.some((g) => g.type === 'monstre')).toBe(false);
  });
  it('wave 10 is 2.75x and brings Le Monstre Blanc back', () => {
    const w = waveAt(9);
    expect(w.hpMult).toBeCloseTo(2.75);
    expect(w.groups.find((g) => g.type === 'monstre').count).toBe(1);
  });
  it('caps speed at 1.4 and every group at 30 pests (perf)', () => {
    const w = waveAt(40);
    expect(w.speedMult).toBeCloseTo(1.4);
    for (const g of w.groups) expect(g.count).toBeLessThanOrEqual(30);
  });
  it('buildSchedule carries hpMult and speedMult', () => {
    const e = buildSchedule(waveAt(6))[0];
    expect(e.hpMult).toBeCloseTo(1.7);
    expect(e.speedMult).toBeCloseTo(1.08);
    expect(buildSchedule(WAVES[0])[0].hpMult).toBe(1);
  });
});
