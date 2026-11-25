// WebAudio SFX (Kenney CC0 samples, synth fallback) + synthesised cellar music. No Phaser.
// Nothing touches AudioContext at import time.

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
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

const MIN_GAP_MS = { hit: 40, cork: 30, splash: 60, kill: 40, place: 40, click: 30, nope: 80, leak: 80, shatter: 80, power: 200, wave: 400, win: 1000, heartbeat: 200, pour: 150 };

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
      musicBus = ctx.createGain(); musicBus.gain.value = 0.08; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') safeResume();
    loadSamples();
    if (wantMusic) startMusic();
    return true;
  } catch (e) { ctx = null; master = sfxBus = musicBus = noiseBuf = null; samplesRequested = false; return false; }
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

function pluck(f, t) {
  const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f;
  fl.type = 'lowpass'; fl.frequency.setValueAtTime(1800, t); fl.frequency.exponentialRampToValueAtTime(400, t + 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.9, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.75);
}

function pad(freqs, t, dur) {
  for (const f of freqs) {
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      fl.type = 'lowpass'; fl.frequency.value = 600;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
      o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.35);
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
}

function scheduler() {
  if (!musicOn || !ctx) return;
  const horizon = ctx.currentTime + 1.2;
  while (nextBeat < horizon) {
    scheduleBeat(nextBeat, beatIndex);
    nextBeat += BEAT; beatIndex++;
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
    musicBus.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.5);
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
      musicBus = ctx.createGain(); musicBus.gain.value = 0.08; musicBus.connect(master);
    }
  } catch (e) { /* ignore */ }
}
