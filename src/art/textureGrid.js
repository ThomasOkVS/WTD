// Debug overlay: every generated texture in a labelled grid. Toggle with T.
import { TEXTURE_KEYS } from './textures.js';
import { PALETTE } from '../config/palette.js';

const COLS = 6, CELL_W = 200, CELL_H = 168, MAX = 120;

export function toggleTextureGrid(scene) {
  if (scene.__texGrid) {
    const grid = scene.__texGrid;
    scene.__texGrid = null;
    scene.tweens.add({ targets: grid, alpha: 0, duration: 200, onComplete: () => grid.destroy() });
    return;
  }
  const grid = scene.add.container(0, 0).setDepth(10000).setAlpha(0);
  grid.add(scene.add.rectangle(640, 360, 1280, 720, 0x120a0d, 1));
  const x0 = (1280 - COLS * CELL_W) / 2;
  TEXTURE_KEYS.forEach((key, i) => {
    const cx = x0 + (i % COLS) * CELL_W + CELL_W / 2;
    const cy = 8 + Math.floor(i / COLS) * CELL_H + 70;
    // mid-tone backdrop so dark silhouettes and the vignette stay visible
    grid.add(scene.add.rectangle(cx, cy, CELL_W - 12, MAX + 16, 0x6a5a4e));
    const img = scene.add.image(cx, cy, key);
    img.setScale(Math.min(MAX / img.width, MAX / img.height, 3));
    grid.add(img);
    grid.add(
      scene.add
        .text(cx, cy + MAX / 2 + 16, `${key} ${img.width}x${img.height}`, {
          fontFamily: 'Cormorant Garamond, serif',
          fontStyle: '700',
          fontSize: '16px',
          color: PALETTE.parchment,
        })
        .setOrigin(0.5),
    );
  });
  scene.__texGrid = grid;
  scene.tweens.add({ targets: grid, alpha: 1, duration: 200 });
}

export function bindTextureGridKey(scene) {
  scene.input.keyboard.on('keydown-T', () => toggleTextureGrid(scene));
}
