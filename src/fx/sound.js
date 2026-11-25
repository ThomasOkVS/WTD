// WebAudio SFX (Kenney CC0 samples, synth fallback) + synthesised cellar music. No Phaser.
// Nothing touches AudioContext at import time.
import { WAVES } from '../config/waves.js';

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;  // cellar / endless theme
let bossBus = null;   // Le Monstre Blanc theme
let duckGain = null;  // short dips (boss split, victory choice)
let pauseGain = null; // quieter while the Game scene is paused
let analyser = null;
const MUSIC_VOL = 0.08;
const BOSS_VOL = 0.075;
const XFADE = 1.5;
let noiseBuf = null;
let muted = false;
let musicOn = false;
let wantMusic = false;
let musicTimer = null;
let nextBeat = 0;
let beatIndex = 0;
let nextDrip = 0;
const lastPlayed = {};
const buffers = {}; // key -> decoded AudioBuffer[]; empty/missing -> synth fallback

// key -> number of sample variants in public/audio/<key>-<n>.ogg
const SAMPLES = { place: 2, cork: 3, splash: 2, hit: 3, kill: 3, leak: 1, nope: 1, click: 2, shatter: 2, wave: 1 };
const VOLUME = { place: 0.9, cork: 0.7, splash: 0.8, hit: 0.5, kill: 0.9, leak: 1, nope: 0.6, click: 0.5, shatter: 0.9, wave: 1 };
const JITTER = { hit: 1, cork: 1, kill: 1, splash: 1, place: 1, click: 1 }; // +-5% pitch for frequent sounds
let samplesRequested = false;

function loadSamples() {
  if (samplesRequested || typeof fetch === 'undefined') return;
  samplesRequested = true;
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  const c = ctx;
  for (const key of Object.keys(SAMPLES)) {
    for (let n = 1; n <= SAMPLES[key]; n++) {
      (async () => {
        try {
          const res = await fetch(base + 'audio/' + key + '-' + n + '.ogg');
          if (!res.ok) return;
          const buf = await c.decodeAudioData(await res.arrayBuffer());
          if (c === ctx) (buffers[key] || (buffers[key] = [])).push(buf);
        } catch (e) { /* fall back to synth */ }
      })();
    }
  }
}

export function sampleStats() {
  let loaded = 0, expected = 0;
  for (const k of Object.keys(SAMPLES)) { expected += SAMPLES[k]; loaded += (buffers[k] || []).length; }
  return { loaded, expected };
}

function playSample(key, t, opts) {
  const list = buffers[key];
  if (!list || !list.length || !sfxBus) return false;
  const s = ctx.createBufferSource();
  s.buffer = list[Math.floor(Math.random() * list.length)];
  s.playbackRate.value = (opts.pitch || 1) * (JITTER[key] ? rnd(0.95, 1.05) : 1);
  const g = ctx.createGain();
  g.gain.value = VOLUME[key] || 1;
  s.connect(g); g.connect(sfxBus);
  s.start(t);
  return true;
}

const MIN_GAP_MS = { hit: 40, cork: 30, splash: 60, kill: 40, place: 40, click: 30, nope: 80, leak: 80, shatter: 80, power: 200, wave: 400, cleared: 1000, win: 1000, heartbeat: 200, pour: 150 };

export function initSound() {
  try {
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
      pauseGain = ctx.createGain(); pauseGain.connect(master);
      duckGain = ctx.createGain(); duckGain.connect(pauseGain);
      analyser = ctx.createAnalyser(); analyser.fftSize = 2048; pauseGain.connect(analyser);
      musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_VOL; musicBus.connect(duckGain);
      bossBus = ctx.createGain(); bossBus.gain.value = 0; bossBus.connect(duckGain);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') safeResume();
    loadSamples();
    if (wantMusic) startMusic();
    return true;
  } catch (e) { ctx = null; master = sfxBus = musicBus = bossBus = duckGain = pauseGain = analyser = noiseBuf = null; samplesRequested = false; return false; }
}

function safeResume() {
  try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
}

export function setMuted(m) {
  muted = !!m;
  try { if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02); } catch (e) { /* ignore */ }
}
export function isMuted() { return muted; }
export function isSoundReady() { return ctx !== null; }
export function toggleMuted() { setMuted(!muted); return muted; }

// ---- primitives ----
function tone(type, f0, f1, t, dur, vol, dest = sfxBus) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.005, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(t, dur, vol, { type = 'lowpass', f0 = 1000, f1 = null, q = 0.7, dest = sfxBus, attack = 0.003 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const rnd = (a, b) => a + Math.random() * (b - a);

const SFX = {
  place(t, o) { const p = o.pitch || 1; tone('triangle', 180 * p, 90 * p, t, 0.09, 0.7); noise(t, 0.05, 0.3, { f0: 900 * p, f1: 300 * p }); tone('sine', 110 * p, 70 * p, t + 0.05, 0.1, 0.4); },
  cork(t, o) { const p = o.pitch || 1; noise(t, 0.07, 0.35, { type: 'bandpass', f0: 1800 * p, q: 1.2 }); tone('sine', 700 * p, 160 * p, t, 0.09, 0.6); },
  splash(t) { noise(t, 0.35, 0.45, { type: 'bandpass', f0: 400, f1: 2400, q: 0.9, attack: 0.08 }); },
  hit(t) { tone('triangle', 520 * rnd(0.9, 1.1), 380, t, 0.03, 0.22); },
  kill(t) { tone('sine', 260, 70, t, 0.16, 0.6); noise(t, 0.08, 0.25, { f0: 700, f1: 200 }); },
  leak(t) { tone('sine', 90, 40, t, 0.35, 0.9); noise(t, 0.12, 0.3, { f0: 300, f1: 100 }); },
  nope(t) { tone('square', 330, 250, t, 0.07, 0.18); tone('square', 250, 170, t + 0.1, 0.09, 0.18); },
  heartbeat(t) { tone('sine', 62, 45, t, 0.14, 0.9); tone('sine', 55, 40, t + 0.2, 0.16, 0.7); },
  shatter(t) {
    noise(t, 0.2, 0.4, { type: 'highpass', f0: 3500, q: 0.5 });
    for (let i = 0; i < 6; i++) tone('triangle', rnd(2800, 7000), null, t + rnd(0, 0.18), rnd(0.02, 0.055), 0.12);
  },
  wave(t) { // low drum + short brass-ish swell, no bell
    tone('sine', 110, 48, t, 0.3, 0.9);
    noise(t, 0.18, 0.25, { f0: 500, f1: 120 });
    [110, 165, 220].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f * (1 + i * 0.002);
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(300, t + 0.1); fl.frequency.linearRampToValueAtTime(1400, t + 0.55);
      g.gain.setValueAtTime(0.0001, t + 0.1);
      g.gain.linearRampToValueAtTime(0.16, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(fl); fl.connect(g); g.connect(sfxBus); o.start(t + 0.1); o.stop(t + 0.95);
    });
  },
  win(t) { // warm major swell (C-E-G-C), soft saw/triangle through a lowpass; no bell
    [130.81, 196.0, 261.63, 329.63, 392.0, 523.25].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = i * 3 - 7;
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(400, t); fl.frequency.linearRampToValueAtTime(1800, t + 0.7);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(fl); fl.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1.85);
    });
    noise(t, 0.4, 0.15, { f0: 300, f1: 1500, attack: 0.2 });
  },
  click(t) { tone('square', 900, 700, t, 0.025, 0.12); },
  // wave cleared: a short, warm rising major arpeggio (G-B-D-G), soft plucks
  cleared(t) {
    [392.0, 493.88, 587.33, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      const s = t + i * 0.085;
      o.type = 'triangle'; o.frequency.value = f;
      fl.type = 'lowpass'; fl.frequency.value = 2600;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(i === 3 ? 0.32 : 0.24, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + (i === 3 ? 0.9 : 0.4));
      o.connect(fl); fl.connect(g); g.connect(sfxBus); o.start(s); o.stop(s + 0.95);
    });
  },
  // Sommelier: a soft wine "pour" — a short liquid swish plus two little glugs.
  pour(t) {
    noise(t, 0.22, 0.22, { type: 'bandpass', f0: 700, f1: 1600, q: 2.5, attack: 0.03 });
    tone('sine', 300 * rnd(0.95, 1.05), 520, t + 0.04, 0.06, 0.18);
    tone('sine', 340 * rnd(0.95, 1.05), 600, t + 0.12, 0.05, 0.14);
  },
  power(t) {
    noise(t, 0.5, 0.35, { type: 'bandpass', f0: 300, f1: 3500, q: 1, attack: 0.15 });
    tone('sawtooth', 120, 480, t, 0.45, 0.2);
    tone('square', 480, 960, t + 0.3, 0.12, 0.15);
  },
};

export function play(key, opts = {}) {
  try {
    if (!ctx || muted || !SFX[key]) return;
    const now = performance.now();
    if (now - (lastPlayed[key] || -1e9) < (MIN_GAP_MS[key] || 0)) return;
    lastPlayed[key] = now;
    if (ctx.state === 'suspended') safeResume();
    const t = ctx.currentTime + 0.005;
    if (!playSample(key, t, opts)) SFX[key](t, opts);
  } catch (e) { /* never throw */ }
}

// ---- music: minor pad + plucked arpeggio, ~70 bpm, lookahead scheduler ----
const BEAT = 60 / 70;
const CHORDS = [ // per bar (4 beats): bass + arpeggio notes (Hz)
  { bass: 55.0, arp: [220.0, 261.63, 329.63, 261.63] },   // Am
  { bass: 43.65, arp: [174.61, 220.0, 261.63, 220.0] },   // F
  { bass: 65.41, arp: [196.0, 261.63, 329.63, 261.63] },  // C
  { bass: 82.41, arp: [164.81, 207.65, 246.94, 207.65] }, // E, dark tension
];

function pluck(f, t, dest = musicBus, vol = 0.9) {
  const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f;
  fl.type = 'lowpass'; fl.frequency.setValueAtTime(1800, t); fl.frequency.exponentialRampToValueAtTime(400, t + 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.75);
}

function pad(freqs, t, dur, dest = musicBus, cutoff = 600) {
  for (const f of freqs) {
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      fl.type = 'lowpass'; fl.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
      o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.35);
    }
  }
}

function scheduleBeat(t, idx) {
  const c = CHORDS[Math.floor(idx / 4) % CHORDS.length];
  const beat = idx % 4;
  if (beat === 0) {
    tone('sine', c.bass, null, t, BEAT * 3.6, 1.2, musicBus);
    pad([c.arp[0], c.arp[1], c.arp[2]], t, BEAT * 4);
  }
  if (Math.random() < 0.85) pluck(c.arp[beat] * (beat === 3 && Math.random() < 0.3 ? 2 : 1), t);
  if (endless) { // extra layer: soft off-beat shaker + a high counter-line
    const half = cellarBeat() / 2;
    noise(t + half, 0.05, 0.35, { type: 'highpass', f0: 6000, dest: musicBus });
    if (beat === 1 || beat === 3) pluck(c.arp[(beat + 1) % 4] * 2, t + half, musicBus, 0.55);
  }
}

// ---- boss theme: A Phrygian, pulsing saw bass in eighths, toms, low drone ----
const BOSS_BEAT = 60 / 96;
const BOSS_BARS = [ // bass root per bar + drone (Hz)
  { bass: 55.0, drone: [110.0, 164.81] },  // A
  { bass: 58.27, drone: [116.54, 174.61] }, // Bb (the Phrygian bite)
  { bass: 43.65, drone: [87.31, 130.81] },  // F
  { bass: 41.2, drone: [82.41, 123.47] },   // E
];
const OSTINATO = [880.0, 1046.5, 932.33, 880.0, 1318.5, 1046.5, 932.33, 830.61]; // A C Bb A E C Bb G#

let endless = false;
let bossOn = false;      // boss theme wanted
let bossPlaying = false; // boss scheduler running (stays on through a fade-out)
let bossStopAt = 0;
let cellarPlaying = true;
let cellarStopAt = 0;
let furious = false;
let nextBossStep = 0;
let bossStep = 0;

const cellarBeat = () => (endless ? BEAT / 1.2 : BEAT);
const bossBeat = () => (furious ? BOSS_BEAT / 1.25 : BOSS_BEAT);

function bassPulse(f, t, dur, accent) {
  const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.value = f;
  fl.type = 'lowpass'; fl.Q.value = 4;
  fl.frequency.setValueAtTime(accent ? 700 : 420, t); fl.frequency.exponentialRampToValueAtTime(120, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(accent ? 1.1 : 0.75, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(bossBus); o.start(t); o.stop(t + dur + 0.02);
}

function tom(t, f, vol) {
  tone('sine', f, f * 0.42, t, 0.32, vol, bossBus);
  noise(t, 0.06, vol * 0.35, { f0: 900, f1: 200, dest: bossBus });
}

function scheduleBossStep(t, idx) {
  const step = idx % 8;
  const barNo = Math.floor(idx / 8) % BOSS_BARS.length;
  const bar = BOSS_BARS[barNo];
  const e = bossBeat() / 2;
  if (step === 0) pad(bar.drone, t, bossBeat() * 4, bossBus, 380);
  bassPulse(bar.bass * (step === 7 ? 2 : 1), t, e * 0.9, step === 0 || step === 3 || step === 6);
  if (step === 0 || step === 4) tom(t, 120, 1.4);
  if (barNo === 3 && step >= 5) tom(t, 170 - (step - 5) * 25, 0.9); // fill into the loop
  else if (step === 6 && Math.random() < 0.5) tom(t, 150, 0.7);
  if (furious) { // tense high ostinato in sixteenths
    const n = OSTINATO[step] * (barNo === 1 ? 932.33 / 880 : 1);
    for (const off of [0, e / 2]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'square'; o.frequency.value = off ? n : n / 2;
      fl.type = 'lowpass'; fl.frequency.value = 2400;
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.linearRampToValueAtTime(off ? 0.12 : 0.18, t + off + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + e * 0.45);
      o.connect(fl); fl.connect(g); g.connect(bossBus); o.start(t + off); o.stop(t + off + e * 0.5);
    }
  }
}

function fadeTo(bus, target, secs = XFADE) {
  const now = ctx.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(bus.gain.value, now);
  bus.gain.linearRampToValueAtTime(target, now + secs);
}

function scheduler() {
  if (!musicOn || !ctx) return;
  const now = ctx.currentTime;
  const horizon = now + 1.2;
  if (cellarPlaying && bossOn && now > cellarStopAt) cellarPlaying = false;
  if (bossPlaying && !bossOn && now > bossStopAt) bossPlaying = false;
  if (cellarPlaying) {
    while (nextBeat < horizon) {
      scheduleBeat(nextBeat, beatIndex);
      nextBeat += cellarBeat(); beatIndex++;
    }
  } else nextBeat = Math.max(nextBeat, now);
  if (bossPlaying) {
    // tighter lookahead so the furious tempo kicks in quickly
    const h = now + 0.4;
    while (nextBossStep < h) {
      scheduleBossStep(nextBossStep, bossStep);
      nextBossStep += bossBeat() / 2; bossStep++;
    }
  }
  while (nextDrip < horizon) { // quiet cellar water drip
    const f = rnd(1100, 1700);
    tone('sine', f, f * 0.45, nextDrip, 0.07, 0.5, musicBus);
    nextDrip += rnd(2.5, 7);
  }
}

export function startMusic() {
  try {
    wantMusic = true;
    if (!ctx || musicOn) return;
    musicOn = true;
    beatIndex = 0;
    nextBeat = ctx.currentTime + 0.1;
    nextDrip = ctx.currentTime + rnd(1, 3);
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(bossOn ? 0 : MUSIC_VOL, ctx.currentTime + 1.5);
    cellarPlaying = !bossOn;
    if (bossOn) { bossPlaying = true; bossStep = 0; nextBossStep = ctx.currentTime + 0.1; fadeTo(bossBus, BOSS_VOL); }
    scheduler();
    musicTimer = setInterval(scheduler, 100);
  } catch (e) { /* ignore */ }
}

export function stopMusic() {
  try {
    musicOn = false;
    wantMusic = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (ctx && musicBus) {
      // fade the old bus out, swap in a fresh one so already-scheduled notes die with it
      const old = musicBus;
      old.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      setTimeout(() => { try { old.disconnect(); } catch (e) { /* ignore */ } }, 600);
      musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_VOL; musicBus.connect(duckGain);
      const oldBoss = bossBus;
      oldBoss.gain.cancelScheduledValues(ctx.currentTime);
      oldBoss.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      setTimeout(() => { try { oldBoss.disconnect(); } catch (e) { /* ignore */ } }, 600);
      bossBus = ctx.createGain(); bossBus.gain.value = 0; bossBus.connect(duckGain);
      bossPlaying = false;
    }
  } catch (e) { /* ignore */ }
}

// ---- music director: boss / endless themes, ducks, pause dimming ----

// Crossfade to (on) or away from (off) the boss theme. Off returns to the
// base theme: the cellar, or its Endless variant.
export function bossMusic(on) {
  try {
    on = !!on;
    if (on === bossOn) return;
    bossOn = on;
    if (!on) furious = false;
    if (!ctx || !musicOn) return;
    const now = ctx.currentTime;
    if (on) {
      if (!bossPlaying) { bossPlaying = true; bossStep = 0; nextBossStep = now + 0.08; }
      fadeTo(bossBus, BOSS_VOL);
      fadeTo(musicBus, 0);
      cellarStopAt = now + XFADE + 0.1;
    } else {
      if (!cellarPlaying) { cellarPlaying = true; nextBeat = Math.max(nextBeat, now + 0.05); beatIndex = 0; }
      fadeTo(musicBus, MUSIC_VOL);
      fadeTo(bossBus, 0);
      bossStopAt = now + XFADE + 0.1;
    }
  } catch (e) { /* ignore */ }
}

// The boss turns furious: +25% tempo and a tense high ostinato.
export function bossFurious() {
  if (bossOn) furious = true;
}

// Endless cellar: the base theme speeds up and gains a layer.
export function endlessMusic(on) { endless = !!on; }

// Dip the music ~40% for about a second.
export function duckMusic(depth = 0.6, secs = 1) {
  try {
    if (!ctx || !duckGain) return;
    const now = ctx.currentTime, g = duckGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(depth, now + 0.08);
    g.setValueAtTime(depth, now + secs);
    g.linearRampToValueAtTime(1, now + secs + 0.5);
  } catch (e) { /* ignore */ }
}

export function pauseMusic(paused) {
  try { if (ctx && pauseGain) pauseGain.gain.setTargetAtTime(paused ? 0.35 : 1, ctx.currentTime, 0.12); } catch (e) { /* ignore */ }
}

// For dev checks: what is playing, and how loud (RMS of the music output).
export function musicDebug() {
  let rms = 0;
  try {
    if (analyser) {
      const d = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(d);
      for (const v of d) rms += v * v;
      rms = Math.sqrt(rms / d.length);
    }
  } catch (e) { /* ignore */ }
  return {
    musicOn, bossOn, bossPlaying, cellarPlaying, furious, endless,
    cellarBeat: cellarBeat(), bossBeat: bossBeat(),
    cellarGain: musicBus?.gain.value, bossGain: bossBus?.gain.value,
    duck: duckGain?.gain.value, pause: pauseGain?.gain.value, muted, rms,
  };
}

// Wire the music to one Game scene run. Call once from GameScene.create();
// removes only its own handlers on shutdown.
export function listenGame(scene) {
  const ev = scene.events;
  let pollAt = 0;
  const fightAlive = () => (scene.enemies || []).some((e) => e.alive && !e.recruited && (e.boss || e.type === 'can'));
  const h = {
    'boss-spawned': () => bossMusic(true),
    'boss-enraged': () => bossFurious(),
    'enemy-killed': (e) => { if (e && e.boss) duckMusic(); }, // Le Monstre Blanc splits
    'wave-cleared': (i) => {
      bossMusic(false);
      play('cleared');
      if (i === WAVES.length - 1 && !scene.endless) duckMusic(0.6, 1.2); // the victory choice
    },
    'endless-started': () => endlessMusic(true),
    'game-over': () => { bossMusic(false); pauseMusic(false); },
    pause: () => pauseMusic(true),
    resume: () => pauseMusic(false),
    update: () => {
      if (!bossOn) return;
      const now = performance.now();
      if (now < pollAt) return;
      pollAt = now + 250;
      if (!fightAlive()) bossMusic(false);
    },
  };
  for (const k of Object.keys(h)) ev.on(k, h[k]);
  endlessMusic(!!scene.endless);
  ev.once('shutdown', () => {
    for (const k of Object.keys(h)) ev.off(k, h[k]);
    bossMusic(false);
    endlessMusic(false);
    pauseMusic(false);
  });
}
