// Projector mode (L): a brighter cellar for big screens. Phaser-free display
// state, remembered in localStorage. Lighting and the HUD subscribe to it.
const KEY = 'wcs.projector';
let state = null; // read lazily: no storage (or blocked storage) means off
const subs = new Set();

export function isProjector() {
  if (state === null) {
    try {
      state = globalThis.localStorage?.getItem(KEY) === '1';
    } catch {
      state = false;
    }
  }
  return state;
}

export function toggleProjector() {
  state = !isProjector();
  try {
    globalThis.localStorage?.setItem(KEY, state ? '1' : '0');
  } catch {
    // private window or blocked storage: the mode still works for this page
  }
  for (const fn of [...subs]) fn(state);
  return state;
}

export function onProjectorChange(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
