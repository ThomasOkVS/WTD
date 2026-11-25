export const PALETTE = {
  amber: '#ffb35c',
  candleGold: '#e8c07a',
  burgundy: '#8a1c2b',
  wineRed: '#d01a3a',
  stone: '#3a2a22',
  path: '#5a3d2b',
  shadow: '#120a0d',
  parchment: '#e9dcc0',
  ink: '#3a1a12',
};

export const COLORS = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
);
