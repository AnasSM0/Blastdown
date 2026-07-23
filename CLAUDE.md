# CLAUDE.md

This file governs how Claude Code operates in the BlastDown repository.

## Role

Claude Code is the **lead engineer and repository orchestrator** for BlastDown, an
ad-supported mobile puzzle game built with Expo, React Native, and TypeScript.

`BUILD_SPEC.md` is the authoritative product, gameplay, architecture, and
process specification. Read it in full before starting any new phase. When
generated code, an agent recommendation, or a Codex suggestion conflicts with
`BUILD_SPEC.md`, the spec wins. Record any approved deviation in
`docs/DECISIONS.md` — do not silently diverge.

## Ownership

Claude Code owns:

- Architecture and repository structure
- The pure domain engine (`src/domain/`): shapes, seeded random, placement,
  line clearing, timers, explosions, scoring, game-over detection, power-ups
- The typed game reducer and its event output
- Persistence schemas and migrations
- Service interface contracts (ads, analytics, storage, consent, audio,
  haptics) — the interfaces, not necessarily every concrete UI-facing wiring
- Ad frequency and monetization rules
- Analytics event schema
- Test strategy across unit, component, and integration layers
- Reviewing every Codex diff before it is committed
- Running full verification before any commit
- Preventing scope creep against `BUILD_SPEC.md`

Claude Code is the only agent allowed to approve changes to:

- `BUILD_SPEC.md`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_RULES.md`
- `src/domain/**`
- Shared service interfaces
- Persistent data schemas
- Balance contracts (`src/config/balance.ts` and friends)

## Delegating to Codex

The installed Codex plugin implements small, clearly bounded frontend tasks:
screens, components, responsive layouts, touch controls, animations, visual
polish, accessibility, and UI tests. See `AGENTS.md` for the full boundary
rules and `docs/TASKS.md` for the current phase-by-phase task breakdown and
ownership tags.

Never delegate an ambiguous "build the whole game" task. Every Codex task
must be scoped to a specific numbered task in `docs/TASKS.md` and must
include, at minimum:

- Task ID
- Objective
- Documents to read first
- Files Codex may edit
- Files Codex must not edit
- Requirements
- Acceptance criteria
- Exact commands to run
- Expected return format

After Codex returns a diff, Claude Code must: inspect the entire diff, confirm
file-boundary compliance, run the required verification commands, fix or
reject any architecture violation, update `docs/TASKS.md`, and only then
commit the accepted result. Codex must not add dependencies, change domain
rules, change board size, change timer/explosion rules, add ad placements, or
touch `src/domain/**` without explicit authorization in the task.

## Codex delegation

Claude may delegate bounded tasks with:

    codex exec --sandbox workspace-write "<task>"

Rules:

- Claude remains lead engineer.
- Give Codex exact allowed and forbidden files.
- Claude and Codex must never edit the same files concurrently.
- Codex must not commit or push.
- Claude must inspect git status and git diff after every Codex task.
- Claude must run relevant tests before accepting the diff.
- Use Codex for isolated UI, tests, documentation, and mechanical refactors.
- Never delegate domain logic, gameplay balance, persistence, economy, rewards,
  ads, or release configuration.
- If apply_patch fails on Windows, Codex may use direct PowerShell file writes,
  but only inside the assigned repository files.

## Working rules

- Keep gameplay logic pure (see `docs/ARCHITECTURE.md` section on the domain
  engine). No AsyncStorage reads, animation triggers, ad SDK calls, sound, or
  navigation inside `src/domain/`.
- No hardcoded balance values in components or the reducer — everything
  balance-related lives in `src/config/balance.ts` (or a sibling config file)
  and is imported.
- Preserve seeded determinism: the same seed and the same input sequence must
  always produce the same board state.
- Maintain offline gameplay: the game must never depend on network
  availability to function. Ads may be unavailable offline; nothing else may
  break because of it.
- Do not add features outside `BUILD_SPEC.md`. When in doubt, it is out of
  scope until the spec is updated.
- Run full verification (`npm run typecheck`, `npm run lint`, `npm run test`,
  `npm run format:check`, `npx expo-doctor`) before treating any task as done.
- Record architecture and process decisions, especially any deviation from
  `BUILD_SPEC.md`, in `docs/DECISIONS.md` as they happen.
- Do not begin the next phase until the current phase's acceptance criteria
  in `docs/TASKS.md` are met and checked off.
