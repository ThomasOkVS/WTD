# Handover: build WTD (Wine Cellar Siege), subagent-driven

*Written 2026-11-25, ~09:50. Demo at 16:00, deploy/demo prep at 15:45.*

## Where things stand

- **Done:** brainstorming, approved design, implementation plan, project skills + plugins. No game code yet.
- **Next:** execute the plan, task by task, with **superpowers:subagent-driven-development**.

## Read first (in this order)

1. `docs/superpowers/specs/2026-11-25-wine-cellar-siege-design.md` — the approved design (what and why).
2. `docs/superpowers/plans/2026-11-25-wine-cellar-siege.md` — 11 tasks, interfaces, tests, Review Focus.
3. `docs/superpowers/specs/assets/style-a-mood.svg` — the look the user picked (candle-lit painterly 2D).
4. `CLAUDE.md` — project rules (short).

## How to run the session

- Invoke **superpowers:subagent-driven-development** and run the plan's tasks **1 → 11 in order**. Fresh implementer subagent per task, fresh reviewer per task, whole-branch review at the end.
- **Git: work directly on `main`. No feature branches, no worktrees, no pull requests.** The user explicitly allowed committing and pushing straight to `main` to save time. Commit after every task; once a GitHub remote exists, push to `main` after every task too.
- Keep the user's pinned task list in sync with the 11 plan tasks.
- **Time-box.** Suggested timeline from the spec: skeleton by ~10:15, core loop ~11:30, look by lunch (12:45), Nexios features ~14:30, juice/sound ~15:15, deploy ~15:15–15:40. If a task overruns, cut from the spec's **Polish** tier, never from the **Must have** tier. Look and feel beat depth.
- Hand subagents the relevant Phaser skill names (e.g. `scenes`, `tweens`, `particles`, `render-textures`, `audio-and-sound`) so they load the Phaser **4** API, not v3 from memory.
- Use the **Playwright** plugin for every visual verification step in the plan (screenshot + console errors). Use the **frontend-design** skill in Task 8.
- Log anything that worked and then broke in `REGRET.md` (competition deliverable, discussed at the 16:30 retro).

## Still needs the user's OK (ask, don't assume)

- **Downloading asset packs** (Kenney CC0 audio/sprites) — Tasks 5/10. If declined: procedural art (already the plan) and WebAudio-synthesised sounds.
- **Creating the public GitHub repo** (`gh repo create WTD --public --source . --push`) and enabling Pages — Task 11. Pushing to `main` is pre-approved; creating/publishing the public repo is a separate, one-time yes.

## Environment facts

- Repo: `C:\Users\Thoma\dev\WTD`, branch `main`, no remote yet.
- Node 26, npm 12, `gh` installed and logged in to the user's personal GitHub.
- Phaser pinned to **4.2.1** exactly.
- Project skills: 28 official Phaser 4 skills in `.claude/skills/` (copied from `phaserjs/phaser`).
- Project plugins in `.claude/settings.json`: `frontend-design` and `playwright` (from `claude-plugins-official`). They load on session start; the app may ask the user to trust them. If Playwright tools are missing, tell the user rather than skipping visual checks silently.

## Decisions worth not relitigating

- Phaser 4 + Vite (chosen over PixiJS / plain canvas).
- Style A: candle-lit painterly 2D; lighting via dark overlay + additive light sprites + vignette.
- Currency Grapes. Towers: Sommelier, Cork Cannon, Decanter, Thomas (hero, one per map, generic sommelier, name only).
- Nexios references: Thomas, Thomas's Annual Wine Tasting, Taureau Rouge Grand Cru (power-up), Le Monstre Blanc (final boss). Parody names only, no real logos.
- **Removed, never reintroduce:** Nexios sword, victory bell, Pizza Hut.
- Desktop browser, mouse + keyboard, 1280×720 FIT. Demo from the user's laptop over HDMI if Pages fails.

## Kick-off prompt for the next session

> Read `docs/superpowers/HANDOVER.md` and execute the plan it points to using superpowers:subagent-driven-development. Commit and push straight to `main`, no PRs.
