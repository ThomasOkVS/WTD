// Seven waves: flies -> corkscrews -> rats -> mixed -> Le Monstre Blanc.
export const WAVES = [
  { groups: [{ type: 'fly', count: 8, intervalMs: 900, delayMs: 0 }] },
  { groups: [{ type: 'fly', count: 12, intervalMs: 600, delayMs: 0 }, { type: 'corkscrew', count: 3, intervalMs: 1400, delayMs: 4000 }] },
  { groups: [{ type: 'corkscrew', count: 8, intervalMs: 1100, delayMs: 0 }, { type: 'fly', count: 10, intervalMs: 500, delayMs: 3000 }] },
  { groups: [{ type: 'corkscrew', count: 8, intervalMs: 900, delayMs: 0 }, { type: 'rat', count: 3, intervalMs: 2200, delayMs: 5000 }] },
  { groups: [{ type: 'rat', count: 7, intervalMs: 1800, delayMs: 0 }, { type: 'fly', count: 16, intervalMs: 450, delayMs: 2000 }] },
  { groups: [{ type: 'rat', count: 8, intervalMs: 1500, delayMs: 0 }, { type: 'corkscrew', count: 14, intervalMs: 700, delayMs: 3000 }, { type: 'fly', count: 14, intervalMs: 400, delayMs: 6000 }] },
  { groups: [{ type: 'corkscrew', count: 12, intervalMs: 700, delayMs: 0 }, { type: 'rat', count: 8, intervalMs: 1400, delayMs: 3000 }, { type: 'fly', count: 20, intervalMs: 350, delayMs: 5000 }, { type: 'monstre', count: 1, intervalMs: 0, delayMs: 20000 }] },
];
