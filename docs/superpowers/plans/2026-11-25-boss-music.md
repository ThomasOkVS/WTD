# Boss and Endless music (2026-11-25)

Scope approved up front; hard stop 15:35. Everything is synthesised with WebAudio in `src/fx/sound.js`; there are no audio files.

1. Audio graph: theme buses → `duck` gain → `pauseGain` → `master`. Mute zeros `master`, so it covers everything.
2. Base theme mode: `cellar` or `endless`. Endless runs about 20% faster and adds hats and a high counter-line.
3. Boss theme: A Phrygian, with eighth-note saw bass pulses, toms and a low drone. A 1.5 s crossfade runs in each direction. Furious mode raises the tempo by 25% and adds a high ostinato.
4. `listenGame(scene)` (sound.js) subscribes to Game events:
   - `boss-spawned`, `boss-enraged`, `enemy-killed` (boss split, which ducks the music), `wave-cleared` (sting, plus a duck on the victory choice), `endless-started`, `game-over`
   - `pause`/`resume` (music drops to about 35%)
   - `update` (polls whether the boss or its cans are still alive)
   - `shutdown` (cleans everything up)
5. Hook: one call in `GameScene.create()`. Commit it on its own.
6. Verify in the browser using `musicDebug()` (theme, tempo, bus gains), then mute and pause. `npm test` must pass.
