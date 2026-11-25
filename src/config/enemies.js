// Speeds tuned for a lively demo: the path is ~3200 px, so a fly crosses it
// in ~16 s, a corkscrew ~25 s, a rat ~34 s, Le Monstre Blanc ~71 s.
export const ENEMIES = {
  fly: { hp: 20, speed: 200, armour: 0, reward: 3, leakCost: 1, attack: { style: 'dash', reach: 90, damage: 3, cooldownMs: 1800 } },
  corkscrew: { hp: 60, speed: 130, armour: 4, reward: 6, leakCost: 1, attack: { style: 'ranged', reach: 130, damage: 6, cooldownMs: 2000 } },
  rat: { hp: 140, speed: 95, armour: 0, reward: 10, leakCost: 1, attack: { style: 'chew', reach: 75, damage: 5, biteMs: 500, chewMs: 2000 } },
  monstre: { hp: 2200, speed: 45, armour: 6, reward: 200, leakCost: 10, splitInto: { type: 'can', count: 6 },
    attack: { style: 'slam', reach: 160, damage: 30, cooldownMs: 4000 } },
  can: { hp: 80, speed: 110, armour: 2, reward: 4, leakCost: 1, attack: { style: 'burst', reach: 70, damage: 25 } },
};

// Pests fight back: global tuning for tower damage and repair pricing.
export const SIEGE = { damageMult: 1, repairShare: 0.5 };
