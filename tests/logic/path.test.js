import { describe, it, expect } from 'vitest';
import { createPath, distanceToPath } from '../../src/logic/path.js';
import { PATH, CANDLES, BARRELS, GRAND_CRU } from '../../src/config/map.js';

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

describe('createPath', () => {
  const p = createPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
  it('computes length', () => expect(p.length).toBe(150));
  it('interpolates positions', () => {
    expect(p.positionAt(50)).toMatchObject({ x: 50, y: 0 });
    expect(p.positionAt(125)).toMatchObject({ x: 100, y: 25 });
  });
  it('clamps', () => {
    expect(p.positionAt(999)).toMatchObject({ x: 100, y: 50 });
    expect(p.positionAt(-5)).toMatchObject({ x: 0, y: 0 });
  });
  it('gives heading angle', () => {
    expect(p.positionAt(50).angle).toBeCloseTo(0);
    expect(p.positionAt(125).angle).toBeCloseTo(Math.PI / 2);
  });
});

describe('distanceToPath', () => {
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }];
  it('measures to the nearest segment', () => {
    expect(distanceToPath(pts, { x: 50, y: 30 })).toBe(30);
    expect(distanceToPath(pts, { x: 130, y: 25 })).toBe(30);
    expect(distanceToPath(pts, { x: -40, y: 0 })).toBe(40); // past the first point
  });
  it('matches the reference point-segment math on the real map', () => {
    const p = { x: 450, y: 385 };
    let best = Infinity;
    for (let i = 0; i < PATH.length - 1; i++) best = Math.min(best, distToSegment(p, PATH[i], PATH[i + 1]));
    expect(distanceToPath(PATH, p)).toBeCloseTo(best);
  });
});

describe('map', () => {
  it('path enters off-screen left and ends at the Grand Cru near the right edge', () => {
    expect(PATH[0].x).toBeLessThan(0);
    expect(PATH.at(-1)).toEqual(GRAND_CRU);
    expect(GRAND_CRU.x).toBeGreaterThan(1100);
  });
  it('keeps the bottom HUD band free of the path', () => {
    for (const q of PATH) expect(q.y).toBeLessThanOrEqual(610);
  });
  it('has 6 candles and some barrels, none of them on the path', () => {
    expect(CANDLES.length).toBe(6);
    expect(BARRELS.length).toBeGreaterThan(0);
    for (const d of [...CANDLES, ...BARRELS]) expect(distanceToPath(PATH, d)).toBeGreaterThanOrEqual(50);
  });
});
