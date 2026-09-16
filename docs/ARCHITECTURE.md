# Architecture

The source-of-truth hierarchy is defined in `AGENTS.md`; `BUILD_SPEC.md` is
historical where superseded. This document is a practical, code-facing
reference maintained by Codex, the sole engineering agent. Architecture
changes must be surfaced explicitly and recorded when approved.

## Stack

- Expo SDK 57 (latest stable at project creation — see `docs/DECISIONS.md`
  for resolved versions), React Native, TypeScript strict mode
- Expo Router for navigation
- React Native Reanimated + React Native Gesture Handler for game-feel
  animation and drag interaction
- AsyncStorage for local persistence
- Expo Haptics, `expo-audio` (not the deprecated `expo-av` audio API)
- React Native Google Mobile Ads, behind an `AdService` interface
- Expo Dev Client + EAS Build (native ad SDK requires a dev build, not Expo
  Go)
- Jest (`jest-expo` preset) + React Native Testing Library
- ESLint + Prettier

No backend. No Redux/MobX/Zustand. No Skia (an 8×8 grid of Views is enough;
add Skia only if profiling proves a rendering bottleneck).

## Rendering decision

- Standard React Native Views: grid cells, pieces, timer badges, rubble, UI
  chrome.
- Reanimated: placement feedback, timer pulse, line-clear sweep, combo pop,
  explosion shake, result-screen transitions. Runs on the UI thread so it
  stays responsive even while JS is busy.

## Repository layout

```text
blastdown/
├── app/                      # Expo Router routes
│   ├── _layout.tsx
│   ├── index.tsx             # Home screen
│   ├── game.tsx
│   ├── results.tsx
│   ├── themes.tsx
│   ├── settings.tsx
│   └── tutorial.tsx
│
├── src/
│   ├── domain/                # Pure TypeScript. No React, no I/O.
│   │   ├── gameTypes.ts
│   │   ├── shapes.ts
│   │   ├── seededRandom.ts
│   │   ├── placement.ts
│   │   ├── lineClearing.ts
│   │   ├── timers.ts
│   │   ├── explosions.ts
│   │   ├── scoring.ts
│   │   ├── gameOver.ts
│   │   ├── powerups.ts
│   │   ├── reducer.ts
│   │   └── selectors.ts
│   │
│   ├── components/             # Codex-owned presentation layer
│   │   ├── GameBoard/
│   │   ├── GridCell/
│   │   ├── PieceTray/
│   │   ├── DraggablePiece/
│   │   ├── TimerBadge/
│   │   ├── ScoreHeader/
│   │   ├── ComboIndicator/
│   │   ├── RewardedActionButton/
│   │   └── modals/
│   │
│   ├── hooks/
│   │   ├── useGameController.ts
│   │   ├── useGamePersistence.ts
│   │   ├── useAudio.ts
│   │   ├── useHaptics.ts
│   │   └── useAppLifecycle.ts
│   │
│   ├── services/                # Adapter interfaces; screens never call vendor SDKs
│   │   ├── ads/
│   │   ├── analytics/
│   │   ├── storage/
│   │   ├── audio/
│   │   └── consent/
│   │
│   ├── config/                  # Balance, monetization caps, feature flags, themes
│   ├── utils/
│   └── testUtils/
│
├── assets/
├── docs/
├── __tests__/
│   ├── domain/
│   ├── integration/
│   └── components/
│
├── CLAUDE.md
├── AGENTS.md
├── BUILD_SPEC.md
├── app.config.ts
├── eas.json
├── package.json
├── tsconfig.json
└── .env.example
```

## Pure domain engine

The following must be pure TypeScript, with no React, no AsyncStorage, no
animation, no ad SDK, no sound, no navigation:

- Placement validation and application
- Line detection and clearing
- Timer updates
- Defuse detection
- Explosion generation
- Scoring
- Hand generation
- Game-over checking
- Power-up effects

## Domain data model

See `BUILD_SPEC.md` section 14 for the authoritative `GridCell`,
`ActiveTimedPiece`, `HandPiece`, `GameStatus`, and `GameState` types. They
will be implemented verbatim (or with only additive, non-breaking changes) in
`src/domain/gameTypes.ts` during Phase 1. `GameState` must carry a schema
`version` for migrations.

## Event output

The reducer returns gameplay events alongside new state so UI code can react
(animation, audio, haptics) without re-deriving what happened:

```ts
type GameEvent =
  | { type: "piecePlaced"; cells: CellPosition[] }
  | { type: "linesCleared"; rows: number[]; columns: number[] }
  | { type: "pieceDefused"; pieceId: string; bonus: number }
  | { type: "timerWarning"; pieceId: string; remainingTurns: number }
  | { type: "explosion"; explosionId: string; cells: CellPosition[] }
  | { type: "comboChanged"; combo: number }
  | { type: "gameOver" };
```

## Service adapters

Every external dependency (ads, analytics, storage, consent, audio, haptics)
is accessed through an interface, with at least a mock implementation for
development/tests and a real implementation for native builds:

```ts
interface AdService {
  preloadRewarded(placement: RewardedPlacement): Promise<void>;
  showRewarded(
    placement: RewardedPlacement,
  ): Promise<"earned" | "closed" | "unavailable" | "error">;
}
```

The complete V1 rewarded placement union is `rewarded_freeze |
rewarded_defuse`. Interstitial methods and excluded legacy placements are not
part of the production contract.

`MockAdService` backs development and tests; `GoogleMobileAdsService` backs
native development and production builds. Analytics, storage, and consent
follow the same pattern.

## No premature abstraction

Do not introduce: entity-component systems, generic game frameworks, plugin
engines, dependency-injection containers, custom event buses, unnecessary
repository layers, or a state machine library where a typed reducer already
does the job.

## Turn resolution order

Order of operations for every successful placement (see `BUILD_SPEC.md`
section 6.10 for full rationale):

1. Capture a pre-turn snapshot (undo/debugging).
2. Place the new piece.
3. Detect completed lines.
4. Clear completed lines.
5. Identify timed pieces with no remaining cells.
6. Award defuse bonuses.
7. Decrement timers belonging to pieces that existed before this placement.
8. Do not decrement the newly placed piece.
9. If timer freeze is active, skip decrement and consume one freeze turn.
10. Identify expired pieces.
11. Resolve all expirations and explosions.
12. Remove the used piece from the hand.
13. Refill the hand if all three pieces were used.
14. Calculate score and combo changes.
15. Check whether any current hand piece can fit.
16. Save the updated active run.
17. Emit analytics and animation events.

This ordering is what lets a player save a piece showing `1` by clearing it
with the current placement — do not reorder steps 3–9 without updating this
document and `docs/GAME_RULES.md` together.
