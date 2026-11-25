import { describe, it, expect } from 'vitest';
import { createGameState, spend, earn, loseLives } from '../../src/logic/state.js';

describe('state', () => {
  it('spend/earn', () => {
    const s = createGameState();
    expect(spend(s, 200)).toBe(false);
    expect(s.grapes).toBe(150);
    expect(spend(s, 50)).toBe(true);
    expect(s.grapes).toBe(100);
    earn(s, 25);
    expect(s.grapes).toBe(125);
  });
  it('loseLives sets lost at <= 0', () => {
    const s = createGameState();
    loseLives(s, 5);
    expect(s.lives).toBe(15);
    expect(s.status).toBe('playing');
    loseLives(s, 20);
    expect(s.status).toBe('lost');
  });
  it('fresh run is clean', () => {
    const s = createGameState();
    spend(s, 100);
    const f = createGameState();
    expect(f).toMatchObject({ grapes: 150, lives: 20, wave: 0, towers: [], buffs: [], status: 'playing' });
  });
});
