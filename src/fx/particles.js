import Phaser from 'phaser';

// Shared particle juice. One emitter per effect per scene (never one per
// burst), created lazily and dropped on the scene's shutdown: scene instances
// are reused across restarts, so a cache that outlived shutdown would hold
// destroyed emitters. maxAliveParticles caps the total at ~400.
//
// World effects sit just above the sprites but below the darkness (2500), so
// the candle lighting applies to them. Dust floats above the darkness at a
// very low alpha, like motes caught in the light.
const WORLD_DEPTH = 2100;
const DUST_DEPTH = 2520;

const caches = new WeakMap();

function fx(scene) {
  let c = caches.get(scene);
  if (c) return c;
  c = {};
  caches.set(scene, c);
  scene.events.once('shutdown', () => caches.delete(scene));
  return c;
}

function emitter(scene, name, key, config) {
  const c = fx(scene);
  if (!c[name]) c[name] = scene.add.particles(0, 0, key, { emitting: false, ...config }).setDepth(WORLD_DEPTH);
  return c[name];
}

// Burgundy wine burst: decanter impacts.
export function splash(scene, x, y) {
  emitter(scene, 'splash', 'drop', {
    maxAliveParticles: 150,
    speed: { min: 60, max: 190 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.9, end: 0.25 },
    alpha: { start: 1, end: 0 },
    lifespan: { min: 260, max: 520 },
    gravityY: 380,
    tint: [0x8a1c2b, 0xd01a3a, 0x5e0f1c],
  }).explode(12, x, y);
}

// Little puff + chips when a cork cannon fires.
export function corkPop(scene, x, y) {
  emitter(scene, 'cork', 'spark', {
    maxAliveParticles: 100,
    speed: { min: 30, max: 110 },
    angle: { min: 230, max: 310 },
    scale: { start: 0.55, end: 0 },
    alpha: { start: 0.9, end: 0 },
    lifespan: { min: 180, max: 340 },
    tint: [0xe8c07a, 0xc89a5a, 0xfff3c4],
  }).explode(5, x, y);
}

// Glass shards (Le Monstre Blanc split, anything breaking in the cellar).
export function shatter(scene, x, y) {
  emitter(scene, 'shatter', 'spark', {
    maxAliveParticles: 110,
    speed: { min: 120, max: 360 },
    angle: { min: 0, max: 360 },
    rotate: { min: 0, max: 360 },
    scale: { start: 0.8, end: 0.15 },
    alpha: { start: 1, end: 0 },
    lifespan: { min: 450, max: 850 },
    gravityY: 480,
    tint: [0xfff3c4, 0xe9dcc0, 0xffffff],
  }).explode(30, x, y);
}

// Slow dust motes drifting through the candle light. Few, soft, cheap.
export function startDust(scene) {
  const c = fx(scene);
  if (c.dust) return c.dust;
  c.dust = scene.add.particles(0, 0, 'light-soft', {
    maxAliveParticles: 40,
    frequency: 220,
    lifespan: { min: 7000, max: 11000 },
    speedX: { min: -8, max: 10 },
    speedY: { min: -10, max: 3 },
    scale: { min: 0.012, max: 0.03 },
    alpha: { values: [0, 0.22, 0.18, 0] },
    tint: [0xffe2b0, 0xe8c07a],
    blendMode: 'ADD',
    emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 60, 1280, 540) },
    advance: 6000, // the air is already full of dust when the scene opens
  }).setDepth(DUST_DEPTH);
  return c.dust;
}
