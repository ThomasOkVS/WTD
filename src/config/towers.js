export const TOWERS = {
  sommelier: {
    name: 'Sommelier', blurb: 'Sniffs out pests and slows them down.', cost: 70, range: 130, slow: 0.5, slowMs: 1200, rate: 1.0, maxHp: 70,
    upgrades: [
      { cost: 60, name: 'Master Sommelier', range: 150, slow: 0.65, maxHp: 100 },
      { cost: 110, name: 'Grand Sommelier', range: 170, slowMs: 2000, maxHp: 140 },
    ],
  },
  cork: {
    name: 'Cork Cannon', blurb: 'Rapid corks at one pest at a time.', cost: 50, range: 150, damage: 12, rate: 3.0, maxHp: 60,
    upgrades: [
      { cost: 50, name: 'Double Cork', damage: 16, rate: 4.0, maxHp: 90 },
      { cost: 100, name: 'Champagne Barrage', damage: 22, rate: 5.0, range: 170, maxHp: 130 },
    ],
  },
  decanter: {
    name: 'Decanter', blurb: 'Bursts wine all around itself, hitting every pest close by. Build it next to the path.', cost: 90, range: 85, damage: 35, rate: 0.9, maxHp: 120,
    upgrades: [
      { cost: 80, name: 'Crystal Decanter', damage: 50, range: 95, maxHp: 170 },
      { cost: 140, name: 'Vintage Decanter', damage: 70, range: 105, rate: 1.1, maxHp: 240 },
    ],
  },
  thomas: {
    name: 'Thomas', blurb: 'Recruits a pest that walks back and smashes every pest it meets. Towers near him fire faster.',
    cost: 120, range: 140, damage: 8, rate: 1.5, recruitCooldownMs: 8000, aura: 0.15, auraRange: 120, unique: true, maxHp: 100,
    upgrades: [
      { cost: 150, name: 'Senior Recruiter', recruitCooldownMs: 6000, maxHp: 140 },
      { cost: 250, name: 'Head of Talent', recruitCooldownMs: 4500, aura: 0.25, maxHp: 200 },
    ],
  },
};

// One short stat line per tower, built from (merged, buffed) stats so it
// follows upgrades, buffs and retunes. Used by the HUD tooltips.
export function statLine(s) {
  const line = statCore(s);
  return s.maxHp ? `${line} · ${s.maxHp} HP` : line;
}

function statCore(s) {
  const r = Math.round(s.range);
  const num = (n) => (Math.round(n * 10) / 10).toString();
  switch (s.type) {
    case 'sommelier':
      return `Slows ${Math.round(s.slow * 100)}% for ${num(s.slowMs / 1000)}s · range ${r}`;
    case 'decanter':
      return s.splash
        ? `${Math.round(s.damage)} dmg splash · ${num(s.rate)}/s · range ${r}`
        : `${Math.round(s.damage)} dmg to every pest within ${r} · ${num(s.rate)}/s`;
    case 'thomas':
      return `Recruit every ${num(s.recruitCooldownMs / 1000)}s` +
        (s.aura ? ` · nearby towers +${Math.round(s.aura * 100)}% fire rate` : ` · ${Math.round(s.damage)} dmg ${num(s.rate)}/s`);
    default:
      return `${Math.round(s.damage)} dmg · ${num(s.rate)}/s · range ${r}`;
  }
}
