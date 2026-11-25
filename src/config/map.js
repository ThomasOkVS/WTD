// Winding S-shaped path through the cellar, logical resolution 1280x720.
// Bottom ~110px (y > 598) is reserved for the HUD tower bar, top-left/right for the HUD panels.
export const PATH = [
  { x: -40, y: 140 },
  { x: 1050, y: 140 },
  { x: 1050, y: 300 },
  { x: 220, y: 300 },
  { x: 220, y: 470 },
  { x: 1170, y: 470 },
];

export const GRAND_CRU = { x: 1170, y: 470 };

// Free placement: towers go anywhere inside the playfield that is clear of
// the path, the HUD panels, other towers and the decor.
export const PLAYFIELD = { minX: 30, maxX: 1250, minY: 60, maxY: 590 };
// Top HUD panels (Grapes + mute on the left, Wave + Grand Cru on the right).
export const HUD_ZONES = [
  { x0: 0, x1: 272, y0: 0, y1: 86 },
  { x0: 940, x1: 1280, y0: 0, y1: 86 },
];
export const PATH_CLEARANCE = 44; // tower centre to path centreline (path is 56px wide)
export const TOWER_SPACING = 48; // tower centre to tower centre
export const DECOR_FOOTPRINT = 30; // tower centre to a candle or barrel
export const GRID = 8;

export const CANDLES = [
  { x: 80, y: 230, radius: 150 },
  { x: 640, y: 215, radius: 160 },
  { x: 1150, y: 215, radius: 150 },
  { x: 120, y: 540, radius: 150 },
  { x: 620, y: 385, radius: 160 },
  { x: 1000, y: 560, radius: 150 },
];

// Barrels dotted around the edges, clear of the path (s = scale, r = rotation).
export const BARRELS = [
  { x: 46, y: 52, s: 0.9, r: 0.3 },
  { x: 102, y: 70, s: 0.7, r: 1.2 },
  { x: 380, y: 62, s: 0.8, r: 2.1 },
  { x: 830, y: 58, s: 0.85, r: 0.8 },
  { x: 1222, y: 60, s: 0.95, r: 2.6 },
  { x: 1230, y: 340, s: 0.85, r: 1.7 },
  { x: 40, y: 330, s: 0.85, r: 0.5 },
  { x: 460, y: 585, s: 0.8, r: 2.9 },
  { x: 1230, y: 585, s: 0.9, r: 1.1 },
  { x: 790, y: 590, s: 0.75, r: 0.2 },
];
