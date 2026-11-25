import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/logic/state.js';
import { canPlace, placeTower, upgradeTower, towerStats, auraMult, snap } from '../../src/logic/towers.js';
import { TOWERS } from '../../src/config/towers.js';
import { CANDLES, BARRELS } from '../../src/config/map.js';

// Free spots well clear of the path (y 140/300/470) and the decor.
const A = { x: 250, y: 220 };
const B = { x: 500, y: 220 };
const C = { x: 750, y: 220 };

describe('towers', () => {
  it('place cork and block an overlapping spot', () => {
    const s = createGameState();
    expect(canPlace(s, 'cork', A).ok).toBe(true);
    const t = placeTower(s, 'cork', A);
    expect(t).toMatchObject({ type: 'cork', x: 250, y: 220, level: 0 });
    expect(s.grapes).toBe(100);
    expect(s.towers).toContain(t);
    expect(canPlace(s, 'cork', { x: 270, y: 230 })).toEqual({ ok: false, reason: 'occupied' });
    expect(placeTower(s, 'cork', { x: 270, y: 230 })).toBe(null);
    expect(s.grapes).toBe(100);
    expect(canPlace(s, 'cork', { x: 310, y: 220 }).ok).toBe(true); // 60px away is fine
  });
  it('refuses on the path', () => {
    const s = createGameState();
    expect(canPlace(s, 'cork', { x: 500, y: 140 })).toEqual({ ok: false, reason: 'path' });
    expect(canPlace(s, 'cork', { x: 500, y: 175 })).toEqual({ ok: false, reason: 'path' });
    expect(canPlace(s, 'cork', { x: 500, y: 192 }).ok).toBe(true);
  });
  it('refuses outside the playfield and under the HUD', () => {
    const s = createGameState();
    expect(canPlace(s, 'cork', { x: 10, y: 400 })).toEqual({ ok: false, reason: 'bounds' });
    expect(canPlace(s, 'cork', { x: 640, y: 640 })).toEqual({ ok: false, reason: 'bounds' });
    expect(canPlace(s, 'cork', { x: 100, y: 60 })).toEqual({ ok: false, reason: 'bounds' }); // Grapes panel
    expect(canPlace(s, 'cork', { x: 1100, y: 60 })).toEqual({ ok: false, reason: 'bounds' }); // Wave panel
    expect(canPlace(s, 'cork', { x: 600, y: 72 }).ok).toBe(true); // free strip between the panels
  });
  it('candles and barrels block placement', () => {
    const s = createGameState();
    for (const d of [CANDLES[0], BARRELS[6]]) {
      expect(canPlace(s, 'cork', { x: d.x + 8, y: d.y })).toEqual({ ok: false, reason: 'decor' });
    }
  });
  it('position refusals come before money refusals', () => {
    const s = createGameState();
    s.grapes = 0;
    expect(canPlace(s, 'cork', { x: 500, y: 140 }).reason).toBe('path');
    expect(canPlace(s, 'cork', B).reason).toBe('grapes');
  });
  it('rejects when too poor', () => {
    const s = createGameState();
    s.grapes = 10;
    expect(canPlace(s, 'decanter', B)).toEqual({ ok: false, reason: 'grapes' });
    expect(placeTower(s, 'decanter', B)).toBe(null);
  });
  it('thomas is unique', () => {
    const s = createGameState();
    expect(placeTower(s, 'thomas', B)).not.toBe(null);
    expect(canPlace(s, 'thomas', C)).toEqual({ ok: false, reason: 'unique' });
  });
  it('snaps to an 8px grid', () => {
    expect(snap({ x: 253, y: 219 })).toEqual({ x: 256, y: 216 });
    expect(snap({ x: 3.9, y: 4 })).toEqual({ x: 0, y: 8 });
  });
  it('upgrades thomas', () => {
    const s = createGameState();
    s.grapes = 1000;
    const t = placeTower(s, 'thomas', B);
    expect(towerStats(t).recruitCooldownMs).toBe(8000);
    expect(towerStats(t).aura).toBe(0.15);
    expect(upgradeTower(s, t)).toBe(true);
    expect(s.grapes).toBe(1000 - 120 - 150);
    expect(t.level).toBe(1);
    expect(towerStats(t).recruitCooldownMs).toBe(6000);
    expect(towerStats(t).name).toBe('Senior Recruiter');
    expect(upgradeTower(s, t)).toBe(true);
    expect(towerStats(t).recruitCooldownMs).toBe(4500);
    expect(towerStats(t).aura).toBe(0.25);
    expect(upgradeTower(s, t)).toBe(false);
    expect(t.level).toBe(2);
  });
  it('upgrade fails when poor and leaves state unchanged', () => {
    const s = createGameState();
    const t = placeTower(s, 'cork', A);
    s.grapes = 0;
    expect(upgradeTower(s, t)).toBe(false);
    expect(t.level).toBe(0);
  });
  it('Thomas boosts the fire rate of towers near him, not himself or far ones', () => {
    const thomas = { type: 'thomas', x: 0, y: 0, aura: 0.15, auraRange: 120 };
    const near = { type: 'cork', x: 100, y: 0 };
    const far = { type: 'cork', x: 130, y: 0 };
    const all = [thomas, near, far];
    expect(auraMult(all, near)).toBeCloseTo(1.15);
    expect(auraMult(all, far)).toBe(1);
    expect(auraMult(all, thomas)).toBe(1);
    expect(auraMult([near, far], near)).toBe(1);
  });
  it('config has names and 1-2 upgrades each', () => {
    for (const c of Object.values(TOWERS)) {
      expect(c.name).toBeTruthy();
      expect(c.upgrades.length).toBeGreaterThanOrEqual(1);
      expect(c.upgrades.length).toBeLessThanOrEqual(2);
    }
    expect(TOWERS.sommelier.name).toBe('Sommelier');
  });
});
