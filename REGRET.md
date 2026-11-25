# REGRET

Things that worked and then broke.

Format: `## HH:MM — what broke — why — fix`

## 10:09 — Kenney CC0 audio download (approved by the user) failed — kenney.nl returns 403 to automated clients and has no direct zip URL — fell back to WebAudio-synthesised SFX and music in `src/fx/sound.js` (no audio files at all)
## 10:17 — the path trench darkened the whole S-bend interior — several `fillRect` calls in one Phaser 4 Graphics filled the area between them — each trench band is now its own Rectangle (`src/fx/cellar.js`)
## 10:32 — Title camera pan stopped after one leg — the next leg was started inside the pan's own update callback, and Phaser 4's effectComplete() wiped it right after — chain legs on the PAN_COMPLETE event instead
## 10:37 — HUD went deaf after Game shut down — Game's cleanup did `events.off(name)` on the shared emitter, wiping the HUD's listeners too — every scene now removes only its own `(name, fn, ctx)` pairs
## 10:37 — "Play again" worked once, then the 2nd End screen's button did nothing — the scene instance is reused across runs and a "leaving" flag set in the 1st run was never reset — reset it in `init()`
## 14:36 — the game got very laggy after HD rendering — the 1.5x (1920x1080) canvas cost ~1.7x the frame time on an iGPU laptop (43 ms vs 25 ms in wave 5) on top of a per-frame darkness pass — default HD back to 1 (?hd=1.5 still works), darkness redrawn every 2nd frame, pest halos capped at 12, high-performance GPU hint, no MSAA: wave 5 now ~10 ms/frame
