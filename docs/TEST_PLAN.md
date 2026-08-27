# Test Plan

Governed by the current product-document hierarchy in `AGENTS.md`. No task is
complete until its applicable commands pass. Codex owns implementation,
integration, and verification across all test layers.

## Required verification commands

```bash
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run format:check
npx expo-doctor
```

## Unit tests (`__tests__/domain/`)

Required coverage once the domain engine exists (Phase 1–2):

- Valid placement, out-of-bounds placement, overlap prevention
- Row clearing, column clearing, simultaneous row+column clearing
- Rubble clearing
- Timer assignment; new piece not decrementing immediately; existing timer
  decrement
- Freeze behavior
- Partial piece clear; full piece defuse; saving a timer at one
- Single explosion; multiple simultaneous explosions; adjacent-rubble cap;
  deterministic explosion cells
- Defuse power-up; dormant legacy recovery helpers where retained
- Hand refill
- Seeded sequence reproducibility
- Game-over detection
- Score calculation; combo reset
- Persistence migration

## Component tests (`__tests__/components/`)

Required areas: piece selection, placement preview, invalid-placement
feedback, timer-badge state, rewarded-action loading state, canonical game-over
state, results screen, settings persistence, and absence of excluded V1 UI.

Phase 0 seeds this layer with `__tests__/components/HomeScreen.test.tsx`,
which renders the real home screen and asserts the logo and Play affordance
exist. Note for RNTL v14+: `render()` is `async` — always `await render(...)`
before using the returned queries.

## Integration tests (`__tests__/integration/`)

Required scenarios: complete a normal row; defuse a timer at one; allow a
timer to explode; clear rubble after an explosion; freeze timers for two
placements; defuse the lowest timer; reach game over; resume a saved run;
finalize to Results; restart without stale state; preserve deprecated stored
fields without exposing legacy routes or monetization.

## Manual device matrix (pre-release)

Small Android screen; medium Android screen; low-memory Android device or
emulator; current Android version; one older supported Android version;
offline mode; slow network; ad unavailable; ad closed; ad error; app
backgrounded during an ad; app backgrounded during a run.

## Phase 0 status

- `npm run test` currently runs one passing component test
  (`HomeScreen.test.tsx`) that exercises the Jest + `jest-expo` +
  React Native Testing Library pipeline end to end.
- `__tests__/domain/` and `__tests__/integration/` are scaffolded empty
  (tracked via `.gitkeep`) and will be populated starting Phase 1, alongside
  the domain engine they test.
