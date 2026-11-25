import { describe, it, expect } from 'vitest';
import { applyDamage, pickTarget } from '../../src/logic/combat.js';
import { ENEMIES } from '../../src/config/enemies.js';

describe('applyDamage', () => {
  it('subtracts armour', () => {
    const e = { hp: 60, armour: 4 };
    expect(applyDamage(e, 12)).toBe(8);
    expect(e.hp).toBe(52);
  });
  it('minimum 1 damage', () => {
    expect(applyDamage({ hp: 60, armour: 20 }, 12)).toBe(1);
  });
});

describe('pickTarget', () => {
  const tower = { x: 0, y: 0, range: 100 };
  it('picks the furthest-travelled enemy in range', () => {
    const a = { x: 50, y: 0, distance: 10, hp: 5 };
    const b = { x: 90, y: 0, distance: 40, hp: 5 };
    const c = { x: 300, y: 0, distance: 99, hp: 5 };
    expect(pickTarget(tower, [a, b, c])).toBe(b);
  });
  it('ignores dead enemies and returns null when none', () => {
    const dead = { x: 10, y: 0, distance: 50, hp: 0 };
    const flagged = { x: 10, y: 0, distance: 60, hp: 5, alive: false };
    expect(pickTarget(tower, [dead, flagged])).toBe(null);
    expect(pickTarget(tower, [])).toBe(null);
  });
});

describe('ENEMIES', () => {
  it('has spec values', () => {
    expect(ENEMIES.monstre).toMatchObject({ hp: 2500, speed: 25, armour: 6, reward: 200, leakCost: 10, splitInto: { type: 'can', count: 6 } });
    expect(ENEMIES.fly.leakCost).toBe(1);
    expect(ENEMIES.can.hp).toBe(80);
  });
});
