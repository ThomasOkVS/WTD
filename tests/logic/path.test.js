import { describe, it, expect } from 'vitest';
import { createPath } from '../../src/logic/path.js';
import { PATH, BUILD_SPOTS, CANDLES, GRAND_CRU } from '../../src/config/map.js';

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

describe('map', () => {
  it('path enters off-screen left and ends at the Grand Cru near the right edge', () => {
    expect(PATH[0].x).toBeLessThan(0);
    expect(PATH.at(-1)).toEqual(GRAND_CRU);
    expect(GRAND_CRU.x).toBeGreaterThan(1100);
  });
  it('keeps the HUD bands free of path and spots', () => {
    for (const q of PATH) expect(q.y).toBeLessThanOrEqual(610);
    for (const s of BUILD_SPOTS) {
      expect(s.y).toBeLessThanOrEqual(610);
      expect(s.y).toBeGreaterThanOrEqual(60);
    }
  });
  it('has about 12 spots and 6 candles', () => {
    expect(BUILD_SPOTS.length).toBe(12);
    expect(CANDLES.length).toBe(6);
    expect(new Set(BUILD_SPOTS.map((s) => s.id)).size).toBe(12);
  });
  it('every build spot is >= 50px from every path segment', () => {
    for (const s of BUILD_SPOTS)
      for (let i = 0; i < PATH.length - 1; i++)
        expect(distToSegment(s, PATH[i], PATH[i + 1])).toBeGreaterThanOrEqual(50);
  });
  it('spots do not overlap (>= 60px apart)', () => {
    for (let i = 0; i < BUILD_SPOTS.length; i++)
      for (let j = i + 1; j < BUILD_SPOTS.length; j++)
        expect(Math.hypot(BUILD_SPOTS[i].x - BUILD_SPOTS[j].x, BUILD_SPOTS[i].y - BUILD_SPOTS[j].y)).toBeGreaterThanOrEqual(60);
  });
});
