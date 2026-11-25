import { TASTING_WINES } from '../config/tastings.js';

export function drawTasting(rng = Math.random) {
  const pool = [...TASTING_WINES];
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function applyBuffs(stats, buffs = []) {
  const out = { ...stats };
  for (const b of buffs) {
    if (b.tower && b.tower !== stats.type) continue;
    if (typeof out[b.stat] === 'number') out[b.stat] *= b.mult;
  }
  return out;
}

export function createPowerUp({ durationMs = 10000, cooldownMs = 45000 } = {}) {
  let activeLeft = 0;
  let coolLeft = 0;
  return {
    get active() { return activeLeft > 0; },
    get ready() { return activeLeft <= 0 && coolLeft <= 0; },
    get activeLeft() { return activeLeft; },
    get cooldownLeft() { return coolLeft; },
    activate() {
      if (!this.ready) return false;
      activeLeft = durationMs;
      return true;
    },
    tick(dtMs, { paused = false } = {}) {
      if (paused) return;
      let dt = dtMs;
      if (activeLeft > 0) {
        const used = Math.min(activeLeft, dt);
        activeLeft -= used;
        dt -= used;
        if (activeLeft <= 0) { activeLeft = 0; coolLeft = cooldownMs; }
      }
      if (dt > 0 && coolLeft > 0) coolLeft = Math.max(0, coolLeft - dt);
    },
    fireRateMult() { return activeLeft > 0 ? 2 : 1; },
  };
}
