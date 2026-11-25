// HD rendering: the canvas is HD times 1280x720 and every scene camera zooms
// HD times around the old 1280x720 world, so no game coordinate changes.
// Default 1.5 = a native 1920x1080 canvas (projector resolution): HD 2 halved
// the frame rate in testing. Override per page load with ?hd=1 (the old 1x
// canvas, the revert switch) or ?hd=2.
const DEFAULT_HD = 1.5;

function fromUrl() {
  try {
    const v = Number(new URLSearchParams(globalThis.location?.search).get('hd'));
    return v >= 1 && v <= 2 ? v : null;
  } catch {
    return null;
  }
}

export const HD = fromUrl() ?? DEFAULT_HD;

export function hdCamera(scene, zoom = 1, cx = 640, cy = 360) {
  return scene.cameras.main.setZoom(HD * zoom).centerOn(cx, cy);
}
