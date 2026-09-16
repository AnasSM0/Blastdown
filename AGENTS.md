# AGENTS.md

Repository-wide rules for engineering work in BlastDown.

## Authority and governance

Codex is the sole engineering agent for the current build. Product direction
comes from the approved product documents, not from an agent. If a requested
change affects architecture, gameplay rules, persistence, monetization,
analytics, dependencies, or the source-of-truth documents, Codex must surface
that impact explicitly and record an approved decision. No agent may silently
change product direction or architecture.

When documents conflict, use this order:

1. `docs/PRD.md`
2. `docs/TECHNICAL_DESIGN.md`
3. `docs/APP_FLOW.md`
4. `docs/UI_UX_BRIEF.md`
5. `docs/BACKEND_DESIGN.md`
6. `docs/ENGINEERING_PLAN.md`
7. `docs/GAME_RULES.md`
8. `docs/DECISIONS.md`
9. `BUILD_SPEC.md`, as historical context only where it has not been superseded

The current task prompt governs execution details when it does not conflict
with a higher product source. Existing code is evidence, not product authority.

## Locked V1 scope

V1 includes the endless 8×8 game, three-piece hand, move-based timers, natural
defuse, explosions/rubble, score/combo/best score, active-run persistence,
tutorial, Home/Game/Pause/Results/Settings, rewarded Freeze and Defuse,
audio/music/haptics, accessibility/reduced motion, consent/privacy,
production rewarded-ad support, analytics/crash reporting, and Android-first
release work.

V1 excludes Bolts, Themes/economy, Double Bolts, rewarded Revive,
interstitials, accounts, cloud save, leaderboards, missions, achievements,
daily systems, levels, special hazards, and progression systems. Excluded
features must not appear in production UI or be required by current
persistence, analytics, or monetization. Deprecated stored fields may remain
parseable for backward compatibility.

## Language and types

- Keep strict TypeScript enabled.
- Do not use `any` without an inline justification.
- Prefer precise union types over loose booleans or strings.

## Architecture boundaries

- Keep gameplay rules pure in `src/domain/`; no storage, animation, ads, audio,
  navigation, or React hooks there.
- Screens and components call typed service interfaces, never vendor SDKs.
- Keep balance values in `src/config/`, not components or reducers.
- Do not add global state management, a backend, or a navigation replacement.
- Do not change board size, timer rules, explosion rules, scoring, or seeded
  determinism without explicit product authorization.

## Dependencies and process

- Do not add or upgrade dependencies unless the task explicitly authorizes it.
- Keep changes scoped; do not bundle unrelated refactors.
- Add unit, component, or integration tests appropriate to every behavior
  change.
- Preserve offline core gameplay.
- Preserve user changes in a dirty worktree.
- Return exact verification commands and results.
- Do not merge automatically unless explicitly instructed.

## Git

- Use task branches and the commit format `type(scope): summary`.
- Inspect the complete diff and repository status before committing.
- Push only when the task asks for it.
