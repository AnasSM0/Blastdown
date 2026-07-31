# BlastDown — project briefing

A complete orientation for someone (or some agent) picking this repository up
cold, with the intent of researching and expanding the game.

Read this first, then `BUILD_SPEC.md` (2,220 lines) for anything it does not
cover. **`BUILD_SPEC.md` is the authority.** Where this briefing and the spec
disagree, the spec wins and this file is wrong.

---

## 1. What the game is

BlastDown is a **single-player, offline, ad-supported mobile puzzle game** for
Android (iOS is scaffolded but not a target yet).

The core loop, in one sentence: **you drop tetromino-like pieces onto an 8×8
grid to complete rows and columns, but every piece you place is on a countdown,
and when a countdown reaches zero the piece detonates and leaves rubble that
permanently blocks the board until you clear it.**

That timer is the whole design. It turns a familiar block-fitting game
(Blockudoku, 1010!) into something with escalating pressure and a genuine
decision every turn: do you clear the line you want, or the line that saves the
piece about to explode?

### The moment-to-moment loop

1. You hold **three pieces**. Place them in any order.
2. Placing a piece scores 1 point per cell, and starts that piece's countdown.
3. Completing a row or column clears it — 100 points per line, multiplied for
   simultaneous lines and for consecutive clearing turns.
4. Every existing timed piece counts down by one after each placement.
5. Clear **every cell** of a timed piece and it is **defused** — you get a bonus
   scaled to how close it was to detonating. This is the game's best play.
6. Let one hit zero and it **explodes**: its cells become rubble, plus up to four
   adjacent empty cells. You lose 50 points and your combo.
7. Rubble blocks placement and can only be removed by completing its line.
8. The run ends when none of your three pieces fit anywhere.

### Why it works

The timer inverts the usual incentive. In an ordinary block puzzle you place
pieces wherever they fit. Here, a piece placed carelessly becomes a bomb in a bad
position, and the board degrades irreversibly through rubble. Skilled play is
about **defusing rather than clearing** — reading which piece is closest to
death and building the line that saves it.

The difficulty curve is not enemy scaling; it is the countdown getting shorter as
the run progresses (7 moves early, 4 moves after turn 76) while the board fills
with rubble you have to work around.

---

## 2. Current status

|                    |                                                                |
| ------------------ | -------------------------------------------------------------- |
| Platform           | Android (Expo development builds, EAS)                         |
| Phases 0–6A        | complete, merged to `master`, tagged                           |
| Phase 6B           | production ads + UMP consent — **implemented, unmerged**       |
| Cinematic renderer | Skia board renderer — **implemented, unmerged, behind a flag** |
| Test suite         | ~103 suites / ~704 tests, ~87% statement coverage              |
| Store release      | **not yet** — no production ad credentials, no Play listing    |

### Live branches

- **`master`** — everything through Phase 3 UI event effects. Tagged
  `v0.9-ui-event-effects`. This is what actually works and is proven on a phone.
- **`phase-6b-production-ads-consent`** — Google Mobile Ads + UMP consent.
  A rewarded test ad has been confirmed working on device. Consent QA is blocked
  on a published AdMob GDPR message.
- **`feature-cinematic-board-renderer`** — a second board renderer that draws
  into one Skia canvas.
- **`fix-cinematic-renderer-performance`** — performance work on that renderer.
  Current tip.

**Nothing on the last three has passed full device QA.** See section 12.

---

## 3. Tech stack

```
Expo SDK 57  ·  React Native 0.86  ·  React 19.2  ·  TypeScript 6
New Architecture (Fabric) — SDK 57 is New-Arch only
expo-router (file-based routing)
react-native-reanimated 4.5 + react-native-worklets 0.10
react-native-gesture-handler 2.32
@shopify/react-native-skia 2.6.2   (cinematic renderer only)
react-native-google-mobile-ads 16.3.4  (pinned — see below)
Jest 29 + @testing-library/react-native 14
```

**The ad SDK pin matters.** `16.4.0` pulls `play-services-ads` 25.4.0, whose
Kotlin metadata is 2.3.0, and Expo SDK 57 compiles with Kotlin 2.1.20. A compiler
cannot read metadata newer than itself, so the native build fails outright at
`:react-native-google-mobile-ads:compileDebugKotlin`. Pin exactly; no caret.

**Two animation systems coexist deliberately.** The original UI uses React
Native `Animated` throughout. Reanimated exists only because the Skia renderer
needs it. Do not "unify" these without reading `docs/DECISIONS.md` — the
single-animation-system decision (2026-07-20) was deliberate.

---

## 4. Architecture

The single most important structural rule:

> **`src/domain/` is pure.** No AsyncStorage, no animation, no ad SDK, no audio,
> no navigation, no `Date.now()` leaking into logic. It is a deterministic state
> machine that takes a state plus an action and returns a new state plus events.

Everything else is a consumer of that.

```
app/                    expo-router screens (index, game, results, settings,
                        themes, tutorial, _layout)

src/domain/             THE ENGINE. Pure, deterministic, fully unit-tested.
  gameTypes.ts          GameState, GridCell, HandPiece, ActiveTimedPiece
  game.ts               the reducer — the only thing that mutates a run
  board.ts              grid construction and cell queries
  shapes.ts             the 12-shape catalogue (relative coords, never images)
  placement.ts          validity rules
  lineClearing.ts       row/column detection and clearing
  timers.ts             countdown decrement, freeze, defuse
  explosions.ts         expiry → rubble, adjacency, caps
  scoring.ts            points, multipliers, combo
  gameOver.ts           "can any hand piece fit anywhere"
  handGeneration.ts     weighted bag, seeded
  seededRandom.ts       the PRNG — determinism lives here
  selectors.ts          read-only derived views for the UI
  events.ts             the event union the reducer emits

src/config/balance.ts   EVERY tunable number. Nothing is hardcoded elsewhere.
src/economy/            theme catalogue and ownership (Bolts currency)
src/services/           ads · analytics · audio · consent · storage · profile
src/state/              React providers: GameSession, Profile, Settings
src/hooks/              controller, persistence, audio, haptics, rewards,
                        event animation, reduced motion
src/ui/                 theme tokens, 5 palettes, geometry, effect planning
src/components/         all presentational components
src/rendering/cinematic/ the Skia renderer (flagged off)
```

### The seams

Every platform capability is behind an interface the domain never sees:

- `AdService` — rewarded ads. Mock, Google, and "SDK unavailable" implementations.
- `AnalyticsService` — fire-and-forget, must never throw, never blocks gameplay.
- `StorageService` — AsyncStorage wrapper plus an in-memory one for tests.
- `ConsentPort` — UMP. Mock and real.
- `AudioService`, haptics — same pattern.

This is why the whole game is testable without a device: every seam has a
memory implementation, and the domain has no seams at all.

### Turn resolution order — do not reorder casually

Seventeen steps, documented in `docs/ARCHITECTURE.md`. The load-bearing part is
steps 3–9:

```
3. detect completed lines
4. clear them
5. find timed pieces with no cells left
6. award defuse bonuses
7. decrement timers of pieces that existed BEFORE this placement
8. do NOT decrement the piece just placed
9. if freeze is active, skip the decrement and consume a freeze charge
```

**This is what lets a player save a piece showing `1` by clearing it on the
current turn.** Reordering breaks the game's central skill expression. Both
`docs/ARCHITECTURE.md` and `docs/GAME_RULES.md` must be updated together if it
ever changes.

---

## 5. Game rules in full

### Board

8×8. Each cell is `empty`, `timed` block, `normal` (untimed) block, or `rubble`.
Untimed blocks exist **only** as the result of a power-up defuse.

### Pieces

Three in hand, placeable in any order, new hand of three when all are used.
**No rotation** in the MVP. Twelve shapes: single; 2/3/4-cell horizontal and
vertical lines; 2×2 square; small L; mirrored small L; large L; T.

Generation is a **seeded weighted bag** — 40% small, 40% medium, 20% large. Every
run records its seed, so any run is exactly reproducible. The generator never
inspects the board to pick punishing pieces (an explicit anti-frustration rule).

### Placement

Valid when every cell is in bounds, empty, not rubble, and the piece is unused.
Drag with a translucent preview, release to place. **Tap-to-select then tap-to-
place is a first-class accessibility path**, not a fallback afterthought.

### Timers

Every placed piece becomes one timed instance: all its cells share an ID, a
remaining-turn count, and a colour. Partial clears keep the timer running on
survivors. The countdown renders on the top-left surviving cell as a floating
circular badge.

Starting countdown by run turn: **1–15 → 7 · 16–40 → 6 · 41–75 → 5 · 76+ → 4**.

Display states: 7–5 normal · 4–3 caution · 2 warning pulse · 1 urgent pulse plus
stronger haptic · 0 explosion. **The number is always shown** — never colour alone.

### Explosions

Remove the timer, convert surviving cells to rubble, convert up to 4 adjacent
empty cells to rubble (seeded, deterministic), cap 6 total per turn across
simultaneous expiries, no recursive explosions, no automatic line clear from new
rubble. An explosion never ends the run by itself.

### Scoring

- Placement: 1/cell
- Line clear: 100/line
- Multi-line: 1 → ×1, 2 → ×1.5, 3 → ×2, 4+ → ×3
- Combo: `1 + 0.25 × streak`, capped ×3. A no-clear placement resets it.
- Defuse bonus: `25 + 10 × remaining`
- Explosion: −50 and combo reset, floor 0

### Power-ups (all rewarded-ad gated)

- **Freeze** — timers pause for the next two successful placements. Max 2/run.
- **Defuse** — permanently defuse the piece with the lowest timer; its cells
  become normal untimed blocks. Max 2/run.
- **Revive** — on game over: clear all rubble, +2 moves to every timer (cap 9),
  fresh hand of small/medium pieces, combo reset, score kept. Once per run.
- **Double Bolts** — at results, double the run's currency.

### Currency and themes

`Bolts = floor(score / 250) + pieces defused`, earned at run end. Spent on five
themes: Reactor (free), Arctic 500, Magma 500, Void 750, Solar 750. Themes change
colours only — **never gameplay**.

### Tutorial

Six scripted steps on a fixed seed and fixed hands. No ads. Replayable from
Settings. Skippable after the first placement.

---

## 6. Data model and persistence

Three AsyncStorage keys, all namespaced and versioned:

```
blastdown/active-run/v1    the in-progress run (resume after a kill)
blastdown/profile/v1       best score, Bolts, owned themes, lifetime stats
blastdown/settings/v1      sound, music, haptics, reduced motion, theme
```

Each is wrapped in an envelope carrying its own schema version, bumped
independently of `GAME_STATE_VERSION`. **Migrations are mandatory** — a player
mid-run when they update must not lose the run.

`GameState` carries the seed and RNG state, so persistence is exact: reloading a
run reproduces the identical piece sequence.

---

## 7. Rendering — there are two renderers

This is the least obvious thing in the codebase.

**The React Native renderer** (`GameBoard` + 64 `GridCell`s) is the default and
the only one proven on hardware. It uses RN `Animated`, native-driven.

**The cinematic renderer** (`src/rendering/cinematic/`) draws the whole board
into a single Skia canvas — frame, grid, blocks, rubble, previews, timer numerals
and effects. It exists because 64 animated views is a lot of native work, and
because both Android rendering bugs this project has hit are properties of
_native views carrying animated style props_, which a canvas does not have.

Selected by `EXPO_PUBLIC_CINEMATIC_BOARD` — **default off**, compile-time
inlined, so it must be set at build time.

Both accept identical props and expose an identical accessibility tree. The
canvas has 64 transparent `Pressable`s layered over it, because a canvas is one
view to the platform and would otherwise delete every per-cell label and the
tap-to-place path.

### Two Android traps worth knowing before touching rendering

1. **The black-render trap.** A rounded, elevated/clipped RN view carrying a
   transform gets promoted to its own hardware layer and renders black. This is
   why nine components _omit_ their transform under reduced motion instead of
   animating to identity.
2. **The RN 0.86 Fabric assertion.** RN re-applies the native animation driver's
   `transform` over each React commit for views the driver has touched, and
   asserts the committed type. **Removing** a transform from such a view crashes
   the app. `src/ui/motionKey.ts` and the guard suite exist for this.

Both are fixed. Do not undo the guards.

---

## 8. Monetization

Rewarded only. **No banners during gameplay, ever.** Four rewarded placements
(freeze, defuse, revive, double bolts) and one interstitial with a long list of
conditions (≥2 lifetime runs, run ≥60s, ≥120s since the last one, no rewarded ad
in the previous 45s, never before a revive decision, never two ads back to back).

Session caps: 1 revive, 2 freezes, 2 defuses, 1 double-reward per run; 3
interstitials per 20-minute session. All configurable, never hardcoded.

The reward contract is strict: **a promised reward is never silently dropped**,
and a reward is granted only from the SDK's earned-reward event, applied exactly
once, with concurrent presentations blocked.

---

## 9. Accessibility

Treated as shipped behaviour, not a nice-to-have:

- Every board cell has a spoken label including colour, timer count, and frozen
  or urgent state.
- Placement hints on empty cells mirror the engine's own verdict — they promise a
  placement only where the engine would accept one.
- Tap-to-place is a real path, not a degraded one.
- Reduced motion is honoured everywhere and **removes movement, never meaning**:
  a cleared line still flashes, expired rubble is still drawn.
- State is never signalled by colour alone — invalid previews are dashed, frozen
  badges are dashed, urgent badges are larger.

`docs/ACCESSIBILITY.md` has the full record, including an accepted constraint:
8×8 cells on a phone cannot meet the 44px touch floor, so that floor is upheld
for every _discrete control_ instead.

---

## 10. Testing

~704 tests. The strategy is shaped by having **no Android device on the build
machine**:

- **Domain**: exhaustive and pure. Determinism, scoring, explosions, game-over.
- **Component**: rendering, accessibility, reduced motion.
- **Integration**: full screens with memory service implementations.
- **Structural guards**: tests that read source files to pin invariants that are
  invisible at runtime — the Fabric transform keys, Skia never imported outside
  its two directories, no per-cell blur.

Jest runs with `randomize: true` so no test can come to depend on ordering.

### Repeated lessons, recorded because they recurred

- Dynamic `import()` fails under this jest config. Use static imports.
- `renderHook`/`render`/`fireEvent` are **async** in RNTL 14.
- Never `jest.spyOn(Animated, "timing")` — it corrupts the RN preset.
- A test that matches source _patterns_ will agree with whatever the source says.
  It cannot verify behaviour. This caused three consecutive false "fixes" in the
  Skia renderer.

---

## 11. House rules

From `CLAUDE.md` and `AGENTS.md`:

- `BUILD_SPEC.md` wins over any generated code or suggestion.
- Domain purity is absolute.
- No hardcoded balance values outside `src/config/balance.ts`.
- Seeded determinism must hold.
- **Offline gameplay must never break.** Ads may be unavailable; nothing else
  may fail because of it.
- No features outside the spec — record any approved deviation in
  `docs/DECISIONS.md`.
- Full verification before any commit: `typecheck`, `lint`, `test`,
  `format:check`, `expo-doctor`.

---

## 12. What is unfinished, and what is blocked

**Blocked on the owner:**

- Production AdMob app ID and rewarded unit IDs
- A **published** AdMob GDPR consent message (without it, UMP reports "not
  required" and no consent form can appear however correct the code is)
- Public privacy-policy URL
- Audience classification (general / mixed / child-directed) — this gates the
  _native build_, not just a runtime flag
- Play Console access and Data Safety declarations

**Unverified:**

- All Phase 6B consent and per-placement reward QA
- The entire cinematic renderer visually — no frame time has ever been measured,
  and its canvas layers sit at ~2% test coverage because they never execute under
  jest

**Known open:** the cinematic renderer was reported laggy on device; a
performance pass is done but unmeasured.

---

## 13. Where the room to expand actually is

An honest read, separating what the spec already sanctions from what would be
new design.

### Already in the spec, not built

- **Interstitials** — fully specified, not implemented.
- **"Repair latest blast"** — a feature-flagged power-up that removes only the
  most recent explosion's rubble. Spec says post-MVP, gated on whether revive
  opportunities prove too rare.
- **iOS** — scaffolded, never targeted.

### Genuine design headroom

- **Piece rotation.** Explicitly excluded from the MVP. Adding it is the single
  largest change to the skill ceiling available, and it touches placement,
  preview, drag, and the shape catalogue.
- **Daily challenge / seeded runs.** The engine already records and reproduces
  seeds exactly. A shared daily seed is nearly free architecturally and is the
  most natural retention feature this design supports.
- **Objectives or missions.** The analytics event schema already emits everything
  a mission system would need (lines cleared, defuses, explosions survived).
- **Difficulty modes.** Every balance value is centralised, so alternate tiers
  are configuration rather than code.
- **Board sizes beyond 8×8.** The renderer computes geometry from measured width
  and takes `size` as a parameter, so this is less hardcoded than it looks — but
  `BOARD_SIZE` is a domain constant and line-clear/explosion rules assume the
  square grid.

### Where I would be careful

- **The timer is the game.** Changes that soften it (longer countdowns, forgiving
  rubble) remove the reason this is not just another block puzzle.
- **Rubble permanence is the pressure.** It is the only irreversible state.
- **The anti-frustration rules are load-bearing**: the generator never inspects
  the board, explosions never cascade, and a run never ends from an explosion
  alone. These exist so losses feel earned.

### Research worth doing

- How Blockudoku, Woodoku and 1010! handle difficulty ramp and retention, and
  what BlastDown's timer changes about those answers.
- Rewarded-ad placement conventions in the puzzle genre — the current four
  placements are conservative.
- Whether the defuse mechanic reads clearly to new players. It is the deepest
  part of the design and the tutorial covers it in one scripted step.

---

## 14. Working in this repo

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # jest, randomized order
npm run test:coverage
npm run format:check   # prettier
npx expo-doctor

npx expo export --platform android          # bundle check, no native build
eas build --profile development --platform android
EXPO_PUBLIC_CINEMATIC_BOARD=1 eas build ... # cinematic renderer build
```

### The cinematic renderer flag

`EXPO_PUBLIC_CINEMATIC_BOARD` accepts exactly `1`, `true` or `skia`. Anything
else — unset, empty, misspelled, or merely mis-cased like `SKIA` — keeps the
device-tested React Native renderer. The match is exact on purpose: it is the
expression Metro folds, and case normalisation would make it unfoldable.

With the flag off the cinematic renderer is **not in the bundle at all** — not
`CinematicBoard`, not the canvas layers, not `@shopify/react-native-skia`. The
Android bundle is 3.839 MB off against 4.422 MB on. Verify a claim like that by
grepping the exported `.hbc`, never by reading the gate:

```bash
npx expo export --platform android --output-dir /tmp/off
grep -c CinematicBoardCanvas /tmp/off/_expo/static/js/android/*.hbc
```

Three bugs on this branch were "correct at runtime, wrong in the bundle", and all
three read as correct in review. `docs/DECISIONS.md` has the shapes that fail.

### Testing effects on a phone

Development builds carry an effect delivery harness at `/dev-effects`, reachable
from Settings → **EFFECT HARNESS (DEV)**. Thirteen fixed scenarios drive the
real event pipeline, and a diagnostics overlay shows queue depth, accepted,
started, completed, evicted and dropped counts, the leased cinematic clock slot
per effect, the session generation, and enqueue-to-first-draw latency.

It is absent outside a development build — not disabled. The procedure and how
to read the overlay are in `docs/CINEMATIC_PERFORMANCE.md`.

### Read these in this order

1. `BUILD_SPEC.md` — the authority
2. `docs/GAME_RULES.md` — the gameplay contract
3. `docs/ARCHITECTURE.md` — layering and the 17-step turn order
4. `docs/DECISIONS.md` — every deviation and why (1,647 lines, worth skimming
   for the Android traps and the animation-system decision)
5. `docs/TASKS.md` — phase-by-phase state
6. `src/config/balance.ts` — every number in one file

### The most useful mental model

The domain is a pure function. The UI is a projection of it. Services are
swappable seams. If a change makes any of those three less true, it is probably
the wrong change.
