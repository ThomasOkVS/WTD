export function applyDamage(enemy, rawDamage) {
  const dealt = Math.max(1, rawDamage - (enemy.armour || 0));
  enemy.hp -= dealt;
  return dealt;
}

const isAlive = (e) => e.hp > 0 && e.alive !== false;

// "First" targeting: alive enemy in range that has travelled furthest.
export function pickTarget(tower, enemies) {
  let best = null;
  for (const e of enemies) {
    if (!isAlive(e)) continue;
    if (Math.hypot(e.x - tower.x, e.y - tower.y) > tower.range) continue;
    if (!best || e.distance > best.distance) best = e;
  }
  return best;
}

// A recruit's HP is a damage budget: each smash spends what it deals.
export function recruitSmash(budget, foeHp) {
  const deal = Math.max(0, Math.min(budget, foeHp));
  return { deal, left: Math.max(0, budget - deal) };
}
