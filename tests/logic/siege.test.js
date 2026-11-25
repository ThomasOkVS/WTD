import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGameState } from '../../src/logic/state.js';
import { canPlace, placeTower, upgradeTower, towerStats } from '../../src/logic/towers.js';
import {
  damageTower, investedIn, repairCost, repairTower, removeTower, createAttacker, tickAttacker, sellValue, sellTower,
} from '../../src/logic/siege.js';
import { ENEMIES, SIEGE } from '../../src/config/enemies.js';

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

const P = { x: 0, y: 0 };
const T = (id, x, y = 0) => ({ id, x, y, hp: 100 });

describe('siege: pest attackers', () => {
  // the logic tests use the raw config numbers; the tuned multiplier is checked on its own
  let tuned;
  beforeEach(() => { tuned = SIEGE.damageMult; SIEGE.damageMult = 1; });
  afterEach(() => { SIEGE.damageMult = tuned; });

  it('dash hits nearest in reach, then waits its cooldown', () => {
    const a = createAttacker(ENEMIES.fly.attack);
    expect(tickAttacker(a, P, [T(1, 80), T(2, 40)], 16).hits).toEqual([{ id: 2, damage: 3 }]);
    expect(tickAttacker(a, P, [T(2, 40)], 1000).hits).toEqual([]);
    expect(tickAttacker(a, P, [T(2, 40)], 900).hits).toHaveLength(1);
  });
  it('nothing in reach -> no hit', () => {
    expect(tickAttacker(createAttacker(ENEMIES.fly.attack), P, [T(1, 91)], 16).hits).toEqual([]);
  });
  it('ignores dead towers', () => {
    const dead = { ...T(1, 20), hp: 0 };
    expect(tickAttacker(createAttacker(ENEMIES.corkscrew.attack), P, [dead], 16).hits).toEqual([]);
  });
  it('ranged hits at range', () => {
    expect(tickAttacker(createAttacker(ENEMIES.corkscrew.attack), P, [T(1, 125)], 16).hits).toEqual([{ id: 1, damage: 6 }]);
  });
  it('chew holds and bites 4 times, then never re-chews that tower', () => {
    const a = createAttacker(ENEMIES.rat.attack);
    let bites = 0; let r;
    for (let t = 0; t < 2500; t += 50) { r = tickAttacker(a, P, [T(1, 70)], 50); bites += r.hits.length; }
    expect(bites).toBe(4);
    expect(r.holding).toBe(false);
  });
  it('chew lets go when its target dies', () => {
    const a = createAttacker(ENEMIES.rat.attack);
    expect(tickAttacker(a, P, [T(1, 70)], 16).holding).toBe(true);
    expect(tickAttacker(a, P, [], 16).holding).toBe(false);
  });
  it('burst marks selfDestruct once', () => {
    const a = createAttacker(ENEMIES.can.attack);
    expect(tickAttacker(a, P, [T(1, 60)], 16)).toMatchObject({ hits: [{ id: 1, damage: 25 }], selfDestruct: true });
    const again = tickAttacker(a, P, [T(1, 60)], 16);
    expect(again.hits).toEqual([]);
    expect(again.selfDestruct).toBe(false);
  });
  it('slam hits every tower in reach', () => {
    const r = tickAttacker(createAttacker(ENEMIES.monstre.attack), P, [T(1, 100), T(2, 150), T(3, 170)], 16);
    expect(r.hits.map((h) => h.id)).toEqual([1, 2]);
    expect(r.hits[0].damage).toBe(40);
  });
  it('damageMult scales and floors at 1', () => {
    SIEGE.damageMult = 0.1;
    expect(tickAttacker(createAttacker(ENEMIES.fly.attack), P, [T(1, 10)], 16).hits).toEqual([{ id: 1, damage: 1 }]);
    SIEGE.damageMult = 2;
    expect(tickAttacker(createAttacker(ENEMIES.fly.attack), P, [T(1, 10)], 16).hits).toEqual([{ id: 1, damage: 6 }]);
  });
  it('every enemy has an attack with reach >= 70', () => {
    for (const e of Object.values(ENEMIES)) expect(e.attack.reach).toBeGreaterThanOrEqual(70);
  });
});

describe('siege: selling', () => {
  beforeEach(() => { s = createGameState(); s.grapes = 1000; });
  it('a full-HP level-0 Cork Cannon sells for 70% of 50', () => {
    expect(sellValue(place('cork'))).toBe(35);
  });
  it('half HP halves the value (rounded down)', () => {
    const t = place('cork');
    t.hp = towerStats(t).maxHp / 2;
    expect(sellValue(t)).toBe(17);
  });
  it('counts upgrades', () => {
    const t = place('cork');
    upgradeTower(s, t);
    expect(sellValue(t)).toBe(70);
  });
  it('sellTower removes the tower and pays out', () => {
    const t = place('cork');
    const before = s.grapes;
    expect(sellTower(s, t)).toBe(35);
    expect(s.towers).not.toContain(t);
    expect(s.grapes).toBe(before + 35);
  });
});
