// Wine Tasting buffs. Stats: range, damage, rate, slowMs, splash, reward (grapes per kill).
// effect.tower (optional) restricts the buff to one tower type.
export const TASTING_WINES = [
  { id: 'chateau-range', name: 'Chateau Range 2019', line: 'Long finish, long reach. Like a good job offer.', effect: { stat: 'range', mult: 1.2 } },
  { id: 'cork-reserve', name: 'Cork Reserve', line: 'Pops with confidence. I would hire it.', effect: { stat: 'damage', mult: 1.25, tower: 'cork' } },
  { id: 'slow-pinot', name: 'Slow Pinot', line: 'Take your time. The enemies certainly will.', effect: { stat: 'slowMs', mult: 1.3 } },
  { id: 'grape-harvest', name: 'Grape Harvest', line: 'Great ROI: more grapes per candidate.', effect: { stat: 'reward', mult: 1.25 } },
  { id: 'merlot-momentum', name: 'Merlot Momentum', line: 'Smooth, fast, and perfect for onboarding.', effect: { stat: 'rate', mult: 1.15 } },
  { id: 'grand-decant', name: 'Grand Decant', line: 'Lots of body, a wider pour. A full-time hire.', effect: { stat: 'range', mult: 1.25, tower: 'decanter' } },
  { id: 'tannin-talent', name: 'Tannin Talent', line: 'Bold structure. Strong team player.', effect: { stat: 'damage', mult: 1.15 } },
];
