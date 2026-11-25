import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/logic/state.js';
import { canPlace, placeTower, upgradeTower, towerStats, auraMult } from '../../src/logic/towers.js';
import { TOWERS } from '../../src/config/towers.js';

describe('towers', () => {
  it('place cork and block occupied spot', () => {
    const s = createGameState();
    expect(canPlace(s, 'cork', 'A').ok).toBe(true);
    const t = placeTower(s, 'cork', 'A');
    expect(t).toMatchObject({ type: 'cork', spotId: 'A', level: 0 });
    expect(s.grapes).toBe(100);
    expect(s.towers).toContain(t);
    expect(canPlace(s, 'cork', 'A')).toEqual({ ok: false, reason: 'occupied' });
    expect(placeTower(s, 'cork', 'A')).toBe(null);
    expect(s.grapes).toBe(100);
  });
  it('rejects when too poor', () => {
    const s = createGameState();
    s.grapes = 10;
    expect(canPlace(s, 'decanter', 'B')).toEqual({ ok: false, reason: 'grapes' });
    expect(placeTower(s, 'decanter', 'B')).toBe(null);
  });
  it('thomas is unique', () => {
    const s = createGameState();
    expect(placeTower(s, 'thomas', 'B')).not.toBe(null);
    expect(canPlace(s, 'thomas', 'C')).toEqual({ ok: false, reason: 'unique' });
  });
  it('upgrades thomas', () => {
    const s = createGameState();
    s.grapes = 1000;
    const t = placeTower(s, 'thomas', 'B');
    expect(towerStats(t).recruitCooldownMs).toBe(6000);
    expect(towerStats(t).aura).toBe(0.15);
    expect(upgradeTower(s, t)).toBe(true);
    expect(s.grapes).toBe(1000 - 120 - 150);
    expect(t.level).toBe(1);
    expect(towerStats(t).recruitCooldownMs).toBe(4500);
    expect(towerStats(t).name).toBe('Senior Recruiter');
    expect(upgradeTower(s, t)).toBe(true);
    expect(towerStats(t).recruitCooldownMs).toBe(3000);
    expect(towerStats(t).aura).toBe(0.25);
    expect(upgradeTower(s, t)).toBe(false);
    expect(t.level).toBe(2);
  });
  it('upgrade fails when poor and leaves state unchanged', () => {
    const s = createGameState();
    const t = placeTower(s, 'cork', 'A');
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
