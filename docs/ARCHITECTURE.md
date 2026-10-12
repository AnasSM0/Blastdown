# Architecture

The source-of-truth hierarchy is defined in `AGENTS.md`; `BUILD_SPEC.md` is
historical where superseded. This document is a practical, code-facing
reference maintained by Claude Code, the sole engineering agent. Architecture
changes must be surfaced explicitly and recorded when approved.

## Stack

- Expo SDK 57 (latest stable at project creation — see `docs/DECISIONS.md`
  for resolved versions), React Native, TypeScript strict mode
- Expo Router for navigation
- React Native `Animated` for the production board's effects; React Native
  Reanimated is imported only by the optional cinematic renderer.
  React Native Gesture Handler provides drag interaction.
- AsyncStorage for local persistence
- Expo Haptics, `expo-audio` (not the deprecated `expo-av` audio API)
- React Native Google Mobile Ads, behind an `AdService` interface
- Expo Dev Client + EAS Build (native ad SDK requires a dev build, not Expo
  Go)
- Jest (`jest-expo` preset) + React Native Testing Library
- ESLint + Prettier

No backend. No Redux/MobX/Zustand. `@shopify/react-native-skia` is installed
for the optional, default-OFF cinematic renderer only; the production board
does not depend on it.

## Rendering decision

Verified against `src/config/renderer.ts`, `react-native.config.js`, and the
code under `src/components/` and `src/rendering/` at the time of this entry.

- **Production board (default):** React Native Views for cells, pieces, timer
  badges, rubble, and chrome, animated with React Native `Animated`. This is
  the `views` renderer and the approved production path.
- **Optional cinematic renderer:** a single Skia canvas under
  `src/rendering/cinematic/`, selected only by
  `EXPO_PUBLIC_CINEMATIC_BOARD` (`1`, `true`, or `skia`). It is default OFF.
  It is the only code that imports Reanimated. No physical-device
  qualification evidence for it is recorded in the repository, so it must not
  be treated as production-qualified.
- **Production native linking:** when `EXPO_PUBLIC_APP_ENV=production` and the
  cinematic flag is off, `react-native.config.js` sets
  `platforms.android = null` for Skia, Reanimated, and Worklets so they are not
  autolinked into the production Android build. Development clients keep all
  three.
- **Effects:** gameplay events flow through the event-driven effects pipeline
  (`src/ui/effects/`), which both renderers consume. Preserve this
  architecture; presentation must not re-derive gameplay results.
- **Changes:** any renderer change, including promoting Skia or adding a
  rendering library, needs a separate evaluation (production configuration,
  alternatives, on-device performance) and explicit owner approval.

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
│   ├── components/             # Presentation layer
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
