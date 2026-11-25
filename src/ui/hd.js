// HD rendering: the canvas is HD times 1280x720 and every scene camera zooms
// HD times around the old 1280x720 world, so no game coordinate changes.
// HD = 1 restores the old 1x canvas (the revert switch).
export const HD = 2;

export function hdCamera(scene, zoom = 1, cx = 640, cy = 360) {
  return scene.cameras.main.setZoom(HD * zoom).centerOn(cx, cy);
}
