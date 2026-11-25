# WTD: Wine Cellar Siege

Browser tower defense game (Phaser 4.2.1 + Vite) for a one-day hackathon. Demo 16:00 on 2026-11-25.

- Design: `docs/superpowers/specs/2026-11-25-wine-cellar-siege-design.md`
- Plan: `docs/superpowers/plans/2026-11-25-wine-cellar-siege.md`
- Handover / current status: `docs/superpowers/HANDOVER.md`

## Rules

- **Git:** commit and push directly to `main`. No feature branches, no worktrees, no pull requests (user's explicit choice, to save time).
- Look and feel first; gameplay depth second. Cut Polish-tier scope before Must-have scope.
- Game rules in `src/logic/` stay Phaser-free and are tested with Vitest (`npm test`). Visual work is verified with Playwright screenshots.
- Use the project's Phaser 4 skills (`.claude/skills/`); don't write Phaser 3 APIs from memory.
- Parody names only (Taureau Rouge Grand Cru, Le Monstre Blanc); no real Red Bull / Monster logos or names.
- Thomas is a generic sommelier, name only.
- Never reintroduce the Nexios sword, the victory bell or Pizza Hut.
- Assets: CC0 or credited in `README.md`. Ask the user before downloading any asset pack, and before creating the public GitHub repo.
- Log things that worked and then broke in `REGRET.md`.
