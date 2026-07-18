# AGENTS.md

Repository-wide rules for any coding agent (Claude Code, Codex, or otherwise)
working in BlastDown. `BUILD_SPEC.md` is the source of truth; this file is a
condensed, enforceable checklist derived from it.

## Language and types

- Strict TypeScript everywhere (`tsconfig.json` has `"strict": true` — do not
  weaken it).
- No `any` without an inline comment justifying why it's unavoidable.
- Prefer precise union types over booleans/strings for state (see
  `GameStatus`, `CellKind` in `docs/ARCHITECTURE.md`).

## Architecture boundaries

- No gameplay logic in UI components. Placement validity, line clearing,
  timers, explosions, and scoring live only in `src/domain/` and must stay
  pure (no AsyncStorage, no animation calls, no ad SDK calls, no sound, no
  navigation, no React hooks).
- No direct ad-SDK calls in screens or components. Go through the
  `AdService` interface (`src/services/ads/`). Same pattern for analytics,
  storage, consent, and audio: screens call an interface, never a vendor SDK
  directly.
- No hardcoded balance values (timer durations, scoring multipliers, ad
  frequency caps, etc.) inside components or the reducer. They live in
  `src/config/` and are imported.
- Do not add a global state management library (Redux, MobX, Zustand, ...).
  Use pure domain functions, a typed reducer, and React Context only for
  app-level services/preferences.
- Do not add React Native Skia, a custom backend, or replace Expo Router
  unless `BUILD_SPEC.md` is updated first.

## Dependencies

- No unapproved dependencies. If a task seems to need a new package, stop and
  flag it instead of installing it silently.
- No dependency upgrades outside a task that explicitly authorizes it.

## Process

- No unrelated refactors bundled into a task's diff. Touch only what the task
  scopes.
- Tests are required for any behavior change: unit tests for domain logic,
  component tests for UI, integration tests for cross-cutting scenarios (see
  `docs/TEST_PLAN.md`).
- Preserve seeded determinism in anything touching random generation or the
  reducer.
- Maintain offline gameplay: never make core gameplay depend on a network
  call succeeding.
- Respect assigned file boundaries exactly. If a task's "allowed files" list
  doesn't cover something you need to change, stop and ask rather than
  expanding scope.
- Return exact verification results (command + pass/fail + relevant output),
  not a summary claim of "it works."

## Codex-specific scope

Codex is preferred for, and should stay within: Expo screen implementation,
responsive layouts, reusable UI components, grid/piece rendering, tap and
drag interaction, placement preview presentation, Reanimated effects, timer
visual states, explosion presentation, haptic wiring, audio wiring, theme
presentation, accessibility improvements, component tests, Android layout
fixes, visual polish, and store screenshot staging tools.

Codex must not, without explicit task authorization: add a state-management
library, add Skia, add a backend, replace Expo Router, change board size,
change timer rules, change explosion rules, add new currencies, add new ad
placements, upgrade dependencies, or rewrite domain modules. Codex may
propose a domain change but must report it rather than implement it.

## Git

- One repository. Branch names: `main`, `develop`, `feat/<task-id>-<desc>`,
  `fix/<task-id>-<desc>`.
- Commit format: `type(scope): summary`, e.g.
  `feat(engine): implement countdown resolution`,
  `fix(ads): preserve reward state after load failure`,
  `test(engine): cover simultaneous explosions`,
  `docs(architecture): record ad-service decision`.
- Claude and another agent must not edit the same files at the same time
  (single-writer rule per file/module for the duration of a task).
