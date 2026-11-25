// Seven waves: flies -> corkscrews -> rats -> mixed -> Le Monstre Blanc.
// Spawn spreads kept short (~5-12 s) so a wave lasts ~15-25 s end to end.
export const WAVES = [
  { groups: [{ type: 'fly', count: 8, intervalMs: 700, delayMs: 0 }] },
  { groups: [{ type: 'fly', count: 12, intervalMs: 450, delayMs: 0 }, { type: 'corkscrew', count: 3, intervalMs: 1000, delayMs: 3000 }] },
  { groups: [{ type: 'corkscrew', count: 8, intervalMs: 800, delayMs: 0 }, { type: 'fly', count: 10, intervalMs: 400, delayMs: 2000 }] },
  { groups: [{ type: 'corkscrew', count: 8, intervalMs: 700, delayMs: 0 }, { type: 'rat', count: 3, intervalMs: 1600, delayMs: 3500 }] },
  { groups: [{ type: 'rat', count: 7, intervalMs: 1300, delayMs: 0 }, { type: 'fly', count: 16, intervalMs: 350, delayMs: 1500 }] },
  { groups: [{ type: 'rat', count: 8, intervalMs: 1100, delayMs: 0 }, { type: 'corkscrew', count: 14, intervalMs: 500, delayMs: 2000 }, { type: 'fly', count: 14, intervalMs: 300, delayMs: 4000 }] },
  { groups: [{ type: 'corkscrew', count: 12, intervalMs: 500, delayMs: 0 }, { type: 'rat', count: 8, intervalMs: 1000, delayMs: 2000 }, { type: 'fly', count: 20, intervalMs: 250, delayMs: 3500 }, { type: 'monstre', count: 1, intervalMs: 0, delayMs: 9000 }] },
];
