export const ENEMIES = {
  fly: { hp: 20, speed: 120, armour: 0, reward: 3, leakCost: 1 },
  corkscrew: { hp: 60, speed: 70, armour: 4, reward: 6, leakCost: 1 },
  rat: { hp: 140, speed: 45, armour: 0, reward: 10, leakCost: 1 },
  monstre: { hp: 2500, speed: 25, armour: 6, reward: 200, leakCost: 10, splitInto: { type: 'can', count: 6 } },
  can: { hp: 80, speed: 60, armour: 2, reward: 4, leakCost: 1 },
};
