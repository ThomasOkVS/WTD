# Wine Cellar Siege

Candle-lit browser tower defense (Phaser 4 + Vite). Defend Thomas's Grand Cru from seven waves of cellar pests.

**Play:** https://thomasokvs.github.io/WTD/

## How to run

```
npm install
npm run dev       # http://localhost:5173/WTD/
npm test          # Vitest, game rules in src/logic/
npm run build     # production build in dist/
npm run preview   # serve the build: http://localhost:4173/WTD/
```

## Controls

- Click a tower card, then a free build spot. Click a placed tower to upgrade it.
- **Next wave** starts the next wave. **Taureau Rouge** (bottom right) doubles fire rate for 10 s.
- `Esc` deselects / closes the upgrade panel. `M` (or the speaker icon) mutes.

## Demo keys

Presenter shortcuts. They work in the dev and production builds and have no on-screen UI.

| Key | Effect |
| --- | --- |
| `1`–`7` | Clear the field and start that wave right away |
| `B` | Spawn Le Monstre Blanc |
| `G` | +500 Grapes |
| `W` | Open Thomas's Annual Wine Tasting |
| `R` | Recharge Taureau Rouge (when it is not running) |
| `M` | Mute / unmute |

Except `M`, the keys are ignored while the Wine Tasting is open (the cellar is paused) and after game over. Digits use the physical number row (no Shift needed on AZERTY).

Demo script (under 2 minutes): Play → `G` `G` `G` → place towers (incl. Thomas) and upgrade a few → `1` → wave cleared, Wine Tasting → `W` for a second tasting → `7` (the last wave brings Le Monstre Blanc on its own) → fire Taureau Rouge as the boss enters → Le Monstre Blanc splits into cans → End screen. Use `B` only to show the boss early on an empty field, never on top of wave 7.

## Nexios references

Parody names only, no real brands or likenesses:

- **Thomas**: a generic sommelier tower (name only) who recruits pests to fight for the cellar.
- **Thomas's Annual Wine Tasting**: pick one wine buff between waves.
- **Taureau Rouge Grand Cru**: the power-up (red/blue cellar lights, heartbeat, 2× fire rate).
- **Le Monstre Blanc**: the final boss; it splits into cans when it dies.

## Assets & licences

- All art is procedural (drawn in code at boot, `src/art/textures.js`).
- All sound and music is synthesised in code with WebAudio (`src/fx/sound.js`), no audio files.
- Fonts: Cinzel and Cormorant Garamond (Google Fonts, SIL Open Font License).
- No third-party asset packs.
