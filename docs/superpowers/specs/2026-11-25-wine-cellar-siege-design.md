# WTD: Wine Cellar Siege — Design

*Date: 2026-11-25 · Status: draft for approval*

## 1. Intent

A browser tower defense game for the **"Defend the Codebase" Day 5 hackathon** (Intent Engineering Bootcamp). Demo at **16:00** on a big screen, audience plays and votes.

**Why / what wins:** the team is going for **looks and feel**. It is a demo, so it must *look and feel impressive* in the first 30 seconds. **Gameplay depth is secondary.** Target prizes: *Most polished* first, *Most fun* and *Best Nexios references* as a bonus.

Working name: **WTD — Wine Tower Defense**, subtitle **"Wine Cellar Siege"**. (Repo/folder: `WTD`.)

## 2. Goals, non-goals, anti-goals

**Goals**
- A candle-lit cellar that looks rich and moody on a projector.
- Juicy feedback on everything: placing, firing, hits, kills, wave start/end, losing.
- Smooth, animated UI (title, HUD, tasting screen, game over). Nothing just "pops".
- Nexios references built into gameplay, not stickers.
- Runs in a desktop browser; nothing to install to play.

**Non-goals**
- Balance depth, many maps, long campaigns, save games, mobile tuning, multiplayer.

**Anti-goals (a failure even if it "works")**
- Rough edges in the demo: placeholder rectangles, janky transitions, silent game, console errors on load.
- A game that won't start on the demo laptop at 16:00.
- Real Red Bull / Monster logos or anything about Thomas that isn't good-natured and big-screen safe.

## 3. Hard constraints (from the competition rules)

- Must run in a browser. No Unity/Godot. → Phaser 4 (chosen).
- Waves of enemies follow a path to a target; players place towers; lose when too many enemies reach the target.
- Currency named after the theme, earned by stopping enemies, spent on towers and upgrades → **Grapes**.
- ≥ 3 Nexios references, pointed out during the demo (§6).
- **Sharing:** public repo `WTD` on the user's personal GitHub, published to GitHub Pages before 15:45 (build step ⇒ a GitHub Actions deploy workflow and Vite **`base: '/WTD/'`**). **Deploy is low priority and done at the end**; if Pages causes trouble, the fallback the rules allow is demoing from the user's laptop over HDMI (`npm run dev` / `vite preview`).
- **Demo setup:** the user plays on their own laptop on the projector → **desktop browser, mouse and keyboard only**. No touch or phone support needed.
- **Time:** design approved ~09:45; build until ~15:30, with lunch at 12:45 (≈ 5 hours of build). One builder: the user with Claude. About 4 other teams compete.
- Keep a **`REGRET.md`** log (things that worked then broke, and why) for the 16:30 retro. Create it on day one and append as we go.
- Assets: **CC0 only**, or credited in `README.md` if a licence requires it.

## 4. Approaches (decided)

| Approach | Trade-off | |
|---|---|---|
| **Phaser 4 + Vite** | Full engine: scenes, input, audio, tweens, particles, built-in 2D lights. Official Claude skills. Needs a build + Actions deploy. | **Chosen by the user** |
| PixiJS v8 + pixi-filters | Best raw renderer (glow/bloom), but we'd write loop, scenes, audio, input ourselves. | Rejected: time |
| Plain canvas, single HTML | Zero build, instant deploy, but every light/particle/transition by hand. | Rejected: slowest to polish |

Pin an exact Phaser version (latest 4.x at build time, e.g. `4.2.1`).

## 5. Theme and gameplay

**Setting:** a top-down stone wine cellar lit by candles. Pests crawl out of cracks along one winding path toward the **Grand Cru**, a prized bottle at the end. Too many arrive → the bottle shatters → game over.

**Currency:** Grapes 🍇. Earned per pest stopped; spent on towers and upgrades.

**Enemies (pests)**
| Pest | Role |
|---|---|
| Fruit flies | Fast, weak, come in swarms |
| Corkscrews | Armoured, spin/drill along the path |
| Rats | Slow, tanky |
| **Le Monstre Blanc** (boss) | Final wave. Huge white wine bottle with glowing green claw marks. Slow, very tanky, screen shakes as it stomps. On death **splits into smaller "Monster cans"** that keep walking. |

**Towers**
| Tower | Role |
|---|---|
| Sommelier | Sniffs out pests: slows them in a radius (support) |
| Cork Cannon | Rapid single-target shots, cork-pop sound |
| Decanter | Splashes wine: area damage |
| **Thomas** (hero) | See §6. Max one per map. |

Each tower has **one upgrade path** (2 levels is enough).

**Waves:** a handful (≈ 6–8), ending with Le Monstre Blanc. One map.

**Taureau Rouge Grand Cru (power-up):** a red-and-blue "energy wine" bottle in the HUD on a cooldown. Click it → **10 s of 2× fire rate** for all towers, with red/blue sparks, a heartbeat sound and a tint over the screen.

## 6. Nexios references (all four built into play)

1. **Thomas, the hero tower.** Thomas is Nexios' talent manager, loves wine and organises a wine tasting every year. In-game he is a **generic sommelier** (apron, wine glass) identified **only by his name** ("Thomas"): no likeness or caricature. One per map. Special ability **"Recruit"**: on a cooldown, he signs a pest to your side and it turns around to fight the others. Upgrades: **Senior Recruiter → Head of Talent** (shorter cooldown / recruits stronger pests).
2. **Thomas's Annual Wine Tasting.** Between waves Thomas presents **three bottles as cards**; the player picks one buff (roguelite-style). Each card has a short Thomas one-liner in a speech bubble.
3. **Taureau Rouge Grand Cru** — the bootcamp's running Red Bull joke, as the power-up above.
4. **Le Monstre Blanc** — the bootcamp's "white Monster" joke, as the final boss.

**Parody rule:** Red Bull and Monster appear only under the parody names above with our own look-alike art (red/blue colours, a bull silhouette, green claw marks). No real logos or brand names in the game or repo.

**Thomas rule:** good-natured, big-screen safe, name only. A quick heads-up to Thomas before the demo is courteous.

**Explicitly removed (do not reintroduce):** the Nexios sword, the Nexios victory bell (including a wave-clear bell sound), the Pizza Hut delivery.

## 7. Look and feel (style A: candle-lit painterly 2D)

Mood reference: [`assets/style-a-mood.svg`](assets/style-a-mood.svg) (rough sketch the user picked).

- **View:** top-down 2D, one screen, no scrolling.
- **Lighting:** dark stone cellar. Candles cast warm amber pools of light that flicker gently; edges fall off into deep shadow and a vignette. Towers carry a small light of their own, so the room gets brighter where you build.
- **Palette:** amber / candle-gold (light), deep burgundy (wine, accents), dark browns and charcoal (stone, shadow). Pests are dark silhouettes with a small coloured glint so they read at a glance. Keep towers, pests and path clearly distinct.
- **Effects:** burgundy wine-splash particles, cork pops, dust motes drifting through the light, screen shake for Monstre Blanc, red/blue flash for Taureau Rouge, glass shatter on game over.
- **Lighting technique:** Phaser 4 has built-in 2D lights, but without normal maps they only light the flat sprite. The mood sketch's look comes from **a dark overlay + additive radial-gradient "light" sprites + vignette**. Use that as the baseline; use Phaser lights only if they add something on top. Builder's call.
- **UI:** cream parchment panels with serif type, framed like a wine label (e.g. Cinzel / Cormorant from Google Fonts). Panels and buttons slide/fade in, with hover states.
- **Screens:** Title (slow candle-lit pan across barrels, game name in elegant serif, Play button) → Game (HUD: Grapes, wave counter, lives/bottle health, tower bar, Taureau Rouge button, next-wave button) → Wine Tasting (between waves) → Game Over (Grand Cru shatters) / Victory.
- **Sound:** cellar ambience (drips), soft background music, cork pop on tower placement, glass clinks, hit/kill sounds, heartbeat for Taureau Rouge. Mute toggle.

## 8. Assets

- **Sprites:** Kenney CC0 packs (e.g. Tower Defense top-down, UI, particles) and CC0 sprites (e.g. a barrel); simple sprites are fine because lighting and particles carry the look.
- **Custom art** (Thomas, Taureau Rouge, Le Monstre Blanc, Grand Cru): no ready-made assets exist. Builder's call between an image generator (if the team has one) and stylised shapes drawn in code; must match the palette.
- **Audio:** Kenney CC0 audio packs; other sources only if CC0 or credited.
- Track every asset and its licence in `README.md`.

## 9. Scope tiers

**Must have (the demo cut)**
- Title → Game → Game Over/Victory flow.
- One map, path, the 3 regular towers + Thomas, 1 upgrade level each.
- Flies, corkscrews, rats; Le Monstre Blanc in the last wave.
- Grapes economy, lives, ≈ 6 waves.
- Wine Tasting between waves; Taureau Rouge power-up.
- Candle lighting, vignette, core particles, cork/hit/kill sounds, music.
- Runs locally from the laptop (`npm run dev`); `REGRET.md` exists. GitHub Pages deploy if time allows (§3).

**Polish (if time)**
- Second upgrade level, Monster cans split, Recruit ability visuals, Thomas speech bubbles, title-screen camera pan, dust motes, screen-shake tuning, more sounds.

**Milestones**
*(Claude's suggested timings; ≈ 5 build hours.)*
1. ~10:00–10:15 Skeleton: Vite + Phaser 4 running locally, `REGRET.md`, `README.md`.
2. ~10:15–11:30 Core loop playable (path, waves, towers, Grapes, lose).
3. ~11:30–12:45 Look: lighting, palette, UI screens.
4. ~13:30–14:30 Nexios features: Thomas, Wine Tasting, Taureau Rouge, Monstre Blanc.
5. ~14:30–15:15 Juice and sound; bug-bash.
6. ~15:15–15:40 GitHub Pages deploy (Actions + `base`); if it fails, demo over HDMI.

**Demo controls** *(Claude's call)*: hidden keys to skip to a wave, spawn Le Monstre Blanc, open the Wine Tasting and add Grapes, so every Nexios reference can be shown in a short live demo.

## 10. Left to the builder

- Exact stats, costs, wave compositions, upgrade numbers.
- Map layout and path shape.
- Code structure, scene breakdown, file layout.
- Which Kenney packs and sounds, specific fonts.
- Custom art method (§8) and lighting technique details (§7).
