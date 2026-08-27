# BlastDown — CTO Product and Engineering Specification

> **Historical document after A-04 (2026-08-28).** This file preserves the
> original specification and ownership model for traceability. It is no longer
> the primary source of truth. Use the hierarchy in `AGENTS.md`: PRD, Technical
> Design, App Flow, UI/UX Brief, Backend Design, Engineering Plan, Game Rules,
> Decisions, then this file only where not superseded. Claude/Codex ownership,
> Bolts, Themes/economy, Double Bolts, rewarded Revive, and interstitial content
> below is historical and not a current instruction or V1 requirement.

**Document version:** 1.0
**Project status:** Pre-production
**Primary platform:** Android
**Secondary platform:** iOS after Android validation
**Development model:** Claude Code orchestrates; Codex implements bounded tasks
**Framework:** React Native with Expo and TypeScript
**Game orientation:** Portrait
**Business model:** Ad-supported mobile puzzle game
**Backend:** None for MVP

---

# 1. Purpose of This Document

This document is the authoritative product, gameplay, architecture, development, testing, monetization, and agent-collaboration specification for **BlastDown**.

Claude Code and Codex must treat this document as the source of truth.

When a conflict exists between generated code, agent recommendations, and this document:

1. This document takes priority.
2. Claude Code records any approved deviation in `docs/DECISIONS.md`.
3. Codex must not independently change gameplay rules or architecture.
4. New features must not be added unless they are explicitly within scope.

The first objective is not to build a large commercial game. The first objective is to create a polished, measurable version of the core BlastDown mechanic and validate whether countdown pressure makes block-placement gameplay more engaging.

---

# 2. Product Summary

## 2.1 Working title

**BlastDown**

The name may change before Play Store publication, but it should remain the internal project name.

## 2.2 Genre

* Casual puzzle
* Block placement
* Endless score-chasing
* Light strategy
* Ad-supported mobile game

## 2.3 Five-second explanation

> Place blocks to clear rows and columns, but every placed piece has a countdown. Clear it before the timer expires or it damages the board.

## 2.4 One-line core loop

> Choose piece → place piece → clear lines → defuse timed pieces → avoid explosions → build combos → survive longer → fail → revive or restart.

## 2.5 Main differentiation

Traditional block-placement games ask the player only to prevent the grid from filling.

BlastDown adds a visible deadline to every placed piece. The player must therefore balance:

* Immediate line clearing
* Long-term board organization
* Countdown management
* Combo opportunities
* Risk versus reward

The timer must be visible enough that BlastDown looks different from an ordinary block puzzle within the first three seconds of a gameplay video.

---

# 3. Core Product Principles

## 3.1 Familiar before different

The player should recognize the basic block-placement mechanic immediately.

The timer is the only major gameplay twist in the MVP.

Do not add:

* Roguelike upgrades
* Cards
* Bosses
* Enemies
* Stories
* Campaign maps
* Complex currencies
* Multiple characters
* Multiplayer
* Online leaderboards
* Social systems

## 3.2 Fair pressure, not random punishment

The player should understand:

* Which piece is close to exploding
* How many placements remain
* How to defuse it
* What will happen when it expires

Failure should create the feeling:

> “I saw the danger and almost saved it.”

It should not create the feeling:

> “The game randomly punished me.”

## 3.3 Turn-based countdowns

The MVP will use **placement-based timers**, not real-time seconds.

A countdown of `5` means that the player has five future successful placements before that piece expires.

This is a deliberate CTO decision because move-based timers:

* Are easier to understand
* Are fair when the player pauses
* Do not punish slow thinkers
* Are easier to test deterministically
* Avoid app-background timing bugs
* Preserve strategic puzzle gameplay

Marketing may describe the mechanic as a countdown, but the UI should use language such as:

> “5 moves remaining”

A real-time Blitz mode is explicitly out of scope.

## 3.4 Gameplay must work offline

The game engine, progression, saved data, themes, sound, and active runs must work without an internet connection.

Advertisements may be unavailable offline, but the game must never crash or become unplayable because an ad failed to load.

## 3.5 Monetization must be valuable, not deceptive

Rewarded advertisements should help with a real problem:

* A piece is about to explode
* The board is damaged
* The player has just lost a valuable run
* The player wants to increase the earned reward

Do not deliberately generate impossible situations to force advertisements.

---

# 4. Target Player

## 4.1 Primary audience

* Casual mobile puzzle players
* Ages approximately 18–55
* Players familiar with Block Blast, 1010, Woodoku, Tetris-style shapes, and similar games
* Players who enjoy short sessions but may continue for several runs
* Players who prefer one-finger portrait games

## 4.2 Session expectation

A normal run should initially last approximately:

* New player: 1–3 minutes
* Average player: 3–6 minutes
* Skilled player: 6–12 minutes

These are product hypotheses, not guaranteed market results.

## 4.3 Desired emotional cycle

1. Calm planning
2. Timer warning
3. Rising pressure
4. Last-move rescue or explosion
5. Relief or frustration
6. Immediate desire to try again

---

# 5. MVP Scope

## 5.1 Must-have features

The first monetizable MVP must include:

* Home screen
* First-time tutorial
* 8×8 game board
* Three-piece hand
* Piece placement
* Placement preview
* Invalid-placement feedback
* Row clearing
* Column clearing
* Simultaneous row and column clearing
* Piece-based countdown system
* Timer warning states
* Defusing through line clears
* Explosion resolution
* Rubble cells
* Combo scoring
* Best-score persistence
* Active-run persistence
* Pause and resume
* Game-over flow
* Immediate restart
* One rewarded revive per run
* Rewarded timer freeze
* Rewarded piece defuse
* Rewarded double end-of-run currency
* Interstitial advertisements between eligible runs
* Basic cosmetic theme unlocks
* Sound settings
* Haptic settings
* Privacy and consent flow
* Local analytics/debug statistics
* Android development, preview, and production builds

## 5.2 Nice-to-have after the MVP

* Daily challenge
* Missions
* Achievements
* Additional block themes
* Additional explosion effects
* Weekly score challenge
* Cloud save
* Remove-ads purchase
* Alternative board sizes
* Real-time Blitz mode
* Limited-time events
* Shareable score cards

## 5.3 Explicitly out of scope

* Multiplayer
* Accounts
* Custom backend
* Real-time networking
* Chat
* Friends
* User-generated content
* Story mode
* Battle pass
* Pets
* Characters
* Equipment
* Inventory
* Roguelike relics
* Level editor
* Multiple gameplay engines
* Complicated daily economy
* Advertising banners during gameplay

---

# 6. Detailed Gameplay Specification

# 6.1 Board

The board is an **8×8 grid**.

Each cell can be one of:

* Empty
* Normal timed block
* Normal untimed block
* Rubble

Normal untimed blocks exist after a timed piece has been defused using a power-up.

## 6.2 Piece hand

The player receives three pieces at a time.

The player may place the three pieces in any order.

When all three pieces have been used, a new hand of three pieces is generated.

Pieces cannot be rotated in the MVP.

## 6.3 Initial piece catalog

The first production catalog should contain approximately 12 shapes:

1. Single cell
2. Two-cell horizontal line
3. Two-cell vertical line
4. Three-cell horizontal line
5. Three-cell vertical line
6. Four-cell horizontal line
7. Four-cell vertical line
8. 2×2 square
9. Small L
10. Mirrored small L
11. Large L
12. T shape

Shapes must be defined as arrays of relative coordinates.

Example:

```ts
type ShapeDefinition = {
  id: string;
  cells: ReadonlyArray<{
    row: number;
    column: number;
  }>;
  category: "small" | "medium" | "large";
  weight: number;
};
```

Do not store piece shapes as image assets.

## 6.4 Piece generation

Generation must use a seeded pseudo-random number generator.

Each run must have a recorded seed so that bugs can be reproduced.

The generator must not inspect the current board and intentionally select punishing pieces.

Use a weighted bag:

* Small pieces: approximately 40%
* Medium pieces: approximately 40%
* Large pieces: approximately 20%

The first tutorial run uses a fixed seed and fixed hands.

The early game may use a safer opening bag, but this must be based on turn count rather than current board condition.

## 6.5 Placement controls

Production interaction:

* Drag a piece from the hand
* Show a translucent board preview
* Release over a valid location to place
* Return the piece to the hand after an invalid release
* Provide light haptic feedback on valid placement
* Provide warning feedback on invalid placement

Accessibility fallback:

* Tap a piece to select it
* Tap a valid board cell to place it

Tap placement should be developed first because it is easier to validate. Drag placement should be added after the rules are stable.

## 6.6 Valid placement

A placement is valid when:

* Every shape cell remains inside the board
* Every target cell is empty
* No target cell contains rubble
* The piece has not already been used

## 6.7 Line clearing

After a successful placement:

* Detect every completed row
* Detect every completed column
* Clear all completed rows and columns simultaneously
* A cell included in both a row and column is counted once
* Normal blocks and rubble are both removed by line clearing

Do not clear 3×3 subgrids.

## 6.8 Timed pieces

Each placed shape becomes one **timed piece instance**.

All cells belonging to that placed shape share:

* A unique piece-instance ID
* The same remaining-turn count
* The same placement turn
* The same color

If part of the piece is cleared but other cells remain, its timer continues.

If all cells belonging to the piece are cleared, the piece is successfully defused.

## 6.9 Initial timer values

Recommended initial balance:

| Run turn | Starting countdown |
| -------- | -----------------: |
| 1–15     |            7 moves |
| 16–40    |            6 moves |
| 41–75    |            5 moves |
| 76+      |            4 moves |

These values must live in a central balance configuration file.

Do not hardcode them inside components or reducers.

The initial tutorial should remain at seven moves.

## 6.10 Turn-resolution order

The order of operations is critical.

For every successful placement:

1. Capture a pre-turn snapshot for undo and debugging.
2. Place the new piece.
3. Detect completed lines.
4. Clear completed lines.
5. Identify timed pieces with no remaining cells.
6. Award defuse bonuses.
7. Decrement timers belonging to pieces that existed before this placement.
8. Do not decrement the newly placed piece.
9. If timer freeze is active, skip timer decrement and consume one freeze turn.
10. Identify expired pieces.
11. Resolve all expirations and explosions.
12. Remove the used piece from the hand.
13. Refill the hand if all three pieces were used.
14. Calculate score and combo changes.
15. Check whether any current hand piece can fit.
16. Save the updated active run.
17. Emit analytics and animation events.

This order allows a player to save a piece showing `1` by clearing it with the current placement.

## 6.11 Timer display

For clarity, the countdown is attached to the piece instance.

Render the countdown on the visually most suitable surviving cell, preferably the top-left surviving cell.

Timer states:

* 7–5: normal
* 4–3: caution
* 2: warning pulse
* 1: urgent pulse, stronger haptic cue
* 0: explosion

Do not rely on color alone.

Every timer should also show its number.

## 6.12 Explosion behavior

When a timed piece reaches zero with cells remaining:

1. Remove the timer record.
2. Convert all surviving cells of that piece into rubble.
3. Find orthogonally adjacent empty cells around the expired piece.
4. Convert up to four adjacent empty cells into rubble.
5. Select adjacent cells deterministically using the run’s seeded random generator.
6. Emit one explosion animation for that expired piece.
7. Record the rubble cells created by that explosion.
8. Do not trigger an automatic line clear from explosion-created rubble.
9. Continue the run unless no hand piece can fit.

If multiple pieces expire on the same turn:

* Resolve them as one simultaneous explosion phase
* Cap newly added adjacent rubble at six cells for that entire turn
* Ensure deterministic ordering
* Do not recursively trigger explosions

This design makes expiration harmful without requiring a separate health system.

## 6.13 Rubble

Rubble:

* Occupies a grid cell
* Prevents new placement
* Does not have a timer
* Does not award normal placement score
* Can be removed by completing its row or column
* Has a visually damaged appearance
* Must remain clearly different from normal pieces

## 6.14 Game-over condition

The run ends when none of the remaining current-hand pieces can fit anywhere on the board.

An explosion does not automatically end the game.

This creates recoverable damage and gives players a reason to continue after mistakes.

## 6.15 Revive behavior

The player may use one rewarded revive per run.

After the rewarded ad is earned:

* Remove all rubble from the board
* Add two moves to every active timer
* Cap timers at nine
* Replace the current hand with three small or medium pieces
* Reset the combo to zero
* Resume the same score
* Mark revive as used

If the ad fails, closes without reward, or is unavailable:

* Do not change the game
* Preserve the game-over state
* Allow retry if the ad service reports a recoverable failure

## 6.16 Freeze power-up

Rewarded action:

> Freeze all timers for the next two successful placements.

Rules:

* Newly placed pieces still receive normal timers
* Existing timers do not decrease during frozen turns
* The freeze counter decreases after each successful placement
* Freeze does not stop UI animations or input
* Maximum two rewarded freezes per run

## 6.17 Defuse power-up

Rewarded action:

> Permanently defuse the piece with the lowest remaining timer.

Rules:

* The timed record is removed
* Its cells remain on the board as normal untimed blocks
* Ties are resolved deterministically
* Maximum two rewarded defuses per run
* Do not offer if no active timed pieces exist

## 6.18 Repair latest blast

This can remain behind a feature flag for post-MVP testing.

Reward:

* Remove rubble created by the most recent explosion only

Do not include it in the initial public interface unless testing shows that revive opportunities are too rare.

---

# 7. Scoring

All values must be configurable.

Recommended initial formula:

## 7.1 Placement score

* 1 point per placed cell

## 7.2 Line-clear score

* 100 points per cleared line

## 7.3 Multi-line bonus

| Lines cleared in one placement | Additional multiplier |
| ------------------------------ | --------------------: |
| 1                              |                    1× |
| 2                              |                  1.5× |
| 3                              |                    2× |
| 4+                             |                    3× |

## 7.4 Combo

A combo increases when consecutive placements each clear at least one line.

A placement with no clear resets the combo.

Recommended combo multiplier:

```text
1 + 0.25 × combo streak
```

Cap at 3× for MVP balancing.

## 7.5 Defuse bonus

When every remaining cell of a timed piece is cleared:

```text
25 base points + 10 × remaining timer
```

This rewards early, deliberate defusing.

## 7.6 Explosion penalty

* Reset combo
* Apply a score penalty of 50 points
* Score cannot fall below zero

## 7.7 Best score

Persist the player’s best score locally.

No online leaderboard is required.

---

# 8. Lightweight Currency and Themes

## 8.1 Currency

Use one currency called **Bolts**.

Bolts are earned at the end of a run.

Initial formula:

```text
Bolts = floor(score / 250) + successfully defused pieces
```

Cap normal run rewards if necessary after testing.

## 8.2 Double reward

At the final results screen, offer:

> Watch an advertisement to double this run’s Bolts.

This offer appears only if:

* The player did not revive through an unfinished ad flow
* An ad is available
* The reward has not already been doubled

## 8.3 Themes

The MVP may contain five programmatically styled themes:

1. Default
2. Neon
3. Ice
4. Lava
5. Midnight

Themes change:

* Block colors
* Board background
* Rubble appearance
* Particle colors
* Selected UI accents

Themes must not change gameplay.

Because the art is programmatic, themes should require very few external assets.

---

# 9. Tutorial

The tutorial should be playable, not text-heavy.

## Tutorial step 1

Place a simple piece.

Message:

> Drag a block onto the board.

## Tutorial step 2

Complete a row.

Message:

> Complete a row or column to clear it.

## Tutorial step 3

Introduce a timer.

Message:

> Every placed piece has a countdown.

## Tutorial step 4

Save a timer at one move.

Message:

> Clear every cell before the timer reaches zero.

## Tutorial step 5

Show a controlled explosion.

Message:

> Expired pieces create rubble.

## Tutorial step 6

Clear rubble through a line.

Message:

> Complete its row or column to repair the board.

Tutorial requirements:

* Fixed board
* Fixed piece sequence
* No ads
* No interstitial after completion
* Can be replayed from Settings
* Can be skipped after the first instructional placement

---

# 10. Screen Requirements

# 10.1 Home screen

Contains:

* BlastDown logo
* Play button
* Best score
* Bolts balance
* Themes button
* Settings button
* Privacy link
* Optional “How to Play”

Do not show an advertisement immediately on app open.

## 10.2 Game screen

Top area:

* Current score
* Best score
* Combo indicator
* Pause button

Center:

* 8×8 board
* Timer badges
* Explosion and line-clear effects

Bottom:

* Three available pieces
* Contextual rewarded-power button when appropriate

The gameplay area must remain usable on small Android devices.

## 10.3 Pause overlay

Contains:

* Resume
* Restart
* Sound
* Haptics
* Home

Timers do not change while paused because countdowns are move-based.

## 10.4 Game-over revive state

Show:

* Final score so far
* Best score status
* One rewarded revive button
* Decline and finish run button

Do not show an interstitial before the player makes the revive decision.

## 10.5 Final results

Show:

* Final score
* Best score
* Pieces placed
* Lines cleared
* Pieces defused
* Explosions
* Bolts earned
* Double Bolts rewarded option
* Play Again
* Home

## 10.6 Themes screen

Show:

* Theme previews
* Lock/unlock state
* Bolt cost
* Selected theme
* Purchase confirmation

## 10.7 Settings

Include:

* Sound on/off
* Music on/off
* Haptics on/off
* Reduced motion
* Tutorial replay
* Privacy choices
* Restore purchases placeholder if later needed
* App version
* Privacy policy
* Terms

---

# 11. Monetization Specification

# 11.1 Advertisement formats

Use:

* Rewarded advertisements
* Interstitial advertisements

Do not use banner advertisements during gameplay.

## 11.2 Rewarded placements

Required placements:

* `rewarded_revive`
* `rewarded_freeze`
* `rewarded_defuse`
* `rewarded_double_bolts`

Optional future placement:

* `rewarded_repair_blast`

## 11.3 Interstitial placement

Interstitials may appear after a completed run when all conditions are met:

* The player has completed at least two lifetime runs
* The run lasted at least 60 seconds
* At least 120 seconds have passed since the previous interstitial
* No rewarded advertisement was completed in the previous 45 seconds
* The current session has not exceeded its frequency cap
* The consent state permits the requested ad type
* An interstitial is already loaded

Never show:

* On first app open
* During gameplay
* Immediately after a rewarded advertisement
* Before the revive decision
* After every very short failed run
* Two advertisements back-to-back

## 11.4 Session frequency caps

Initial caps:

* Maximum one rewarded revive per run
* Maximum two freezes per run
* Maximum two defuses per run
* Maximum one double-reward ad per run
* Maximum three interstitials per 20-minute session

All caps must be configurable.

## 11.5 Ad failure behavior

When an ad:

* Is not loaded
* Times out
* Crashes
* Closes without earning the reward
* Returns an SDK error

The game must:

* Preserve the current state
* Show a short, non-blaming message
* Never silently lose the promised reward
* Allow a retry when appropriate
* Record the failure event

## 11.6 Development advertisements

Development and preview builds must use Google test ad IDs.

Production IDs must be loaded through environment configuration.

Real AdMob integration requires native configuration, so the project must use an Expo development build rather than relying solely on Expo Go. Expo development builds allow custom native libraries and configuration, and the React Native Google Mobile Ads package provides an Expo config plugin.

## 11.7 Consent

Before requesting personalized ads:

* Obtain the required consent
* Respect non-personalized advertising choices
* Persist consent state appropriately
* Provide a Settings option to revisit privacy choices
* Do not initialize ad requests in a way that bypasses required consent

Use the consent support provided by the chosen Google Mobile Ads integration.

---

# 12. Technical Stack

As of July 17, 2026, Expo SDK 57 is the latest documented Expo SDK. Initialize with the latest stable Expo release available at project creation and record the resolved versions in `docs/DECISIONS.md`. Expo Router is the recommended navigation approach for new Expo projects.

## 12.1 Required stack

* Expo SDK latest stable
* React Native
* TypeScript with strict mode
* Expo Router
* React Native Reanimated
* React Native Gesture Handler
* AsyncStorage
* Expo Haptics
* Expo Audio
* React Native Google Mobile Ads
* Expo Dev Client
* EAS Build
* Jest with `jest-expo`
* React Native Testing Library
* ESLint
* Prettier

Use `expo-audio`, not the deprecated `expo-av` audio API.

## 12.2 Rendering decision

Use standard React Native Views for:

* Grid cells
* Pieces
* Timer badges
* Rubble
* UI

Use Reanimated for:

* Placement feedback
* Timer pulse
* Line-clear sweep
* Combo pop
* Explosion shake
* Result transitions

Reanimated can execute animations on the UI thread, making it suitable for responsive game feedback.

Do not add React Native Skia initially.

An 8×8 grid does not require a custom graphics engine, and Skia increases Android application size. Add it only if profiling demonstrates a clear rendering limitation.

## 12.3 State management

Do not install Redux, MobX, Zustand, or another global state framework for the MVP.

Use:

* Pure TypeScript domain functions
* A typed game reducer
* React Context only for application-level services and preferences
* AsyncStorage for local persistence

## 12.4 Backend

There is no custom backend.

External services may include:

* Google AdMob
* Remote analytics provider
* Crash reporting provider
* EAS Build

Gameplay must not depend on any external service.

---

# 13. Repository Structure

```text
blastdown/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── game.tsx
│   ├── results.tsx
│   ├── themes.tsx
│   ├── settings.tsx
│   └── tutorial.tsx
│
├── src/
│   ├── domain/
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
│   ├── components/
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
│   ├── services/
│   │   ├── ads/
│   │   │   ├── AdService.ts
│   │   │   ├── MockAdService.ts
│   │   │   ├── GoogleMobileAdsService.ts
│   │   │   └── adPlacements.ts
│   │   ├── analytics/
│   │   │   ├── AnalyticsService.ts
│   │   │   └── analyticsEvents.ts
│   │   ├── storage/
│   │   │   ├── StorageService.ts
│   │   │   ├── activeRunStorage.ts
│   │   │   ├── progressStorage.ts
│   │   │   └── settingsStorage.ts
│   │   ├── audio/
│   │   └── consent/
│   │
│   ├── config/
│   │   ├── balance.ts
│   │   ├── monetization.ts
│   │   ├── featureFlags.ts
│   │   └── themes.ts
│   │
│   ├── utils/
│   └── testUtils/
│
├── assets/
│   ├── audio/
│   ├── icons/
│   ├── store/
│   └── licenses/
│
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── GAME_RULES.md
│   ├── MVP_SCOPE.md
│   ├── ARCHITECTURE.md
│   ├── STYLE_GUIDE.md
│   ├── MONETIZATION.md
│   ├── ANALYTICS.md
│   ├── TEST_PLAN.md
│   ├── TASKS.md
│   ├── DECISIONS.md
│   └── RELEASE_CHECKLIST.md
│
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

---

# 14. Domain Data Model

Recommended model:

```ts
type CellKind = "empty" | "timed" | "normal" | "rubble";

type GridCell =
  | {
      kind: "empty";
    }
  | {
      kind: "timed";
      pieceInstanceId: string;
      colorId: string;
    }
  | {
      kind: "normal";
      colorId: string;
    }
  | {
      kind: "rubble";
      explosionId: string;
    };

type ActiveTimedPiece = {
  id: string;
  shapeId: string;
  remainingTurns: number;
  placedOnTurn: number;
  colorId: string;
};

type HandPiece = {
  handId: string;
  shapeId: string;
  colorId: string;
};

type GameStatus =
  | "ready"
  | "playing"
  | "paused"
  | "resolving"
  | "gameOver"
  | "awaitingRevive"
  | "finished";

type GameState = {
  version: number;
  seed: string;
  rngState: number;
  turn: number;
  grid: GridCell[][];
  hand: HandPiece[];
  activeTimers: Record<string, ActiveTimedPiece>;
  score: number;
  combo: number;
  bestCombo: number;
  linesCleared: number;
  piecesPlaced: number;
  piecesDefused: number;
  explosions: number;
  rubbleCleared: number;
  freezeTurnsRemaining: number;
  rewardedFreezeUses: number;
  rewardedDefuseUses: number;
  reviveUsed: boolean;
  lastExplosionId?: string;
  status: GameStatus;
  startedAt: number;
  lastUpdatedAt: number;
};
```

Persisted data must include a schema version and migration mechanism.

---

# 15. Architecture Rules

## 15.1 Pure domain engine

The following must be pure TypeScript:

* Placement validation
* Placement application
* Line detection
* Line clearing
* Timer updates
* Defuse detection
* Explosion generation
* Scoring
* Hand generation
* Game-over checking
* Power-up effects

Pure functions must not:

* Read AsyncStorage
* Trigger animations
* Call advertisement SDKs
* Play sound
* Navigate screens
* Access React hooks

## 15.2 Event output

The reducer may return gameplay events alongside new state.

Example:

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

UI code consumes these events for animations, audio, and haptics.

## 15.3 Service adapters

Screens must never call the AdMob SDK directly.

Use an interface:

```ts
interface AdService {
  preloadRewarded(placement: RewardedPlacement): Promise<void>;
  showRewarded(
    placement: RewardedPlacement,
  ): Promise<"earned" | "closed" | "unavailable" | "error">;
  preloadInterstitial(): Promise<void>;
  showInterstitial(): Promise<"shown" | "unavailable" | "error">;
}
```

Create:

* `MockAdService` for development and tests
* `GoogleMobileAdsService` for native development and production builds

Follow the same adapter approach for:

* Analytics
* Storage
* Consent
* Audio
* Haptics

## 15.4 No premature abstraction

Do not create:

* Entity-component systems
* Generic game frameworks
* Plugin engines
* Dependency-injection containers
* Custom event buses
* Unnecessary repositories
* Complex state machines when a typed reducer is sufficient

---

# 16. Persistence

Persist:

* Settings
* Best score
* Bolt balance
* Theme unlocks
* Selected theme
* Tutorial completion
* Consent state where appropriate
* Lifetime statistics
* Active run

Save the active run:

* After every completed turn
* When the app enters the background
* When the player pauses
* Before showing a rewarded advertisement

When resuming:

* Restore the exact board
* Restore timers unchanged
* Restore the hand
* Restore the RNG state
* Do not reduce timers based on elapsed real-world time

---

# 17. Analytics Requirements

Create a provider-independent analytics interface.

Minimum events:

* `app_open`
* `tutorial_started`
* `tutorial_step_completed`
* `tutorial_completed`
* `run_started`
* `run_resumed`
* `run_abandoned`
* `run_finished`
* `line_clear`
* `multi_line_clear`
* `piece_defused`
* `timer_reached_two`
* `timer_reached_one`
* `explosion_occurred`
* `reward_offer_shown`
* `reward_ad_started`
* `reward_ad_earned`
* `reward_ad_closed_without_reward`
* `reward_ad_error`
* `interstitial_shown`
* `interstitial_error`
* `immediate_replay`
* `theme_unlocked`
* `settings_changed`

Do not send a remote analytics event for every board-cell render.

The `run_finished` event should include aggregated values:

* Duration
* Final score
* Turn count
* Pieces placed
* Lines cleared
* Best combo
* Defuses
* Explosions
* Rubble created
* Rubble cleared
* Rewarded actions used
* Revive used
* End reason
* Run seed
* App version

Development builds should provide a local debug analytics screen.

---

# 18. Performance Requirements

Targets:

* Smooth interaction on common budget and mid-range Android devices
* No visible delay after placement
* No complete board rerender when only a few cells change, where reasonably avoidable
* No long-running JavaScript timers
* No real-time game loop
* No memory growth across repeated runs
* No sound objects created on every tap
* No repeated advertisement SDK initialization

Optimization rules:

* Memoize grid cells where helpful
* Keep board calculations small and synchronous
* Preload short sound effects
* Preload ads outside urgent moments
* Use Reanimated only for visible motion
* Avoid continuous particle systems
* Cap explosion particles
* Profile before introducing Skia or another renderer

---

# 19. Accessibility and User Comfort

Include:

* Numerical timer labels
* Colorblind-safe theme option
* Haptics toggle
* Sound toggle
* Music toggle
* Reduced-motion toggle
* Large touch targets
* Clear invalid-placement feedback
* No countdown while the player is inactive
* No flashing effect that creates accessibility risk
* No required audio cues
* Safe-area support
* Small-screen support

---

# 20. Assets

## 20.1 Programmatic assets

Create through React Native Views and animations:

* Board
* Block shapes
* Timer badges
* Rubble
* Placement ghost
* Line-clear sweep
* Explosion particles
* Combo display
* Theme previews

## 20.2 External visual assets

Required:

* App icon
* Logo or wordmark
* Splash image if needed
* Store feature graphic
* Google Play screenshots

AI may be used to create these, but final assets must be manually checked for:

* Consistent style
* Legibility at small sizes
* No copied trademarks
* No unwanted text
* No copyrighted characters
* Correct dimensions

## 20.3 Audio assets

Initial sound list:

* Piece selection
* Valid placement
* Invalid placement
* Line clear
* Multi-line clear
* Timer warning
* Urgent timer warning
* Successful defuse
* Explosion
* Rubble clear
* Game over
* Button press
* Theme unlock

Optional:

* One subtle looping background track

Every downloaded sound must have its license recorded in:

```text
assets/licenses/AUDIO_LICENSES.md
```

---

# 21. Testing Strategy

# 21.1 Unit tests

Claude Code owns domain unit tests.

Required coverage:

* Valid placement
* Out-of-bounds placement
* Overlap prevention
* Row clearing
* Column clearing
* Simultaneous row and column clearing
* Rubble clearing
* Timer assignment
* New piece not decrementing immediately
* Existing timer decrement
* Freeze behavior
* Partial piece clear
* Full piece defuse
* Saving a timer at one
* Single explosion
* Multiple simultaneous explosions
* Adjacent-rubble cap
* Deterministic explosion cells
* Defuse power-up
* Revive power-up
* Hand refill
* Seeded sequence reproducibility
* Game-over detection
* Score calculation
* Combo reset
* Persistence migration

## 21.2 Component tests

Codex initially implements component tests, and Claude reviews them.

Required areas:

* Piece selection
* Placement preview
* Invalid-placement feedback
* Timer-badge state
* Rewarded-action loading state
* Game-over revive state
* Results screen
* Settings persistence

## 21.3 Integration tests

Required scenarios:

1. Complete a normal row.
2. Defuse a timer at one.
3. Allow a timer to explode.
4. Clear rubble after an explosion.
5. Freeze timers for two placements.
6. Defuse the lowest timer.
7. Reach game over.
8. Earn a rewarded revive.
9. Resume a saved run.
10. Decline revive and finish the run.
11. Double Bolts.
12. Restart without stale state.

## 21.4 Manual device matrix

At minimum test:

* Small Android screen
* Medium Android screen
* Low-memory Android device or emulator
* Current Android version
* One older supported Android version
* Offline mode
* Slow network
* Advertisement unavailable
* Advertisement closed
* Advertisement error
* App backgrounded during ad
* App backgrounded during a run

## 21.5 Required commands

The final scripts should support:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run format:check
npx expo-doctor
```

No task is complete until the applicable commands pass.

---

# 22. Git and Branching Rules

Use one Git repository.

Recommended branches:

* `main`
* `develop`
* `feat/<task-id>-<description>`
* `fix/<task-id>-<description>`

Claude Code is responsible for integration.

Codex must work on a scoped branch or scoped working tree.

Commit format:

```text
feat(engine): implement countdown resolution
feat(ui): add timer warning states
fix(ads): preserve reward state after load failure
test(engine): cover simultaneous explosions
docs(architecture): record ad-service decision
```

Each completed task must include:

* Code
* Tests
* Documentation updates where needed
* Short commit
* Verification results

---

# 23. Claude Code and Codex Collaboration Model

# 23.1 Claude Code role

Claude Code is the technical lead and repository orchestrator.

Claude Code owns:

* Understanding the complete repository
* Architecture
* Domain model
* Gameplay rules
* Game reducer
* Seeded generation
* Timer resolution
* Explosion logic
* Scoring
* Persistence schema
* Service interfaces
* Ad frequency rules
* Analytics schema
* Native integration planning
* Test strategy
* Reviewing Codex changes
* Running full verification
* Integration commits
* Preventing scope creep

Claude Code is the only agent allowed to approve changes to:

* `BUILD_SPEC.md`
* `CLAUDE.md`
* `AGENTS.md`
* `docs/ARCHITECTURE.md`
* `docs/GAME_RULES.md`
* `src/domain/`
* Shared service interfaces
* Persistent data schemas
* Balance contracts

## 23.2 Codex role

Codex should receive small, precise tasks.

Codex owns or is preferred for:

* Expo screen implementation
* Responsive layouts
* Reusable UI components
* Grid rendering
* Piece rendering
* Tap and drag interaction
* Placement preview
* Reanimated effects
* Timer visual states
* Explosion presentation
* Haptic wiring
* Audio wiring
* Theme presentation
* Accessibility improvements
* Component tests
* Android layout fixes
* Visual polish
* Store screenshot staging tools
* Performance improvements inside assigned UI boundaries

Codex may suggest domain changes but must not directly change game rules without Claude approval.

## 23.3 Shared responsibilities

Both agents may:

* Review code
* Identify bugs
* Write tests
* Improve types
* Improve error handling
* Run static analysis
* Recommend simplification

Claude Code makes the final integration decision.

## 23.4 Single-writer rule

Claude and Codex must not edit the same files simultaneously.

For every Codex task, Claude must provide:

* Task ID
* Objective
* Files Codex may edit
* Files Codex must not edit
* Relevant documents to read
* Acceptance criteria
* Required test commands
* Expected return format

After Codex completes a task, Claude must:

1. Inspect the entire diff.
2. Confirm file-boundary compliance.
3. Run tests.
4. Fix or reject architecture violations.
5. Update `docs/TASKS.md`.
6. Commit the accepted result.

## 23.5 No silent architecture changes

Codex must not:

* Add a state-management library
* Add Skia
* Add a backend
* Replace Expo Router
* Change the board size
* Change timer rules
* Change explosion rules
* Add new currencies
* Add new ad placements
* Upgrade dependencies
* Rewrite domain modules

unless the task explicitly authorizes it.

---

# 24. Required Agent Instruction Files

## 24.1 `CLAUDE.md`

Claude Code should create `CLAUDE.md` containing:

* Claude is the repository orchestrator
* Read `BUILD_SPEC.md` before every major phase
* Maintain `docs/TASKS.md`
* Delegate bounded frontend work to Codex
* Never delegate an ambiguous “build the whole game” task
* Review every Codex diff
* Keep game logic pure
* Prevent scope creep
* Run full verification before commits
* Record decisions in `docs/DECISIONS.md`

## 24.2 `AGENTS.md`

Create a repository-wide `AGENTS.md` containing:

* Strict TypeScript
* No `any` without documented justification
* No gameplay logic in UI components
* No direct ad-SDK calls in screens
* No hardcoded balance values
* No unapproved dependencies
* No unrelated refactors
* Tests required for behavior changes
* Preserve seeded determinism
* Maintain offline gameplay
* Respect assigned file boundaries
* Return exact verification results

---

# 25. Development Phases and Ownership

## Phase 0 — Documentation and scaffold

**Owner:** Claude Code

Tasks:

* Initialize repository
* Install compatible dependencies
* Create required documentation
* Configure strict TypeScript
* Configure linting and formatting
* Configure test framework
* Create EAS profiles
* Create environment template
* Create basic Expo Router routes
* Establish CI

Acceptance:

* App launches
* Typecheck passes
* Tests run
* Expo Doctor passes
* Documentation exists

## Phase 1 — Pure game engine

**Owner:** Claude Code

Tasks:

* Define shapes
* Define grid model
* Implement seeded random
* Implement placement
* Implement line clearing
* Implement hand generation
* Implement game-over detection
* Implement scoring
* Implement unit tests

Acceptance:

* Full classic block game works through tests
* No UI dependency inside domain
* Identical seeds produce identical sequences

## Phase 2 — BlastDown rules

**Owner:** Claude Code

Tasks:

* Timed piece instances
* Turn resolution
* Defuse detection
* Timer warning events
* Explosion logic
* Rubble
* Freeze
* Defuse
* Revive
* Balance configuration
* Edge-case tests

Acceptance:

* All specified resolution rules pass
* Multiple expirations are deterministic
* New pieces do not lose a turn immediately
* A piece at one can be saved by the current move

## Phase 3 — First playable UI

**Owner:** Codex
**Reviewer:** Claude Code

Allowed files:

* `app/`
* `src/components/`
* UI-specific hooks
* Component tests

Tasks:

* Home screen
* Game screen
* Board
* Piece tray
* Tap placement
* Placement preview
* HUD
* Game-over display

Acceptance:

* Complete run playable on Android
* No domain logic duplicated in UI
* Small-screen layout works

## Phase 4 — Game feel

**Owner:** Codex
**Reviewer:** Claude Code

Tasks:

* Drag interaction
* Timer visual states
* Warning pulse
* Line-clear effect
* Defuse effect
* Explosion effect
* Screen shake
* Haptics
* Audio
* Reduced-motion support

Acceptance:

* Effects remain responsive
* No continuous expensive animations
* Gameplay remains understandable without sound

## Phase 5 — Persistence and progression

**Owner:** Claude Code for storage logic
**Owner:** Codex for screens

Tasks:

* Active run persistence
* Best score
* Bolts
* Themes
* Settings
* Tutorial completion
* Schema migration
* Themes interface

Acceptance:

* Force-closing and reopening restores active game
* Purchased themes persist
* Settings persist
* No timer changes while closed

## Phase 6 — Mock monetization

**Owner:** Claude Code for contracts and rules
**Owner:** Codex for presentation

Tasks:

* Mock ad service
* Rewarded revive UI
* Freeze UI
* Defuse UI
* Double-reward UI
* Frequency-cap tests
* Failure-state UI

Acceptance:

* Every reward works without a real ad SDK
* Reward cannot be granted twice accidentally
* Game state is preserved before the mock ad

## Phase 7 — Real advertisements and consent

**Owner:** Claude Code

Tasks:

* Add native ad integration
* Configure app IDs
* Add test IDs
* Add consent flow
* Add preload strategy
* Add timeout/error handling
* Create development build
* Validate EEA/non-personalized path
* Validate offline fallback

Codex may assist only with presentation components.

Acceptance:

* Test rewarded ads grant exactly one reward
* Closed ads do not grant rewards
* Failed ads do not corrupt state
* Interstitial caps work
* Development and production configurations are separated

## Phase 8 — Analytics and crash reporting

**Owner:** Claude Code

Tasks:

* Implement analytics adapter
* Implement production provider
* Implement run-summary events
* Implement ad-funnel events
* Add crash reporting
* Verify privacy configuration

Acceptance:

* Events contain no unnecessary personal data
* Analytics failure never breaks gameplay
* Run summaries are recorded correctly

## Phase 9 — QA and release

**Owner:** Claude Code
**Codex role:** UI bug fixes and performance tasks

Tasks:

* Full regression
* Device testing
* Store assets
* Privacy policy
* Data Safety information
* Production AAB
* Closed testing track
* Crash monitoring
* Balance validation

---

# 26. Prototype Validation Gate

Before integrating real advertisements, test the mechanic with at least five external players.

Collect:

* Time to understand the timer
* First-run duration
* First explosion time
* Number of explosions
* Immediate restart behavior
* Freeze-button interest
* Defuse-button interest
* Whether failure felt fair
* Whether timers felt exciting or stressful

Proceed to production monetization only if most testers:

* Understand the timer without lengthy explanation
* Recognize which piece is in danger
* Believe they could have prevented the explosion
* Voluntarily replay
* Express interest in at least one mock rewarded action

If players ignore the timer or find it unfair, adjust:

1. Timer visibility
2. Starting countdown
3. Explosion severity
4. Tutorial
5. Piece distribution

Do not respond by adding unrelated progression systems.

---

# 27. Definition of Done

The Android MVP is complete when:

* The game installs through an EAS production or preview build
* Tutorial works
* Player can complete full runs
* Timer behavior matches this specification
* Explosions are deterministic
* Rubble is recoverable
* Scoring works
* Best score persists
* Active runs resume correctly
* Rewarded revive works
* Rewarded freeze works
* Rewarded defuse works
* Double Bolts works
* Interstitial caps work
* Consent flow works
* Offline gameplay works
* Ads failing do not break gameplay
* Themes persist
* Sound and haptic settings persist
* Typecheck passes
* Lint passes
* Tests pass
* Expo Doctor passes
* No known critical crash remains
* No production secret or invalid test ID is committed
* Store release checklist is complete

---

# 28. Claude Code Bootstrap Prompt

Give Claude Code the following instruction after saving this file:

```text
You are the lead engineer and repository orchestrator for BlastDown.

Read BUILD_SPEC.md completely before making any changes.

Your first task is Phase 0 only:

1. Inspect the current repository.
2. Create or update CLAUDE.md and AGENTS.md.
3. Create the required docs directory and derive the smaller supporting documents described in BUILD_SPEC.md.
4. Create docs/TASKS.md with every phase broken into numbered, checkable tasks.
5. Initialize or correct the Expo TypeScript project using the latest stable Expo SDK.
6. Configure Expo Router, strict TypeScript, ESLint, Prettier, Jest, React Native Testing Library, Expo Dev Client, and EAS profiles.
7. Create the proposed folder structure without implementing gameplay beyond a basic launchable home screen.
8. Add .env.example and environment validation.
9. Add package scripts for typecheck, lint, tests, coverage, formatting, and Expo Doctor.
10. Run all verification commands.

You are responsible for architecture, domain rules, integration, and final review.

Use the installed Codex plugin only for bounded tasks. Do not ask Codex to build the entire game. Do not allow Codex to change domain contracts or architecture without your approval.

Before delegating any Codex task, provide:
- Task ID
- Objective
- Documents to read
- Allowed files
- Forbidden files
- Acceptance criteria
- Required commands

Do not begin Phase 1 until Phase 0 passes and docs/TASKS.md has been updated.

At the end, report:
- Files created or modified
- Dependencies installed
- Commands executed
- Results
- Risks or unresolved issues
- Exact next task
```

---

# 29. Codex Task Prompt Template

Claude Code must use a structure similar to this for every Codex delegation:

```text
TASK ID: UI-001

OBJECTIVE:
Implement the first playable game-screen layout using the existing domain interfaces.

READ FIRST:
- BUILD_SPEC.md
- AGENTS.md
- docs/ARCHITECTURE.md
- docs/GAME_RULES.md
- docs/STYLE_GUIDE.md
- docs/TASKS.md

ALLOWED FILES:
- app/game.tsx
- src/components/GameBoard/**
- src/components/GridCell/**
- src/components/PieceTray/**
- src/components/ScoreHeader/**
- __tests__/components/**

FORBIDDEN FILES:
- src/domain/**
- src/config/balance.ts
- src/services/**
- BUILD_SPEC.md
- CLAUDE.md
- AGENTS.md
- docs/ARCHITECTURE.md
- docs/GAME_RULES.md
- package.json unless explicitly authorized

REQUIREMENTS:
- Render the existing 8×8 state.
- Render three hand pieces.
- Support tap-to-select and tap-to-place.
- Show valid and invalid placement previews.
- Use existing selectors and controller methods.
- Do not duplicate placement or clearing rules.
- Support small Android widths.
- Add accessibility labels and test IDs.
- Add component tests.

ACCEPTANCE CRITERIA:
- A player can complete a run through the UI.
- Invalid placements cannot mutate state.
- UI contains no gameplay-rule calculations.
- TypeScript has no errors.
- Relevant tests pass.
- No unapproved dependency is added.

RUN:
- npm run typecheck
- npm run lint
- npm run test -- GameBoard

RETURN:
1. Summary
2. Files changed
3. Tests added
4. Commands run and exact results
5. Known limitations
6. Any requested domain change, without implementing it
```

---

# 30. Final Engineering Instruction

The team must resist the temptation to turn BlastDown into a large game before validating the timer.

The product advantage is:

> A familiar block puzzle with visible, preventable, escalating explosions.

Every implementation decision should make that mechanic:

* Easier to understand
* More satisfying to control
* More dramatic to watch
* Fairer when the player fails
* More valuable when a rewarded recovery is offered

Nothing else should be allowed to distract from that objective before launch.
