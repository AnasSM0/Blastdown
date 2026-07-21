# Tasks

Numbered, checkable tasks per phase, derived from `BUILD_SPEC.md` section 25.
Each phase's acceptance criteria must pass before the next phase starts.
"Owner" is who implements; Claude Code reviews and integrates everything
regardless of owner (see `CLAUDE.md`).

Checkbox convention: `[ ]` pending, `[x]` done, `[~]` in progress.

---

## Phase 0 — Documentation and scaffold

**Owner: Claude Code**

- [x] 0.1 Initialize git repository
- [x] 0.2 Rename/confirm `BUILD_SPEC.md` at repo root
- [x] 0.3 Scaffold Expo TypeScript project (`blank-typescript` template)
- [x] 0.4 Install required dependencies (§12.1 of `BUILD_SPEC.md`)
- [x] 0.5 Configure Expo Router; build `app/` route stubs
- [x] 0.6 Scaffold `src/` and `__tests__/` folder structure
- [x] 0.7 Configure strict TypeScript
- [x] 0.8 Configure ESLint + Prettier
- [x] 0.9 Configure Jest + `jest-expo` + React Native Testing Library
- [x] 0.10 Add EAS profiles (`eas.json`), `.env.example`, `app.config.ts`
      with environment validation
- [x] 0.11 Build a basic launchable home screen
- [x] 0.12 Write `CLAUDE.md`, `AGENTS.md`, and the Phase-0 `docs/` set
- [x] 0.13 Run all verification commands and confirm they pass
- [x] 0.14 Report Phase 0 results and stop for review

**Acceptance:** app launches, typecheck passes, tests run, Expo Doctor
passes, documentation exists.

---

## Phase 1 — Pure game engine

**Owner: Claude Code**

- [x] 1.1 Define `GameState`/`GridCell`/`ActiveTimedPiece`/`HandPiece` types
      in `src/domain/gameTypes.ts` (per `BUILD_SPEC.md` §14)
- [x] 1.2 Define the 12-shape catalog in `src/domain/shapes.ts`
- [x] 1.3 Implement seeded PRNG in `src/domain/seededRandom.ts`
- [x] 1.4 Implement placement validation/application in
      `src/domain/placement.ts`
- [x] 1.5 Implement line detection/clearing in `src/domain/lineClearing.ts`
- [x] 1.6 Implement weighted-bag hand generation
- [x] 1.7 Implement game-over detection in `src/domain/gameOver.ts`
- [x] 1.8 Implement base scoring in `src/domain/scoring.ts`
- [x] 1.9 Unit tests for all of the above in `__tests__/domain/`

**Acceptance:** a classic block-placement game (no timers yet) works fully
through tests; no UI dependency inside `src/domain/`; identical seeds
produce identical sequences.

---

## Phase 2 — BlastDown rules

**Owner: Claude Code**

- [x] 2.1 Timed piece instances + central balance config
      (`src/config/balance.ts`)
- [x] 2.2 Turn-resolution order (the 17 steps in `docs/ARCHITECTURE.md`)
      — classic + timed/defuse steps done; explosion steps (10–11) land
      with 2.5, freeze step (9) with 2.7
- [x] 2.3 Defuse detection + defuse bonus scoring
- [x] 2.4 Timer warning events (caution/warning/urgent thresholds)
- [x] 2.5 Explosion logic incl. deterministic adjacent-rubble selection and
      the 6-cell simultaneous-explosion cap
- [x] 2.6 Rubble placement/clearing rules
- [x] 2.7 Freeze power-up
- [x] 2.8 Defuse power-up
- [x] 2.9 Revive power-up
- [x] 2.10 Edge-case tests: saving a `1`-timer piece, multiple simultaneous
      expirations, freeze/defuse/revive interactions

**Acceptance:** all specified resolution rules pass; multiple expirations
are deterministic; new pieces don't lose a turn immediately; a piece at `1`
can be saved by the current move.

---

## Phase 3 — First playable UI

**Owner: Codex** · **Reviewer: Claude Code**

Use the Codex task-prompt template in `BUILD_SPEC.md` section 29 for every
sub-task below. Example allowed files: `app/game.tsx`,
`src/components/GameBoard/**`, `src/components/GridCell/**`,
`src/components/PieceTray/**`, `src/components/ScoreHeader/**`,
`__tests__/components/**`. Forbidden: `src/domain/**`,
`src/config/balance.ts`, `src/services/**`, and all Claude-owned files
listed in `CLAUDE.md`.

- [x] 3.1 Home screen ("Neon Reactor Minimal") wired into the real game flow
      via `GameSessionProvider` (Play starts a fresh run, Continue resumes an
      in-memory run, exit returns Home). Best score / Bolts remain documented
      `0` stubs until Phase 5 storage — see the 2026-07-20 Decisions entry.
- [x] 3.2 Game screen layout (score header, board, piece tray)
- [x] 3.3 Board + grid cell rendering from domain state
- [x] 3.4 Piece tray rendering
- [x] 3.5 Tap-to-select / tap-to-place interaction
- [x] 3.6 Placement preview (valid/invalid)
- [x] 3.7 Game-over display (restart-only overlay superseded by the Phase 3D
      revive/end-run flow below; §10.4 revive decision now landed)
- [x] 3.8 Component tests for the above

### Phase 3D — Run lifecycle (freeze, defuse, revive, pause, results)

Implemented directly by Claude Code (single-writer; a Codex agent was active
on the effects files this session — see the 2026-07-20 Decisions entry). The
mock rewarded-ad seam and the full in-run/end-run lifecycle now work end to
end. Fulfills the Codex task specs **UI-004** (pause / game-over / revive /
second-chance) and **UI-005** (results), plus the power-up-wiring half of
**UI-007** (freeze/defuse states driven by the domain).

- [x] 3D.1 AdService seam + configurable MockAdService + AdServiceProvider;
      `useRewardedAction` single-flight hook (earn-only callback, input lock).
- [x] 3D.2 Freeze wired to `activateFreeze` — active state + remaining count,
      no re-activation while active/exhausted, mutate only on earn.
- [x] 3D.3 Defuse wired to `applyRewardedDefuse` via a confirm card; the
      domain-selected lowest-timer piece is ringed on the board (no UI-side
      selection). Mutate only on earn.
- [x] 3D.4 Game-over overlay (RUN OVER + Repair & Continue + End Run); revive
      through `applyRevive`, once per run; cancel/failure leave state unchanged;
      transient reduced-motion-aware SECOND CHANCE banner.
- [x] 3D.5 Pause overlay (Resume/Restart/Home; sound/music/haptics documented
      placeholders); input locked while paused; Restart/Home clear pending UI.
- [x] 3D.6 Results screen from real run stats; Play Again / Home. Bolts &
      Double Bolts deferred — the domain exposes no currency yet.
- [x] 3D.7 Unit + integration tests across all of the above.

Note: 3.2–3.8 were implemented directly by Claude Code because the Codex
CLI sandbox is broken on this machine — see the 2026-07-18 entry in
`docs/DECISIONS.md`. The Codex task specs below remain valid for future
delegated work once the sandbox is repaired.

**Acceptance:** a complete run is playable on Android; no domain logic
duplicated in UI; small-screen layout works.

### Codex task specs (do not assign until Phase 1 + Phase 2 acceptance criteria pass)

Visual reference for every task below: `docs/references/ui/stitch-mcp/`,
indexed in `docs/UI_REFERENCE_MANIFEST.md`. Read
`docs/UI_REFERENCE_AUDIT.md` and `docs/DECISIONS.md`'s 2026-07-18 Stitch
entries first — several screens have known deviations from
`BUILD_SPEC.md` that must **not** be copied verbatim (repeated-per-cell
timer digits, the always-visible power-up buttons, the home screen's
"RANKS" button, the 380px board width, per-cell `backdrop-filter` blur).

---

**TASK ID: UI-001 — Home screen**

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: `11-home` (Home Screen - Neon Reactor Minimal)

READ FIRST: `BUILD_SPEC.md` §10.1, `docs/STYLE_GUIDE.md`,
`docs/UI_IMPLEMENTATION.md`, `docs/UI_REFERENCE_AUDIT.md` item 3,
`docs/DECISIONS.md` (2026-07-18 "Removed home screen's RANKS button")

ALLOWED FILES: `app/index.tsx`, `src/components/` (new home-specific
components only), `__tests__/components/**`

FORBIDDEN FILES: `src/domain/**`, `src/config/balance.ts`, `src/services/**`,
`BUILD_SPEC.md`, `CLAUDE.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`,
`docs/GAME_RULES.md`

REQUIRED DOMAIN INTERFACES: none yet (best score / Bolts come from
Phase 5's `StorageService` — stub with static placeholder values until then,
per the existing 3.1 checklist item)

REQUIREMENTS:

- Logo/wordmark, circular Play button, Best-score display, Bolts balance
  display, Settings button, Themes button, optional "How to Play" button,
  Privacy Policy link — per `BUILD_SPEC.md` §10.1.
- Do **not** include a leaderboard/"RANKS" button (see the Decisions entry).
- Do not show an advertisement on open.
- Follow `docs/STYLE_GUIDE.md` for colors/typography/spacing; approximate
  the "glass" look without `backdrop-filter`/`BlurView` per
  `docs/UI_REFERENCE_AUDIT.md` item 9.
- Respect safe-area insets via `react-native-safe-area-context`.
- Accessibility labels + test IDs on every interactive element.

ACCEPTANCE CRITERIA:

- Renders correctly on a small Android width (~360px) and the 390px
  reference width.
- No gameplay logic in the component.
- TypeScript has no errors; no unapproved dependency added.

TESTS: component test confirming Play/Settings/Themes navigate correctly
and no leaderboard element is rendered.

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test -- index`

---

**TASK ID: UI-002 — Game screen shell (board + tray + header, static)**

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: `01-selection-preview` (baseline normal state),
`16-developer-handoff` (geometry/token reference)

READ FIRST: `BUILD_SPEC.md` §10.2, §14 (data model), `docs/STYLE_GUIDE.md`,
`docs/UI_IMPLEMENTATION.md`, `docs/ARCHITECTURE.md`

ALLOWED FILES: `app/game.tsx`, `src/components/GameBoard/**`,
`src/components/GridCell/**`, `src/components/PieceTray/**`,
`src/components/ScoreHeader/**`, `src/components/ComboIndicator/**`,
`__tests__/components/**`

FORBIDDEN FILES: `src/domain/**`, `src/config/balance.ts`,
`src/services/**`, and all Claude-owned files listed in `CLAUDE.md`

REQUIRED DOMAIN INTERFACES: renders from an existing `GameState` (Phase 1/2
output) via selectors in `src/domain/selectors.ts` — do not recompute
board/placement logic in components.

REQUIREMENTS:

- 8×8 `GameBoard` rendering `GameState.grid`, cell size computed from
  available width (never hardcode 350px or 380px — see
  `docs/DECISIONS.md`'s board-width entry).
- `PieceTray` rendering exactly 3 pieces from `GameState.hand`, 64px
  bounding box per `docs/DECISIONS.md`.
- `ScoreHeader` with current score, best score, pause button, **and** a
  `ComboIndicator` (shown only when `combo > 0`) — per
  `docs/UI_REFERENCE_AUDIT.md` item 6, the combo indicator belongs in the
  header, not a floating overlay.
- `TimerBadge` per `ActiveTimedPiece`: one badge on the topmost surviving
  cell, never repeated per cell (`docs/DECISIONS.md`'s timer-badge entry).
- No interaction yet (tap/drag/placement is UI-003) — static render from a
  given `GameState` snapshot is sufficient for this task.
- No `backdrop-filter`/`BlurView` per cell (`docs/UI_REFERENCE_AUDIT.md`
  item 9) — approximate the glass look with solid fill + border + shadow.

ACCEPTANCE CRITERIA:

- Renders any valid `GameState` fixture without domain logic duplicated in
  components.
- Small-Android-width layout works.
- TypeScript has no errors.

TESTS: component tests for `GameBoard`, `PieceTray`, `ScoreHeader`,
`TimerBadge` rendering from fixture `GameState` values, including a
multi-cell timed piece to verify the badge appears exactly once.

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test -- GameBoard PieceTray ScoreHeader TimerBadge`

---

**TASK ID: UI-003 — Tap-to-select / tap-to-place + placement preview**

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: `01-selection-preview` (valid selection/preview),
`02-invalid-placement` (invalid feedback — note the overlap-marker
alignment caveat in `docs/UI_REFERENCE_AUDIT.md` item 1)

READ FIRST: `BUILD_SPEC.md` §6.5, §6.6, `docs/GAME_RULES.md`,
`docs/UI_REFERENCE_AUDIT.md` item 1

ALLOWED FILES: `src/components/GameBoard/**`, `src/components/GridCell/**`,
`src/components/PieceTray/**`, `src/hooks/useGameController.ts` (UI-facing
parts only — dispatch calls into the existing reducer, not new game rules),
`__tests__/components/**`, `__tests__/integration/**`

FORBIDDEN FILES: `src/domain/**` (validity checks are read via existing
selectors, never reimplemented here), `src/config/balance.ts`,
`src/services/**`

REQUIRED DOMAIN INTERFACES: `src/domain/placement.ts`'s validity check via
a selector; the typed reducer's placement action.

REQUIREMENTS:

- Tap a tray piece to select it; tap a valid board cell to place it
  (`BUILD_SPEC.md` §6.5 — tap ships before drag).
- Valid preview: translucent/dashed cells matching the selected piece's
  shape at the hovered/tapped location.
- Invalid feedback: highlight exactly the cells where the attempted
  placement overlaps an occupied/rubble cell (not merely an adjacent cell)
  — this corrects the ambiguity noted in the audit — plus a warning haptic.
- Light haptic on valid placement (`useHaptics`, not a direct SDK call).
- No placement validity logic recomputed in the component — call the
  existing domain selector/reducer.

ACCEPTANCE CRITERIA:

- A player can select and place every piece shape in the catalog via tap.
- Invalid placements never mutate `GameState`.
- UI contains no gameplay-rule calculations.

TESTS: component tests for select→preview→place happy path, and
select→invalid-cell→rejected path with the correct cells highlighted.

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test -- GameBoard PieceTray`

---

**TASK ID: UI-004 — Pause overlay, Game-Over/Revive, Second-Chance restoration**

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: `12-pause`, `08-game-over-revive`, `10-second-chance`

READ FIRST: `BUILD_SPEC.md` §10.3, §10.4, §6.15, `docs/UI_IMPLEMENTATION.md`
("shared `ModalOverlay`" guidance)

ALLOWED FILES: `src/components/modals/**`, `app/game.tsx` (wiring only),
`__tests__/components/**`

FORBIDDEN FILES: `src/domain/**`, `src/services/ads/**` (revive dispatches
through the existing `AdService` interface, doesn't implement it),
`src/config/balance.ts`

REQUIRED DOMAIN INTERFACES: `GameState.status` (`paused` /
`awaitingRevive`), the `AdService` interface (mocked in tests), the
reducer's revive-resolution action.

REQUIREMENTS:

- One shared `ModalOverlay` component (scrim + centered panel) reused by
  all three states — not three separately-styled overlays.
- Pause: Resume, Restart, Sound, Haptics, Home at minimum (per
  `BUILD_SPEC.md` §10.3); clarify with Claude Code whether Music/Reduced
  Motion toggles also belong here per `docs/UI_REFERENCE_AUDIT.md` item 6's
  sibling note in the manifest before adding them.
- Game-Over/Revive: final score so far, best-score status, one rewarded
  revive action, a decline/"end run" action. No interstitial shown before
  the decision (`BUILD_SPEC.md` §10.4).
- Second-Chance: plays once, immediately after a granted revive, showing
  the restoration wave per `docs/ANIMATION_SPEC.md`.

ACCEPTANCE CRITERIA:

- Pause never changes any timer (move-based timers don't run while paused).
- Revive dispatches through `AdService`, never grants a reward twice.
- Declining revive preserves game-over state exactly.

TESTS: component tests for each overlay's button wiring; integration test
for "earn revive → rubble cleared, +2 timers capped at 9, hand replaced,
combo reset" per `BUILD_SPEC.md` §6.15 (asserts on domain output, not
visuals).

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test -- modals`

---

**TASK ID: UI-005 — Final Results screen**

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: `06-results` (Final Results - Run Complete)

READ FIRST: `BUILD_SPEC.md` §10.5, `docs/UI_REFERENCE_AUDIT.md` item 4

ALLOWED FILES: `app/results.tsx`, `src/components/` (results-specific
components only), `__tests__/components/**`

FORBIDDEN FILES: `src/domain/**`, `src/config/balance.ts`,
`src/services/**`

REQUIRED DOMAIN INTERFACES: the run-summary fields already on `GameState`
(`piecesPlaced`, `linesCleared`, `piecesDefused`, `explosions`,
`rubbleCleared`, `bestCombo`, Bolts-earned computation).

REQUIREMENTS:

- Stats shown must include **Pieces Placed** (missing from the Stitch
  mockup — see the audit) in addition to final score, best score, lines
  cleared, pieces defused, explosions, Bolts earned.
- Double-Bolts rewarded option, Play Again, Home — all required by
  `BUILD_SPEC.md` §10.5.
- Double-Bolts only offered per the conditions in `BUILD_SPEC.md` §8.2
  (not revived through an unfinished ad flow, ad available, not already
  doubled) — condition check comes from existing state/service calls, not
  new logic in the component.

ACCEPTANCE CRITERIA:

- All required stats render from `GameState`, including Pieces Placed.
- Double-Bolts button disabled/hidden when its conditions aren't met.

TESTS: component test asserting every required stat row is present,
including Pieces Placed.

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test -- results`

---

**TASK ID: UI-006 — Tutorial screens** — DONE (Phase 5A, implemented directly
by Claude Code; Codex sandbox still broken). Scripted six-step first-run
tutorial over the real board with the exact BUILD_SPEC.md §9 copy; see the
2026-07-21 Decisions entry.

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: `13-tutorial-rubble`, `14-tutorial-defuse`,
`15-tutorial-countdown` (steps 3, 4, 6 have direct visual references; steps
1, 2, 5 don't — see `docs/SCREEN_STATE_MATRIX.md` gaps — use the same
visual language, adapted, for those)

READ FIRST: `BUILD_SPEC.md` §9, `docs/GAME_RULES.md` "Tutorial",
`docs/UI_IMPLEMENTATION.md`

ALLOWED FILES: `app/tutorial.tsx`, `src/components/` (tutorial-specific
only), `__tests__/components/**`

FORBIDDEN FILES: `src/domain/**`, `src/config/balance.ts`,
`src/services/**`

REQUIREMENTS:

- Use the **exact** six scripted messages from `BUILD_SPEC.md` §9, not
  Stitch's placeholder copy (`docs/UI_IMPLEMENTATION.md`'s explicit note).
- Fixed board, fixed piece sequence, no ads, no interstitial after
  completion, replayable from Settings, skippable after the first
  instructional placement.

ACCEPTANCE CRITERIA: matches all six `BUILD_SPEC.md` §9 requirements.

TESTS: component test confirming exact message text per step and the
skip-after-step-1 behavior.

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test -- tutorial`

---

## Phase 4 — Game feel

**Owner: Codex** · **Reviewer: Claude Code**

- [x] 4.1 Drag interaction (on top of the tap fallback, not replacing it)
- [x] 4.2 Timer visual states + warning pulse (warning/urgent breathing pulse,
      reduced-motion gated; the per-urgent-cycle haptic stays with 4.6/UI-009)
- [x] 4.3 Line-clear effect (cyan-white per-cell sweep + score float, driven by
      the `linesCleared` event through the effect pipeline)
- [x] 4.4 Defuse effect (badge collapse via clear, cyan success ring +
      "DEFUSED" float, coordinated with a same-turn line clear)
- [x] 4.5 Explosion effect + screen shake (neon burst over event-provided
      rubble cells, subtle board shake, penalty float; reduced motion swaps
      rubble instantly with no shake)
- [x] 4.6 Haptics wiring (via `useHaptics`, not direct SDK calls) — selection,
      valid-placement success, invalid-drop warning, and the urgent countdown-2/
      countdown-1 timer haptic (`useTimerHaptics`, once per transition). All
      gated by the persisted haptics setting (Phase 4B).
- [x] 4.7 Audio wiring (via `useAudio`/`useGameAudio`, `expo-audio`) —
      event-driven SFX (settings-gated, once per turn) + looping music with
      AppState/game-over lifecycle (Phase 4B).
- [x] 4.8 Reduced-motion support — `useReducedMotion()` gates every animation;
      Phase 4B adds `useEffectiveReducedMotion` combining the persisted override
      (null → OS, true → force, false → normal) so the Settings toggle applies.

**Acceptance:** effects stay responsive; no continuous expensive animations;
gameplay remains understandable without sound.

Note: Phase 3B (4.1, 4.2, placement/lift/return polish, 3.1 home wiring) and
Phase 3C (the event-driven effect pipeline plus 4.3–4.5) were implemented
directly by Claude Code — the Codex sandbox is still broken on this machine
(2026-07-18 Decisions entry). Effects are driven only by domain GameEvents via
a pure plan builder + `useEventAnimator` (2026-07-20 Decisions entry); motion
uses RN `Animated`, not Reanimated.

### Phase 4B — Audio, haptics, fonts, settings

Delivered 2026-07-20 (Claude Code, single-writer). Fulfils 4.6/4.7/4.8 above
plus the deferred font loading, and the audio/haptics half of **UI-009**.

- [x] 4B.1 AudioService (expo-audio) + no-op mock + provider; event-driven
      `useGameAudio` (SFX once per turn, music loop lifecycle) + `useAudio` UI
      cues; all settings-gated; 11 SFX + music, self-authored CC0.
- [x] 4B.2 Urgent countdown-2/1 timer haptics, once per transition; all haptics
      settings-gated.
- [x] 4B.3 Approved fonts (Geist + JetBrains Mono, SIL OFL) via expo-font with
      safe system fallback; STYLE_GUIDE typography applied.
- [x] 4B.4 Settings apply immediately + survive restart; reduced-motion override
      combines with OS via `useEffectiveReducedMotion`.
- [x] 4B.5 Asset licenses recorded (`assets/licenses/AUDIO_LICENSES.md`,
      `FONT_LICENSES.md`).

### Codex task specs (do not assign until Phase 3 tasks above are accepted)

**TASK ID: UI-007 — Timer badge states + power-up button states**

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: `03-critical-countdown`, `14-tutorial-defuse`,
`15-tutorial-countdown` (pulse timings), `09-freeze-active` (power-up
active/idle states)

READ FIRST: `docs/ANIMATION_SPEC.md` "Timer badge states", `docs/STYLE_GUIDE.md`
"Timer badge", `docs/DECISIONS.md` (`urgentRed` entry),
`docs/UI_REFERENCE_AUDIT.md` items 1, 2, 5

ALLOWED FILES: `src/components/TimerBadge/**`,
`src/components/RewardedActionButton/**`, `src/hooks/useReducedMotion.ts`
(new), `__tests__/components/**`

FORBIDDEN FILES: `src/domain/**`, `src/config/balance.ts`,
`src/services/**`

REQUIREMENTS:

- Five `TimerBadge` visual states (normal/caution/warning/urgent/explosion)
  per `docs/ANIMATION_SPEC.md`'s table, using Reanimated, gated by
  `useReducedMotion()`.
- `RewardedActionButton` three states (available/idle, active/charged,
  disabled/exhausted) per `docs/UI_REFERENCE_AUDIT.md` item 5 — driven by
  `GameState.freezeTurnsRemaining`/`rewardedFreezeUses`/
  `rewardedDefuseUses`/whether any `activeTimers` exist, never
  hardcoded-visible.
- A `GameState` can never legitimately show a piece at `remainingTurns: 0`
  as a stable frame (`docs/UI_REFERENCE_AUDIT.md` item 2) — if the domain
  layer ever emits that, treat it as a bug to report to Claude Code, not a
  state to render specially.

ACCEPTANCE CRITERIA:

- All 5 timer states + 3 power-up states render correctly from fixtures.
- Reduced motion replaces every pulsing/looping animation with a static
  equivalent, never removing the numeral or state distinction.

TESTS: component tests per state; a reduced-motion snapshot test.

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test -- TimerBadge RewardedActionButton`

---

**TASK ID: UI-008 — Line-clear, defuse, and explosion effects**

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: `04-defuse-animation`, `05-defuse-success` (no approved
explosion reference exists — derive from `docs/ANIMATION_SPEC.md`'s
"Explosion sequence" section, itself derived from the defuse sequence per
`docs/DECISIONS.md`)

READ FIRST: `docs/ANIMATION_SPEC.md` in full, `BUILD_SPEC.md` §6.12, §18
(performance — capped particles, no continuous expensive animation),
`docs/UI_REFERENCE_AUDIT.md` item 9 (no per-cell blur)

ALLOWED FILES: `src/components/GameBoard/**` (effect overlays only),
`src/components/modals/**` (none), new effect components under
`src/components/`, `__tests__/components/**`

FORBIDDEN FILES: `src/domain/**`, `src/config/balance.ts`,
`src/services/**`

REQUIRED DOMAIN INTERFACES: consumes `GameEvent` values (`linesCleared`,
`pieceDefused`, `explosion`, `comboChanged`) emitted by the reducer — never
recomputes which cells cleared/exploded.

REQUIREMENTS:

- Implement the 8-stage defuse sequence and the derived explosion sequence
  from `docs/ANIMATION_SPEC.md`, driven by `GameEvent`s, capped particle
  count (6–10 per piece).
- Explosion adds a single subtle screen shake (~150–250ms), skipped under
  reduced motion.
- No `BlurView`/backdrop blur per cell.
- All animations gated by `useReducedMotion()`.

ACCEPTANCE CRITERIA:

- Effects trigger correctly from `GameEvent` fixtures.
- No dropped frames on a mid-range-device performance budget for a
  multi-line, multi-explosion turn (manual profiling note acceptable if
  a device/emulator isn't available — record as a limitation).

TESTS: component tests asserting the right effect mounts per event type;
a reduced-motion test confirming animations are skipped/simplified.

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test -- effects`

---

**TASK ID: UI-009 — Haptics and audio wiring**

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: none directly (haptics/audio have no web equivalent) —
trigger points come from `BUILD_SPEC.md` §6.5, §6.11, §20.3 and the
`GameEvent` list

READ FIRST: `BUILD_SPEC.md` §20.3, `docs/ARCHITECTURE.md` "Service
adapters"

ALLOWED FILES: `src/hooks/useHaptics.ts`, `src/hooks/useAudio.ts`,
component call-sites wiring these hooks in (not the effect components
themselves), `__tests__/**`

FORBIDDEN FILES: `src/domain/**`, `src/services/audio/**` interfaces
(hooks call the interface, don't redefine it), `src/config/balance.ts`

REQUIREMENTS:

- Light haptic on valid placement, warning haptic on invalid, stronger
  haptic pulse on each urgent (1-move) timer cycle, per `BUILD_SPEC.md`
  §6.5/§6.11.
- Sound effects list per `BUILD_SPEC.md` §20.3, wired via `useAudio`
  (`expo-audio`), never `expo-av`.
- No sound object created per tap (`BUILD_SPEC.md` §18) — preload short
  effects.

ACCEPTANCE CRITERIA: every listed trigger point calls the hook, never a
direct `expo-haptics`/`expo-audio` API call from a screen component.

TESTS: hook-level tests mocking the underlying Expo APIs.

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test -- useHaptics useAudio`

---

**TASK ID: UI-010 — Reduced motion + accessibility pass**

OWNER: Codex · REVIEWER: Claude Code

STITCH REFERENCE: none (cross-cutting) — see `docs/ACCESSIBILITY.md` in
full

READ FIRST: `docs/ACCESSIBILITY.md`, `BUILD_SPEC.md` §19

ALLOWED FILES: components touched by UI-001 through UI-009 (accessibility
props/labels only — no new gameplay/visual logic), `__tests__/**`

FORBIDDEN FILES: `src/domain/**`, `src/config/balance.ts`,
`src/services/**`

REQUIREMENTS:

- Every interactive element has an accessibility label and a test ID.
- Every animated effect respects the reduced-motion setting uniformly
  (audit finding: only one Stitch mockup gated its animations — the real
  app must gate all of them).
- Verify no flashing effect exceeds the accessibility-safe envelope
  described in `docs/ACCESSIBILITY.md`.
- Verify colorblind-safe theme plan doesn't rely on hue alone anywhere new
  effects were added.

ACCEPTANCE CRITERIA: accessibility audit checklist in
`docs/ACCESSIBILITY.md` passes for every screen built in Phase 3/4.

TESTS: accessibility-focused component tests (label/role presence).

VERIFY: `npm run typecheck`, `npm run lint`, `npm run test`

---

## Phase 5 — Persistence and progression

**Owner: Claude Code** (storage logic) · **Owner: Codex** (screens)

Delivered as **Phase 4A** (2026-07-20), implemented directly by Claude Code
(single-writer). See the 2026-07-20 "Phase 4A" Decisions entry.

- [x] 5.1 `StorageService` interface + AsyncStorage implementation (+ in-memory
      test adapter, provider/hook, dev reset)
- [x] 5.2 Active-run persistence (save after every state-changing action, on
      app background; serialized coalescing writer prevents stale overwrites;
      restore on launch; End Run / game over clears; timers unchanged closed)
- [x] 5.3 Best score + lifetime stats persistence (profile, separate from
      GameState) with once-only run settlement
- [x] 5.4 Bolts balance persistence (formula floor(score/250) + defuses)
- [x] 5.5 Five functional themes (Reactor/Arctic/Magma/Void/Solar) applied via
      `useTheme()` with a Bolt-based unlock economy (Phase 5B): `unlockedThemeIds`
      on the profile, authoritative catalog + pure `purchaseTheme` service,
      purchase confirmation with Selected/Owned/Locked/Insufficient states,
      selection persisted and fallback-to-Reactor when unowned; effects are
      theme-aware
- [x] 5.6 Settings persistence (sound/music/haptics/reduced-motion override)
- [x] 5.7 Tutorial completion persistence (profile field), set by the Phase 5A
      first-run tutorial (BUILD_SPEC.md §9 copy) on finish or explicit skip
- [x] 5.8 Schema version + migration mechanism (versioned envelopes + validators + safe fallback; profile v1→v2 migration adds theme ownership keeping
      Bolts/stats)
- [x] 5.9 Themes screen UI (previewed tiles, immediate apply + persist)
- [x] 5.10 Settings screen UI (persisted toggles + Themes and Replay-Tutorial
      navigation)

**Acceptance:** force-closing and reopening restores the active game;
settings persist; no timer changes while closed. (Theme purchase/unlock
persistence lands with Phase 6.)

---

## Phase 6 — Mock monetization

**Owner: Claude Code** (contracts/rules) · **Owner: Codex** (presentation)

- [ ] 6.1 `MockAdService` implementing the `AdService` interface
- [ ] 6.2 Frequency-cap enforcement (revive/freeze/defuse/double/interstitial)
- [ ] 6.3 Rewarded revive UI
- [ ] 6.4 Freeze UI
- [ ] 6.5 Defuse UI
- [ ] 6.6 Double-reward UI (final results screen)
- [ ] 6.7 Failure-state UI (ad unavailable/closed/error)
- [ ] 6.8 Frequency-cap tests

**Acceptance:** every reward works without a real ad SDK; a reward can't be
granted twice accidentally; game state is preserved before the mock ad.

---

## Phase 7 — Real advertisements and consent

**Owner: Claude Code** · Codex assists only with presentation components.

- [ ] 7.1 `GoogleMobileAdsService` native integration
- [ ] 7.2 App ID / test ID configuration (already scaffolded in
      `app.config.ts`; wire real production IDs via EAS secrets)
- [ ] 7.3 Consent flow (Google Mobile Ads consent support)
- [ ] 7.4 Preload strategy for rewarded + interstitial
- [ ] 7.5 Timeout/error handling
- [ ] 7.6 Create and validate an Expo development build
- [ ] 7.7 Validate EEA / non-personalized-ads path
- [ ] 7.8 Validate offline fallback

**Acceptance:** test rewarded ads grant exactly one reward; closed ads grant
none; failed ads don't corrupt state; interstitial caps work; dev/prod
configs stay separated.

---

## Phase 8 — Analytics and crash reporting

**Owner: Claude Code**

- [x] 8.1 `AnalyticsService` interface + event schema (`docs/ANALYTICS.md`) —
      **Phase 6A**
- [ ] 8.2 Production analytics provider implementation (Phase 6B / production)
- [x] 8.3 Run-summary event with all required aggregated fields (`run_end`) —
      **Phase 6A**
- [x] 8.4 Ad-funnel events (freeze/defuse/revive/double-Bolts offer+result) —
      **Phase 6A**
- [~] 8.5 Crash reporting integration — **Phase 6A** added the `ErrorReporter`
  seam + app-level boundary + recovery (`docs/ERROR_REPORTING.md`); the
  production crash SDK adapter is deferred to the production phase
- [x] 8.6 Privacy configuration review (no unnecessary personal data) —
      **Phase 6A** (typed aggregate-only taxonomy; see `docs/ANALYTICS.md`)

**Acceptance:** events contain no unnecessary personal data; analytics
failure never breaks gameplay; run summaries recorded correctly. — met for the
seam/taxonomy in Phase 6A; production SDK wiring pending.

### Phase 6A — Analytics, diagnostics & monetization readiness (delivered)

**Owner: Claude Code.** Pre-production instrumentation, entirely behind
adapters; no production ad ids, live ad SDK, or consent UI.

- [x] Typed `AnalyticsService` adapter + Noop (offline-safe) and in-memory
      (test) implementations; provider + `useAnalytics` (safe, no-op default)
- [x] Full event taxonomy (app/session, tutorial, run lifecycle, gameplay,
      rewarded offers/results, `run_end`, results, themes, settings)
- [x] Deduplication: turn-scoped events once per turn; terminal events
      (`run_end`, `results_view`) once across restart/Back/remount/restore;
      reward callbacks never double-log
- [x] `ErrorReporter` adapter + Noop/in-memory impls + module bridge; app-level
      `AppErrorBoundary` with recovery UI; persistence/reward failures reported
      without exposing secrets or raw state
- [x] Typed reward placements (`REWARD_PLACEMENTS`); mock Double Bolts on
      Results, applied at most once per run (pure `applyDoubleBolts` + session
      guard); offer/earned/closed/unavailable/failed analytics
- [x] Docs: `ANALYTICS.md`, `ERROR_REPORTING.md`, `RELEASE_CHECKLIST.md`,
      `TASKS.md`, `DECISIONS.md`
- [x] Verified: typecheck, lint, test, coverage, format:check, expo-doctor,
      Android export

---

## Phase 9 — QA and release

**Owner: Claude Code** · Codex handles UI bug fixes and performance tasks.

- [ ] 9.1 Full regression pass against `docs/TEST_PLAN.md`
- [ ] 9.2 Manual device matrix pass
- [ ] 9.3 Store assets (icon, screenshots, feature graphic)
- [ ] 9.4 Privacy policy + Data Safety information
- [ ] 9.5 Production AAB build
- [ ] 9.6 Closed testing track submission
- [ ] 9.7 Crash monitoring live-check
- [ ] 9.8 Balance validation against the Phase-0 prototype-validation gate
      results (`docs/MVP_SCOPE.md`)
- [ ] 9.9 `docs/RELEASE_CHECKLIST.md` written and completed

---

## Immediate next task

Phase 0 is complete — see the Phase 0 report delivered alongside this file
for full verification results. **Next: Phase 1, item 1.1** — define
`GameState`/`GridCell`/`ActiveTimedPiece`/`HandPiece` in
`src/domain/gameTypes.ts` per `BUILD_SPEC.md` §14, then work through the
rest of Phase 1 in order. Do not start Phase 3 (Codex UI work) until Phase 1
and Phase 2's acceptance criteria are met — there is no domain state for
Codex to render against yet.

---

## Professional UI Polish — Phase 1 (planned, not started)

Authority: `docs/PROFESSIONAL_UI_POLISH_MASTER_PLAN.md` + `docs/VISUAL_POLISH_REVIEW.md`.
Direction: "Neon Reactor Premium". Visual/motion polish only — **no gameplay,
scoring, timer, persistence, economy, analytics, reward, or domain change.**

**Global rules for every P1 task:**

- **Owner: Claude Code** for all tasks. The Codex sandbox is broken on this
  machine (`DECISIONS.md` 2026-07-18); do not delegate implementation.
- **Single-writer:** confirm a clean tree and that no other agent is editing the
  task's files before starting; edit only the task's allowed files.
- **Forbidden for all tasks:** `src/domain/**`, `src/config/balance.ts`,
  `src/services/**`, `src/economy/**`, persistence schemas, analytics/diagnostics
  contracts, reward logic (`src/hooks/useRewardedAction.ts`, ad service),
  production ad config, `BUILD_SPEC.md`. No new dependencies or assets. No second
  animation system (stay on RN `Animated`). No per-cell blur.
- **Verification for every task:** `npm run typecheck`, `npm run lint`,
  `npm run test`, `npm run format:check`, `npx expo-doctor`. Tasks that change
  layout/geometry also run `npx expo export --platform android`.

- [ ] **P1-1 Responsive gameplay composition**
  - Allowed: `app/game.tsx` (`GameView` layout/styles only),
    `src/components/GameBoard/GameBoard.tsx` (sizing), `__tests__/**`.
  - Forbidden: `GridCell` visuals, reward/tray internals.
  - Depends on: none.
  - Acceptance: HUD / board / tray / dock distribute vertically with no dead
    bottom third; board scales cleanly 360–420px wide; safe-area top+bottom
    respected; zero gameplay-behavior change; all existing tests green.
  - Tests: composition smoke (board+tray+dock+HUD all render; testIDs present)
    at a min-width board size.
  - Verify: full battery + Android export.

- [ ] **P1-2 HUD and reactor background**
  - Allowed: `src/components/ScoreHeader/**`, `src/components/ComboIndicator/**`,
    a new `src/components/ReactorBackground/**`, `app/game.tsx` (wire real best +
    background), `src/ui/theme.ts` + `src/ui/themes.ts` (token alignment only).
  - Forbidden: `GridCell`, reward controls, domain.
  - Depends on: P1-1.
  - Acceptance: `BEST` shows the persisted profile best (wired from `useProfile`,
    not the `0` stub); a programmatic reactor-depth background (gradient/vignette,
    no asset, cheap, theme-aware) replaces the flat fill; base tokens aligned
    toward the Premium palette without breaking the 5 themes.
  - Tests: `ScoreHeader` renders a non-zero best from its prop; HUD a11y labels
    intact; background renders under each theme.
  - Verify: full battery + Android export.

- [ ] **P1-3 Board frame and empty cells**
  - Allowed: `src/components/GameBoard/GameBoard.tsx` (frame),
    `src/components/GridCell/GridCell.tsx` (empty case), theme tokens.
  - Forbidden: block/rubble logic beyond visuals, domain.
  - Depends on: P1-2 (tokens).
  - Acceptance: empty cells use a distinct empty-cell token (not board fill);
    board frame reads as a premium bezel; contrast is comfortable; theme-aware.
  - Tests: empty `GridCell` renders the empty-cell token; frame present.
  - Verify: full battery.

- [ ] **P1-4 Premium block surfaces**
  - Allowed: `src/components/GridCell/GridCell.tsx` (timed/normal), an optional
    `BlockSurface` subcomponent, theme tokens.
  - Forbidden: domain, timer/rubble logic.
  - Depends on: P1-2, P1-3.
  - Acceptance: blocks have a solid/gradient premium fill with inner light + edge
    (not outline-only); cheap (no per-cell blur, ≤1 shadow layer); readable in all
    5 themes; distinguishable by hue+brightness (colorblind-safe), not color alone.
  - Tests: block renders a fill for each `colorId`; snapshot of the three hues.
  - Verify: full battery.

- [ ] **P1-5 Timer badges and piece contours**
  - Allowed: `src/components/TimerBadge/**`, `src/components/GameBoard/GameBoard.tsx`
    (contour overlay), `src/components/GridCell/GridCell.tsx` (contour),
    `src/ui/timerStates.ts`, `src/ui/timerPulse.ts` (visual thresholds only).
  - Forbidden: domain timer rules/values.
  - Depends on: P1-4.
  - Acceptance: a contour visually groups a timed piece's cells so ownership is
    unambiguous; badge refined and theme-aware; numeral always legible; pulse
    reduced-motion gated; never color-only.
  - Tests: badge digit renders; a multi-cell timed piece shows a grouping contour.
  - Verify: full battery.

- [ ] **P1-6 Cracked rubble**
  - Allowed: `src/components/GridCell/GridCell.tsx` (rubble case), theme tokens
    (`rubbleFill`/`rubbleCrack`).
  - Forbidden: domain rubble rules.
  - Depends on: P1-3.
  - Acceptance: cracked-stone treatment (base fill + branching cracks) replaces
    the "X"; visually distinct from blocks and empty cells; theme-aware; cheap.
  - Tests: rubble cell renders crack elements and keeps its "Rubble" a11y label.
  - Verify: full battery.

- [ ] **P1-7 Stable three-slot tray**
  - Allowed: `src/components/PieceTray/**`.
  - Forbidden: domain hand/refill rules.
  - Depends on: P1-4 (block surface reused in mini-shapes).
  - Acceptance: always renders 3 fixed slots (empty placeholder for a consumed
    slot) with no reflow as pieces are used; slot chrome theme-aware; drag/tap
    target = full slot box; selected/dragging states preserved.
  - Tests: with a 1-piece hand, three slots render (two empty); select + drag
    callbacks still fire.
  - Verify: full battery.

- [ ] **P1-8 Freeze/Defuse action dock**
  - Allowed: `src/components/RewardedActionButton/**`, `app/game.tsx` (dock
    placement only).
  - Forbidden: reward trigger logic (`useRewardedAction`, ad service), domain.
  - Depends on: P1-1.
  - Acceptance: a grounded action dock (not floating); theme-aware idle/active/
    selected/disabled states; ≥48px targets; `N MOVES` freeze label preserved;
    the reward-earn flow is untouched.
  - Tests: existing reward-flow integration tests pass unchanged; button states
    render per prop.
  - Verify: full battery.

- [ ] **P1-9 Theme compatibility**
  - Allowed: gameplay-visible components (`GridCell`, `PieceTray`, `ScoreHeader`,
    `RewardedActionButton`, `GameBoard`) + theme tokens; remove hardcoded
    `colors.*` from these.
  - Forbidden: domain; non-gameplay screens optional (out of Phase 1 scope).
  - Depends on: P1-2..P1-8.
  - Acceptance: every gameplay-visible chrome color reads from the active theme;
    all 5 themes render correctly; critical danger stays readable in each theme;
    no `colors.*` theme-bypass remains in gameplay components.
  - Tests: `it.each` over `THEMES` asserting key chrome (block, empty, rubble,
    badge, preview-conflict, dock-active) matches the theme token.
  - Verify: full battery.

- [ ] **P1-10 Responsive & accessibility review**
  - Allowed: `docs/**`, `__tests__/**` (UI code changes only to fix regressions
    this review surfaces).
  - Forbidden: feature work, domain.
  - Depends on: P1-1..P1-9.
  - Acceptance: verified at 360/390/420-px widths and a large font scale; all
    touch targets ≥44px; reduced-motion honored across new visuals; findings
    recorded in `VISUAL_POLISH_REVIEW.md` + `ACCESSIBILITY.md`.
  - Tests: gameplay renders at min board width; a11y labels present on new chrome.
  - Verify: full battery + Android export.

- [ ] **P1-11 Before/after screenshot comparison**
  - Allowed: `docs/**`, add an AFTER capture under `docs/current game images/`
    (never overwrite `gameplay screen.jpg`).
  - Forbidden: code.
  - Depends on: P1-1..P1-10.
  - Acceptance: baseline vs polished documented area-by-area; any regression
    triaged into a follow-up task; sign-off recorded.
  - Tests: none (docs).
  - Verify: `npm run format:check`.

**Phase 1 acceptance:** every P1 task checked; full verification + Android export
clean; all 5 themes correct; no gameplay/domain/economy/analytics/reward change;
before/after comparison approved. Then Phase 2 (motion polish), Phase 3
(whole-app polish), and only afterward resume Phase 6B.
