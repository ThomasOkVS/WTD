// Speeds tuned for a lively demo: the path is ~3200 px, so a fly crosses it
// in ~16 s, a corkscrew ~25 s, a rat ~34 s, Le Monstre Blanc ~71 s.
export const ENEMIES = {
  fly: { hp: 20, speed: 200, armour: 0, reward: 3, leakCost: 1, attack: { style: 'dash', reach: 90, damage: 3, cooldownMs: 1800 } },
  corkscrew: { hp: 60, speed: 130, armour: 4, reward: 6, leakCost: 1, attack: { style: 'ranged', reach: 130, damage: 6, cooldownMs: 2000 } },
  rat: { hp: 140, speed: 95, armour: 0, reward: 10, leakCost: 1, attack: { style: 'chew', reach: 75, damage: 5, biteMs: 500, chewMs: 2000 } },
  // Below enrage.at HP it turns furious (faster, slams more often); while alive
  // it spits summon.count cans behind it every summon.everyMs (scene time).
  // Balance (demo script must win and split the boss): hp/armour stay 2200/6; it is
  // harder through the 40-damage slam, 8 cans, the furious phase and the summons.
  monstre: { hp: 2200, speed: 45, armour: 6, reward: 200, leakCost: 10, splitInto: { type: 'can', count: 8 },
    attack: { style: 'slam', reach: 160, damage: 30, cooldownMs: 4000 },
    enrage: { at: 0.5, speedMult: 1.35, slamCooldownMs: 2500 },
    summon: { type: 'can', count: 2, everyMs: 10000, firstMs: 5000 } },
  can: { hp: 80, speed: 110, armour: 2, reward: 4, leakCost: 1, attack: { style: 'burst', reach: 70, damage: 25 } },
};

// Pests fight back: global tuning for tower damage and repair pricing.
// damageMult 0.4: an unrepaired honest build loses ~1 tower by wave 6 and still wins.
export const SIEGE = { damageMult: 0.4, repairShare: 0.5 };

// Pest nests: a tower destroyed by pests becomes a nest that spawns
// base + perLevel * level pests during the next wave (src/logic/nests.js).
// enabled: false is the kill switch (no nests are ever created).
export const NESTS = {
  enabled: true,
  spawn: { cork: 'fly', sommelier: 'corkscrew', decanter: 'corkscrew', thomas: 'rat' },
  base: 2, perLevel: 2, intervalMs: 1200, delayMs: 2000,
};
