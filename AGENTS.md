# AGENTS.md

Repository-wide rules for engineering work in BlastDown.

## Authority and governance

Claude Code is the sole engineering agent for the current build, succeeding
Codex (see the 2026-10-12 decision-log entries). Product direction comes from
the approved product documents, not from an agent.

Claude Code is responsible for repository architecture and technical
implementation; game-engine changes when explicitly approved; UI, graphics,
motion, and animation; audio and haptics; tests, debugging, and performance;
Android builds and release engineering when authorized; documentation
maintenance; and reporting technical risks and results.

The project owner retains final approval over gameplay rule changes, product
scope, monetization behavior, new production dependencies, significant
architectural changes, release configuration, Google Play publication, and
production analytics or privacy-sensitive integrations. If a requested change
affects any of these, the source-of-truth documents, persistence, or
analytics, Claude Code must surface that impact explicitly and record an
approved decision. No agent may silently change product direction,
architecture, or specifications.

Complete, verify, and review one bounded engineering task before starting the
next major task. The handover transfers engineering responsibility only; it
grants no permission to change game rules, scope, release configuration, or
the locks below.

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

These locks describe the shipped V1 release and stay in force until a
separately authorized specification task reconciles them. BlastDown 2.0 is an
approved post-V1 direction (see the 2026-10-12 decision-log entries), but it
activates no V2 feature by itself: each V2 feature needs explicit task
authorization, and V1 exclusions are not automatically applicable to
approved V2 features.

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

## Live validation policy (permanent owner directive, 2026-10-12)

Code completion is not product completion. Verify the running game before
reporting success.

**Reasoning effort.** Work at MEDIUM by default. Use HIGH only when the owner
sets it for a specific problem. If genuinely stuck, state the exact blocker
and the evidence, then stop; do not raise effort or widen scope on your own.
Every implementation prompt must repeat this workflow.

**Tasks that change the application** require, in order:

1. Inspect the affected code and its tests before editing; implement only the
   approved change.
2. Run typecheck, lint, relevant tests, and the full automated suite with the
   project's existing commands.
3. Build or launch the real Android app (emulator or physical device, scripted
   interaction where supported) and exercise the feature, including success,
   invalid input, interruption, navigation, and edge cases.
4. Capture real Android screenshots, and screen recordings for animation,
   drag, and effects. Inspect them against approved references and Design 2.0.
   Browser mockups, renders, or generated images are not substitutes.
5. Check runtime logs for crashes, React Native errors, Android exceptions,
   and rendering warnings. For graphics changes, assess responsiveness, frame
   performance, small- and normal-screen layout, and artifacts with available
   measurement tools.
6. Fix task-introduced defects, then rerun the affected live scenarios, the
   full automated suite, and the gameplay regression.

**Gameplay regression** after significant UI, graphics, animation, gesture, or
gameplay changes covers: startup and Home; tutorial with real drag gestures;
tap-select and tap-to-place; drag and placement preview; valid and invalid
placements; single and multi-line clears; countdown changes; natural defuse
including critical saves; expiry, explosion, and rubble; rubble clearing;
score, combo, and praise accuracy; pause, resume, restart; game over and
results; active-run save and restore; audio, haptics, and reduced motion; and
rewarded-ad flows with safe test configuration, including cancel and
unavailable. Never exercise production ads for testing. Extend the regression
when new game modes ship.

**Evidence.** Keep screenshots, recordings, logs, and reports in a clearly
named QA evidence directory outside tracked source or in an existing
gitignored directory, and report every path. Never commit evidence media.
Never fabricate screenshots, recordings, measurements, or results.

**Status vocabulary.**

- `FULLY VALIDATED`: automated checks pass, the feature works in the running
  Android app, required regression passed, visuals were captured and
  reviewed, and no task-introduced critical defect remains.
- `IMPLEMENTED — LIVE VALIDATION PENDING`: used when a required device,
  emulator, or tool is unavailable. Report the exact limitation and ask the
  owner for the missing access.
- Docs-only tasks need no Android build or recording but must run applicable
  documentation, governance, and automated checks.

**Release protection.** Local, development, and test builds are allowed to
validate an approved task. Never publish, upload, replace, or alter the Google
Play Closed-testing release, nor change package name, versionCode, release
configuration, or dependencies, without explicit owner authorization. Do not
add dependencies or automation frameworks merely to simplify testing.

## Git

- Use task branches and the commit format `type(scope): summary`.
- Inspect the complete diff and repository status before committing.
- Push only when the task asks for it.
