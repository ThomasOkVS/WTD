import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

async function load() {
  vi.resetModules();
  return import('../../src/fx/projector.js');
}

describe('projector mode', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to off', async () => {
    const { isProjector } = await load();
    expect(isProjector()).toBe(false);
  });

  it('toggle flips and returns the new state', async () => {
    const { isProjector, toggleProjector } = await load();
    expect(toggleProjector()).toBe(true);
    expect(isProjector()).toBe(true);
    expect(toggleProjector()).toBe(false);
  });

  it('remembers the mode across a reload', async () => {
    (await load()).toggleProjector();
    expect((await load()).isProjector()).toBe(true);
  });

  it('notifies subscribers and stops after unsubscribe', async () => {
    const { toggleProjector, onProjectorChange } = await load();
    const seen = [];
    const off = onProjectorChange((v) => seen.push(v));
    toggleProjector();
    off();
    toggleProjector();
    expect(seen).toEqual([true]);
  });

  it('survives a throwing localStorage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    const { toggleProjector } = await load();
    expect(typeof toggleProjector()).toBe('boolean');
  });
});
