export const TOWERS = {
  sommelier: {
    name: 'Sommelier', cost: 70, range: 130, slow: 0.5, slowMs: 1200, rate: 1.0,
    upgrades: [
      { cost: 60, name: 'Master Sommelier', range: 150, slow: 0.65 },
      { cost: 110, name: 'Grand Sommelier', range: 170, slowMs: 2000 },
    ],
  },
  cork: {
    name: 'Cork Cannon', cost: 50, range: 150, damage: 12, rate: 3.0,
    upgrades: [
      { cost: 50, name: 'Double Cork', damage: 16, rate: 4.0 },
      { cost: 100, name: 'Champagne Barrage', damage: 22, rate: 5.0, range: 170 },
    ],
  },
  decanter: {
    name: 'Decanter', cost: 90, range: 120, damage: 18, splash: 60, rate: 0.8,
    upgrades: [
      { cost: 80, name: 'Crystal Decanter', damage: 28, splash: 75 },
      { cost: 140, name: 'Vintage Decanter', damage: 40, splash: 90, rate: 1.0 },
    ],
  },
  thomas: {
    name: 'Thomas', cost: 120, range: 140, damage: 8, rate: 1.5, recruitCooldownMs: 12000, unique: true,
    upgrades: [
      { cost: 150, name: 'Senior Recruiter', recruitCooldownMs: 8000 },
      { cost: 250, name: 'Head of Talent', recruitCooldownMs: 5000 },
    ],
  },
};
