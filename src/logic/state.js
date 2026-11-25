export function createGameState() {
  return { grapes: 150, lives: 20, wave: 0, towers: [], nests: [], buffs: [], status: 'playing' };
}

export function spend(state, amount) {
  if (state.grapes < amount) return false;
  state.grapes -= amount;
  return true;
}

export function earn(state, amount) {
  state.grapes += amount;
}

export function loseLives(state, n) {
  state.lives = Math.max(0, state.lives - n);
  if (state.lives <= 0) state.status = 'lost';
}
