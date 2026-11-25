import { describe, it, expect, beforeEach } from 'vitest';
import { createGameState } from '../../src/logic/state.js';
import { canPlace, placeTower, upgradeTower, towerStats } from '../../src/logic/towers.js';
import {
  damageTower, investedIn, repairCost, repairTower, removeTower,
} from '../../src/logic/siege.js';

const A = { x: 250, y: 220 };
const B = { x: 500, y: 220 };

let s;
const place = (type, pos = A) => placeTower(s, type, pos);

describe('siege: tower hp and repair', () => {
  beforeEach(() => { s = createGameState(); s.grapes = 1000; });

  it('placed tower starts at full hp', () => {
    const t = place('cork');
    expect(t.hp).toBe(60);
    expect(towerStats(t).maxHp).toBe(60);
  });
  it('upgrade adds the max-hp gain and keeps damage', () => {
    const t = place('cork');
    damageTower(t, 20); // 40/60
    upgradeTower(s, t);
    expect(t.hp).toBe(70); // +30 -> 70/90
    expect(towerStats(t).maxHp).toBe(90);
  });
  it('damageTower clamps and reports destruction once', () => {
    const t = place('cork');
    expect(damageTower(t, 59)).toBe(false);
    expect(damageTower(t, 50)).toBe(true);
    expect(t.hp).toBe(0);
    expect(damageTower(t, 5)).toBe(false);
  });
  it('repairCost scales with missing hp and grapes invested', () => {
    const t = place('cork');
    upgradeTower(s, t); // invested 100, max 90
    expect(investedIn(t)).toBe(100);
    t.hp = 45; expect(repairCost(t)).toBe(25);
    t.hp = 89; expect(repairCost(t)).toBe(1);
  });
  it('repair refuses full/grapes and leaves grapes unchanged', () => {
    const t = place('cork');
    expect(repairTower(s, t)).toEqual({ ok: false, reason: 'full' });
    t.hp = 1; s.grapes = 0;
    expect(repairTower(s, t)).toEqual({ ok: false, reason: 'grapes' });
    expect(s.grapes).toBe(0);
    expect(t.hp).toBe(1);
  });
  it('repair spends and heals to max', () => {
    const t = place('cork');
    t.hp = 30; const g = s.grapes;
    expect(repairTower(s, t)).toEqual({ ok: true, cost: 13 });
    expect(t.hp).toBe(60);
    expect(s.grapes).toBe(g - 13);
  });
  it('removeTower frees a unique Thomas', () => {
    const t = place('thomas');
    expect(canPlace(s, 'thomas', B)).toEqual({ ok: false, reason: 'unique' });
    removeTower(s, t);
    expect(s.towers).not.toContain(t);
    expect(canPlace(s, 'thomas', B).ok).toBe(true);
  });
});
