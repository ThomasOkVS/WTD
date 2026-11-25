// Speeds tuned for a lively demo: the path is ~3200 px, so a fly crosses it
// in ~16 s, a corkscrew ~25 s, a rat ~34 s, Le Monstre Blanc ~71 s.
export const ENEMIES = {
  fly: { hp: 20, speed: 200, armour: 0, reward: 3, leakCost: 1 },
  corkscrew: { hp: 60, speed: 130, armour: 4, reward: 6, leakCost: 1 },
  rat: { hp: 140, speed: 95, armour: 0, reward: 10, leakCost: 1 },
  monstre: { hp: 2200, speed: 45, armour: 6, reward: 200, leakCost: 10, splitInto: { type: 'can', count: 6 } },
  can: { hp: 80, speed: 110, armour: 2, reward: 4, leakCost: 1 },
};
