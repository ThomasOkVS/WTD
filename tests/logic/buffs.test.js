import { describe, it, expect } from 'vitest';
import { drawTasting, applyBuffs, createPowerUp } from '../../src/logic/buffs.js';
import { TASTING_WINES } from '../../src/config/tastings.js';

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('tasting', () => {
  it('has at least 6 wines with valid shape', () => {
    expect(TASTING_WINES.length).toBeGreaterThanOrEqual(6);
    for (const w of TASTING_WINES) {
      expect(w.id && w.name && w.line).toBeTruthy();
      expect(typeof w.effect.mult).toBe('number');
    }
  });
  it('draws 3 distinct wines', () => {
    for (let i = 0; i < 20; i++) expect(new Set(drawTasting().map(w => w.id)).size).toBe(3);
  });
  it('is deterministic with a seeded rng', () => {
    const a = drawTasting(seeded(42)).map(w => w.id);
    const b = drawTasting(seeded(42)).map(w => w.id);
    expect(a).toEqual(b);
  });
});

describe('applyBuffs', () => {
  it('multiplies matching stat', () => {
    expect(applyBuffs({ range: 100 }, [{ stat: 'range', mult: 1.2 }]).range).toBe(120);
  });
  it('stacks two buffs multiplicatively', () => {
    const r = applyBuffs({ damage: 10 }, [{ stat: 'damage', mult: 1.5 }, { stat: 'damage', mult: 2 }]);
    expect(r.damage).toBe(30);
  });
  it('ignores tower-targeted buff for other types', () => {
    const buffs = [{ stat: 'damage', mult: 2, tower: 'cork' }];
    expect(applyBuffs({ type: 'decanter', damage: 10 }, buffs).damage).toBe(10);
    expect(applyBuffs({ type: 'cork', damage: 10 }, buffs).damage).toBe(20);
  });
  it('does not mutate input', () => {
    const s = { range: 100 };
    applyBuffs(s, [{ stat: 'range', mult: 2 }]);
    expect(s.range).toBe(100);
  });
});

describe('power-up', () => {
  it('follows active/cooldown lifecycle', () => {
    const p = createPowerUp({ durationMs: 10000, cooldownMs: 45000 });
    expect(p.ready).toBe(true);
    expect(p.fireRateMult()).toBe(1);
    expect(p.activate()).toBe(true);
    expect(p.fireRateMult()).toBe(2);
    p.tick(5000, { paused: true });
    expect(p.active).toBe(true);
    p.tick(10000, { paused: false });
    expect(p.active).toBe(false);
    expect(p.activate()).toBe(false);
    p.tick(45000, { paused: false });
    expect(p.ready).toBe(true);
  });
});
