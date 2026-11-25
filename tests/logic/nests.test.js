import { describe, it, expect } from 'vitest';
import { distanceAlongPath } from '../../src/logic/path.js';
import { createNest, armNests, nestSchedule, collapseNests, nestPests } from '../../src/logic/nests.js';
import { buildSchedule, createWaveRunner } from '../../src/logic/waves.js';
import { canPlace } from '../../src/logic/towers.js';
import { createGameState } from '../../src/logic/state.js';

const at = () => 500;

describe('distanceAlongPath', () => {
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  it('measures the arc length to the closest point', () => {
    expect(distanceAlongPath(pts, { x: 50, y: 20 })).toBeCloseTo(50);
    expect(distanceAlongPath(pts, { x: 120, y: 60 })).toBeCloseTo(160);
  });
});

describe('pest nests', () => {
  const thomas = { id: 7, type: 'thomas', x: 300, y: 200, level: 2 };

  it('a new nest is unarmed and remembers the dead tower', () => {
    const n = createNest(thomas);
    expect(n).toMatchObject({ type: 'thomas', level: 2, x: 300, y: 200, armed: false });
  });

  it('spawns nothing until armed, then 2 + 2 per level', () => {
    const nests = [createNest(thomas)];
    expect(nestSchedule(nests, at, 1)).toEqual([]);
    armNests(nests);
    const s = nestSchedule(nests, at, 1.15);
    expect(s).toHaveLength(6);
    expect(s.every((e) => e.type === 'rat' && e.distance === 500 && e.hpMult === 1.15)).toBe(true);
    expect(s[0].atMs).toBe(2000);
    expect(s[1].atMs).toBe(3200);
    expect(nestPests(nests)).toBe(6);
  });

  it('a nest made mid-wave waits for the next wave', () => {
    const nests = [createNest(thomas)];
    armNests(nests);
    nests.push(createNest({ id: 8, type: 'cork', x: 500, y: 220, level: 0 }));
    expect(nestSchedule(nests, at, 1)).toHaveLength(6);
  });

  it('collapse removes only the armed nests', () => {
    const state = createGameState();
    state.nests.push(createNest(thomas));
    armNests(state.nests);
    state.nests.push(createNest({ id: 8, type: 'cork', x: 500, y: 220, level: 0 }));
    const gone = collapseNests(state);
    expect(gone).toHaveLength(1);
    expect(state.nests.map((n) => n.type)).toEqual(['cork']);
  });

  it('the wave is not done until the nest pests are out', () => {
    const nests = [createNest({ id: 9, type: 'cork', x: 0, y: 0, level: 0 })];
    armNests(nests);
    const merged = [...buildSchedule({ groups: [{ type: 'fly', count: 1, intervalMs: 0, delayMs: 0 }] }), ...nestSchedule(nests, at, 1)]
      .sort((a, b) => a.atMs - b.atMs);
    const r = createWaveRunner(merged);
    expect(r.tick(100).map((e) => e.type)).toEqual(['fly']);
    expect(r.done).toBe(false);
    expect(r.tick(1900)[0]).toMatchObject({ type: 'fly', distance: 500 });
    expect(r.done).toBe(false);
    r.tick(1200);
    expect(r.done).toBe(true);
  });

  it('a nest blocks building on its spot', () => {
    const state = createGameState();
    state.grapes = 1000;
    state.nests.push(createNest({ id: 9, type: 'cork', x: 250, y: 220, level: 0 }));
    expect(canPlace(state, 'cork', { x: 260, y: 220 })).toEqual({ ok: false, reason: 'occupied' });
  });
});
