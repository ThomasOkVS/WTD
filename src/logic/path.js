// Shortest distance from a point to a polyline (any segment). Phaser-free.
export function distanceToPath(points, p) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

// Polyline path with distance-based position lookup. Phaser-free.
export function createPath(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const length = cum[cum.length - 1];

  function positionAt(d) {
    const dist = Math.max(0, Math.min(length, d));
    let i = 1;
    while (i < points.length - 1 && cum[i] < dist) i++;
    const a = points[i - 1], b = points[i];
    const segLen = cum[i] - cum[i - 1];
    const t = segLen === 0 ? 0 : (dist - cum[i - 1]) / segLen;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  return { length, positionAt };
}
