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

- Click a tower card, then click anywhere beside the path to build (the ghost turns red where it can't go). Right-click or `Esc` cancels. Click a placed tower to upgrade it.
- **Next wave** starts the next wave. **Taureau Rouge** (bottom right) doubles fire rate for 10 s.
- `Esc` deselects / closes the upgrade panel. `M` (or the speaker icon) mutes.

## Towers

Cheapest first; hover a card in the game for the same summary with live numbers.

- **Cork Cannon** (50): rapid corks at one pest at a time.
- **Sommelier** (70): slows pests by half.
- **Decanter** (90): bursts wine all around itself and hits every pest in a small radius. Build it next to the path.
- **Thomas** (120, one per map): every 6 s he recruits a pest, which walks back and smashes every pest it meets. Towers within his gold ring fire 15% faster.

**Pests fight back.** Flies sting, corkscrews spit corks, rats stop and chew, cans burst on the nearest tower and Le Monstre Blanc slams everything around it. Towers have HP (upgrades raise it); a destroyed tower is gone for good, upgrades and all. Click a tower to repair it for Grapes.

## Demo keys

Presenter shortcuts. They work in the dev and production builds and have no on-screen UI.

| Key | Effect |
| --- | --- |
| `1`–`7` | Clear the field and start that wave right away |
| `B` | Spawn Le Monstre Blanc |
| `G` | +500 Grapes |
| `W` | Open Thomas's Annual Wine Tasting |
| `R` | Recharge Taureau Rouge (when it is not running) |
| `D` | Every tower drops to 25% HP ("The pests bite back!"): puts Repair and destruction on cue |
| `M` | Mute / unmute |
| `P` / `Esc` | Pause: Resume, Restart, Back to title (`Esc` first cancels a placement or closes the upgrade panel) |
| `F` | 2× speed (toggle; every new run starts at 1×) |
| `L` | Projector mode: brighter cellar for big screens (remembered) |

Except `M` and `L`, the keys are ignored while the Wine Tasting is open (the cellar is paused) and after game over. Digits use the physical number row (no Shift needed on AZERTY).

Demo script (under 2 minutes): Play → `G` `G` `G` → place towers (incl. Thomas) and upgrade a few → `1` → wave cleared, Wine Tasting → pick a wine → `D` → click a tower → Repair (the pests fight back) → `W` for a second tasting → `7` (the last wave brings Le Monstre Blanc on its own) → fire Taureau Rouge as the boss enters → Le Monstre Blanc splits into cans → "The cellar holds!" → Claim victory → End screen (or Keep pouring to show Endless). Use `B` only to show the boss early on an empty field, never on top of wave 7.

## Nexios references

Parody names only, no real brands or likenesses:

- **Thomas**: a generic sommelier tower (name only) who recruits pests to fight for the cellar and lifts the morale of nearby towers.
- **Thomas's Annual Wine Tasting**: pick one wine buff between waves.
- **Taureau Rouge Grand Cru**: the power-up (red/blue cellar lights, heartbeat, 2× fire rate).
- **Le Monstre Blanc**: the final boss; it splits into cans when it dies.

## Assets & licences

- All art is procedural (drawn in code at boot, `src/art/textures.js`).
- SFX: Kenney Impact Sounds, Interface Sounds and RPG Audio (CC0, [kenney.nl](https://kenney.nl)), see [public/audio/CREDITS.md](public/audio/CREDITS.md). Music and fallback sounds are synthesised in code with WebAudio (`src/fx/sound.js`).
- Fonts: Cinzel and Cormorant Garamond (Google Fonts, SIL Open Font License).
- No third-party asset packs.
