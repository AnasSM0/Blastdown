# Visual Polish Review — Phase 0 Audit

Read-only audit of the current gameplay UI against the approved references and
`docs/PROFESSIONAL_UI_POLISH_MASTER_PLAN.md` ("Neon Reactor Premium"). No
production UI was modified in Phase 0. This document plus the Phase 1 task block
in `docs/TASKS.md` are the implementation authority for Phase 1.

Baseline: `docs/current game images/gameplay screen.jpg` (current device
capture; do not overwrite). Source-of-truth order is defined in the master plan
§1 — gameplay docs win over visuals; Stitch is visual-direction only; the
existing implementation is **not** automatically correct.

---

## 1. Baseline screenshot findings

The capture shows a live run (score 2,204) on an 8×8 board.

| Area                                   | Current state                                                                                                        | Assessment                                                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HUD hierarchy/spacing**              | `BEST 0` top-left, orange score centered, circular pause top-right.                                                  | Structure is correct, but **`BEST` reads `0` mid-run** — `app/game.tsx` passes `best={0}` (a Phase-3 stub) instead of the persisted profile best. Correctness gap, not a domain change.                       |
| **Board size/frame/empty cells**       | 8×8, thin 2px frame, `radius.board` 8, empty cells filled with `boardBg`.                                            | Empty cells are near-invisible (empty fill == board fill) → "featureless dark area" the plan says to avoid. Frame is thin and low-contrast. Board sits high, doesn't fill vertical space.                     |
| **Block material/depth**               | Timed/normal blocks are a translucent `${accent}22` fill + 1px accent border.                                        | **Outline-only blocks** — explicitly on the plan's "Avoid" list. No premium fill, no depth/inner-light. Biggest single visual gap.                                                                            |
| **Timer attachment / piece ownership** | 24px circular badge with digit, colored by urgency, anchored to the piece's top-left cell corner (offset −8,−8).     | Works and is theme-aware, but a single corner badge makes multi-cell piece ownership ambiguous — no piece contour/outline groups the cells of one timed piece.                                                |
| **Rubble**                             | `rubbleFill` cell + two thin rotated 1.5px `View` bars → an "X" cross.                                               | Reads as a crossed-out cell, not "cracked rubble." Placeholder-grade; plan wants a cracked-stone treatment.                                                                                                   |
| **Tray**                               | `hand.map` renders only the _remaining_ pieces (1 shown), `space-evenly`, 64px slots, mini-shapes also outline-only. | **No stable three-slot layout** — the tray reflows/recenters as pieces are consumed. Slot chrome is not theme-aware.                                                                                          |
| **Freeze/Defuse controls**             | Two 48px outline circles (❄ / ⚡) centered below the tray, large gap between them.                                   | Functional but visually thin/floating; not docked. Glyphs are text characters, colors hardcoded cyan/grey.                                                                                                    |
| **Unused lower-screen space**          | Bottom ~30% is empty black.                                                                                          | `content` column packs to the top (`flex-start`); board + tray + dock don't distribute. Wasted space, unbalanced composition.                                                                                 |
| **Floating Settings control**          | Translucent gear, bottom-right.                                                                                      | **Not part of BlastDown UI** — no settings gear exists in `app/game.tsx` or any game component. It is an external dev-client / OS overlay. Ignore it (see §4 invalid details).                                |
| **Safe-area / small-screen**           | `SafeAreaView` wraps content; board width is `100%`/`maxWidth 420`, aspect 1.                                        | Board sizing is responsive; but the top HUD and bottom dock rely on the board taking the middle, and the empty-space packing will look worse on tall/short devices. Needs an explicit responsive composition. |
| **Gap from approved Stitch direction** | Outline blocks, featureless empties, X-rubble, single-piece tray, unbalanced vertical rhythm.                        | Substantial. The layout skeleton is right; the _material quality_ and _composition_ are the gap.                                                                                                              |

---

## 2. Implementation map (files controlling each area)

| Concern                               | File(s)                                                                                                                                                                                                                                                           | Notes                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Gameplay layout & responsive geometry | `app/game.tsx` (`GameView` `styles.screen/safe/content`), `src/ui/boardGeometry.ts`, `src/components/GameBoard/GameBoard.tsx` (`cellSize` compute, `maxWidth 420`)                                                                                                | Composition is a flex column packed to top; geometry is measured (no fixed device coords). |
| HUD                                   | `src/components/ScoreHeader/ScoreHeader.tsx`, `src/components/ComboIndicator/ComboIndicator.tsx`                                                                                                                                                                  | `best` is stubbed `0` in `app/game.tsx`; pause chrome hardcodes `colors.*`.                |
| Board, cells, blocks                  | `src/components/GameBoard/GameBoard.tsx`, `src/components/GridCell/GridCell.tsx`                                                                                                                                                                                  | Block/empty/rubble visuals all in `GridCell`.                                              |
| Timers & piece contours               | `src/components/TimerBadge/TimerBadge.tsx`, `src/ui/timerStates.ts`, `src/ui/timerPulse.ts`                                                                                                                                                                       | Badge is theme-aware; no piece-contour grouping exists yet.                                |
| Rubble                                | `src/components/GridCell/GridCell.tsx` (`rubble` case + `crackA`/`crackB`)                                                                                                                                                                                        | Two rotated `View` bars.                                                                   |
| Tray                                  | `src/components/PieceTray/PieceTray.tsx` (`PieceTray`, `TraySlot`, `MiniShape`)                                                                                                                                                                                   | Renders variable count; slot chrome hardcoded.                                             |
| Reward controls                       | `src/components/RewardedActionButton/RewardedActionButton.tsx` (`RewardedActionBar`)                                                                                                                                                                              | All state colors hardcoded to base `colors`.                                               |
| Backgrounds                           | `app/game.tsx` (`screen` `backgroundColor: theme.appBackground`)                                                                                                                                                                                                  | No reactor-texture/gradient component; flat fill.                                          |
| Themes & tokens                       | `src/ui/themes.ts` (`ThemePalette`, 5 themes, `resolveTheme`/`blockColor`/`glowFor`), `src/ui/theme.ts` (base `colors`/`spacing`/`radius`/`typography`/`neonGlow`), `src/ui/ThemeProvider.tsx`                                                                    | Base `colors` predate the plan's Premium palette (see §3 risks).                           |
| Selected / preview states             | `src/components/GridCell/GridCell.tsx` (preview overlay), `src/components/PieceTray/PieceTray.tsx` (`slotSelected`), `src/components/DragGhost/DragGhost.tsx`                                                                                                     | Preview `invalid`/`conflict` use hardcoded `colors`, not theme.                            |
| Gestures                              | `src/components/PieceTray/PieceTray.tsx` (`Gesture.Pan`), `src/components/DragGhost/DragGhost.tsx`, `src/ui/boardGeometry.ts`, `app/game.tsx` handlers                                                                                                            | Single gesture system (gesture-handler).                                                   |
| Animations                            | `src/hooks/useEventAnimator.ts`, `src/ui/effects/eventEffects.ts`, `src/components/effects/*` (`EffectsLayer`/`CellFlash`/`PulseRing`/`BurstCell`/`FloatingText`), plus `GridCell` snap, `GameBoard` shake, `TimerBadge` pulse, `SecondChanceBanner`, `DragGhost` | **All RN `Animated`.** No `react-native-reanimated` imports anywhere.                      |
| Reduced motion & accessibility        | `src/hooks/useReducedMotion.ts`, `src/hooks/useEffectiveReducedMotion.ts`, `accessibilityLabel`/`Role`/`State` across components                                                                                                                                  | Reduced-motion is threaded through every effect via prop/hook.                             |

---

## 3. Architecture risks

| Risk                              | Status               | Detail                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain/gameplay logic in UI       | **Clean**            | UI renders `GameState` and reacts to typed `GameEvent`s; no scoring/timer/placement/explosion logic in components. Preserve this.                                                                                                                                                                                                |
| Hardcoded colors bypassing themes | **Real, widespread** | 149 `colors.*` references across 15 components. Gameplay-critical offenders: `GridCell` (preview `invalid`/`conflict`), `PieceTray` (slot bg/border/selected), `ScoreHeader` (pause), `RewardedActionButton` (every state). Non-Reactor themes render cyan/grey chrome.                                                          |
| Base tokens vs Premium palette    | **Real**             | `src/ui/theme.ts` `colors` differ from the plan §3 target (appBackground `#050505`→`#05070B`, boardBg `#0F172A`→`#070C13`, no distinct empty-cell `#101A2C`, cyan `#00F0FF`→`#00DDEB`, score `#FF6B00`→`#FF6200`, critical `#FF003D`→`#FF335C`). Needs a token-alignment pass, done via tokens only — not per-component.         |
| Duplicate animation systems       | **Clean**            | Single system (RN `Animated`). `react-native-reanimated` is only a transitive gesture-handler dep, unused directly. **Do not** introduce a second system. Note: `docs/UI_IMPLEMENTATION.md`/`ANIMATION_SPEC.md` still _say_ Reanimated — stale (see the RN-Animated decision, `DECISIONS.md` 2026-07-20); updated in this phase. |
| Fixed device coordinates          | **Clean**            | Board/cell sizing is measured at runtime; `boardGeometry` maps finger→cell from measured layout. No hardcoded pixel grid.                                                                                                                                                                                                        |
| Expensive per-cell effects        | **Low, watch**       | No per-cell blur (deliberately avoided). Each `GridCell` is a `Pressable` + up to 2 crack `View`s + optional overlays; a premium block treatment must stay cheap (no per-cell shadow/blur on 64 cells).                                                                                                                          |
| Rerender / event duplication      | **Low**              | `GameBoard` is `memo`; effects keyed per turn. A composition refactor must not add per-frame state that rerenders all 64 cells.                                                                                                                                                                                                  |
| Text-scaling / accessibility      | **Watch**            | Numeric styles use fixed `fontSize`; large-font users may clip the HUD/badges. Touch targets are ≥44–48px today — keep as a hard floor. Timer badge must keep its digit legible at all sizes (never color-only).                                                                                                                 |
| Agent file collisions             | **Managed**          | A `codex.exe` (VS Code ChatGPT extension) is running, but the working tree is clean and no UI file is modified. Phase 1 must assign bounded single-writer ownership per task before editing.                                                                                                                                     |

---

## 4. Stitch comparison

**Visual rules to preserve** (from approved screens + master plan):

- Timer badge always shows a numeral (never color/glow alone) — `BUILD_SPEC.md` §6.11.
- One badge per timed piece over its topmost surviving cell — not per cell.
- Combo indicator lives in the header, not floating over the board.
- Power-up controls are driven by domain capability flags, not hardcoded visibility.
- Programmatic shapes only — piece shapes render from `ShapeDefinition.cells`, never images (`BUILD_SPEC.md` §6.3).
- No per-cell `backdrop-filter`/blur; glow is `shadow`/`elevation`.
- Every button ≥48×48; drag target = full tray-slot box.

**Invalid mockup details to ignore:**

- The **floating Settings gear** in the current screenshot — an external dev/OS overlay, not app UI. Do not build it, do not treat it as reference.
- Stitch's literal 40px cells / 380px board width / fixed 390×844 viewport — sizing is computed from available space.
- AI-generated boards may show invalid states; don't reproduce arrangements.
- Stitch models no safe-area insets — add them natively regardless.

**Implementation gaps vs direction:**

- Premium block surfaces (not outline-only).
- Distinct, textured empty cells (not board-colored voids).
- Cracked rubble (not an X).
- Stable three-slot tray.
- Balanced vertical composition (no dead bottom third).
- Reactor-depth background (not flat black).
- Docked Freeze/Defuse controls.
- Theme-aware chrome everywhere gameplay-visible.

**Should remain programmatic** (no assets): blocks, empty cells, board frame, rubble cracks, timer badges, piece contours, previews, glows, particles. All achievable with `View`/`Pressable`/`Text` + borders/fills/shadows + RN `Animated`.

**Licensed assets genuinely required:** none for Phase 1. Fonts (Geist, JetBrains Mono — already licensed OFL) and CC0 audio already vendored. Do not add assets or dependencies in Phase 1.

---

## 5. Recommended first Phase 1 task

**P1-1 Responsive gameplay composition** — it is the foundation the other ten
tasks lay their polished surfaces onto, is pure layout (lowest risk, no
domain/theme contract touched), and directly fixes the most obvious baseline
problem (the dead lower third + top-packed board). Every subsequent material
task (blocks, rubble, tray, dock) benefits from a correct composition first.

---

## Phase 1 · P1-1 — Responsive gameplay composition (implemented)

Layout-only foundation. No blocks/timers/rubble/theme-tokens/animations changed.

**Files changed:**

- `app/game.tsx` — restructured `GameView` into four stable vertical zones (HUD
  → board → tray → action dock); added measured board geometry.
- `__tests__/integration/gameLayout.test.tsx` — new tests (see below).

**Responsive decisions:**

- **Four zones.** `ScoreHeader` (HUD) sits above a `content` column holding a
  board zone, tray zone, and action zone. `content` uses
  `justifyContent: "space-evenly"` so leftover vertical space becomes even
  breathing room instead of the baseline's dead bottom third — the tray and dock
  can no longer drift far below the board.
- **Measured square board.** `content`'s box is measured via `onLayout`;
  `computeBoardSide` returns the largest square that fits both the available
  width and a height budget (`min(width, height × 0.62, 420)`). The board grows
  to fill width on tall screens and shrinks on short screens so it never clips
  the tray/dock. No fixed device coordinates — pure measured geometry. A
  caller-supplied `boardSize` still overrides measurement (test seam).
- **64-cell geometry preserved.** The board is rendered inside a square wrapper
  sized to `boardSide` and `GameBoard` receives `boardSize={boardSide}`, so its
  internal 8×8 cell computation is unchanged — exactly 64 cells at every width.
- **Safe areas.** `SafeAreaView` now declares `edges={["top","bottom","left","right"]}`
  explicitly, so the HUD clears the status bar and the action dock clears Android
  gesture / three-button navigation.
- **Text scaling.** The board zone absorbs slack; if HUD/tray/dock text scales
  up, the board shrinks rather than pushing the primary controls off-screen.
- **≥320 px.** Verified in tests at 320/360/390/420 logical px — 64 cells and all
  four zones present at each.
- **Unchanged:** drag/tap, pause, reward, analytics, audio, persistence, theme,
  accessibility, and all effect/animation timing. Materials of blocks, timers,
  rubble, tray slots, and reward buttons are untouched (P1-2..P1-9).

**Tests added (`gameLayout.test.tsx`):** `computeBoardSide` unit (width-bound,
height-bound, cap, unmeasured→0); board renders exactly 64 cells + HUD/board/
tray/dock/pause/freeze/defuse at 320/360/390/420 px; tap placement still works
after the restructure. Full suite: 78 suites / 432 tests green; coverage 89.5%.

**Screenshot / device finding:** no Android device or emulator is available in
this environment, so an after-capture at the baseline resolution
(`docs/current game images/phase1-p1-layout-after.jpg`) was **not** produced —
recorded here rather than fabricated. `expo export --platform android` succeeds,
confirming the layout builds. On-device visual confirmation of the four-zone
composition is deferred to when a device/emulator is available.

**Risks:** (1) First paint before `onLayout` renders no board for one frame
(`boardSide === 0`); harmless flash, board appears next frame. (2) The 0.62
height fraction is a tuning value — may want adjustment once P1-7 (3-slot tray)
and P1-8 (action dock) change the tray/dock heights; revisit then. (3) Very tall
aspect ratios leave symmetric slack around the board (by design, via
space-evenly) rather than a tight group — acceptable and consistent.

---

## Phase 1 · P1-2 — HUD and reactor background (2026-07-22)

Second Phase 1 task, built on the P1-1 composition. Scope: real HUD best-score
data, HUD visual hierarchy, and a restrained programmatic reactor background —
no board/block/timer/rubble/tray/reward-control work.

**Files changed:**

- `src/ui/themes.ts` — added a `background` token block (`base`, `glow`, `seam`,
  `grid`, `corner`) to `ThemePalette` and to all five palettes. Reactor's block
  is nudged toward the Premium deep-navy/graphite reference (`base #070C16`);
  the other four derive their background hues from their own existing tones so
  none is broken. `appBackground` itself is unchanged.
- `src/components/ReactorBackground/**` — new. A fully programmatic, static,
  theme-aware surface: deep base fill, a soft central lift (large low-opacity
  rounded panel approximating a vignette without a gradient lib), a faint 3×3
  circuit grid of hairlines, two panel seams, and four corner brackets. All
  positions are percentages (holds ≥320px), `pointerEvents="none"`, no
  animation, no image, no blur, no shadow layers.
- `src/components/ScoreHeader/ScoreHeader.tsx` — HUD is now theme-aware and
  text-scaling-safe: BEST label + value use `theme.onSurfaceVariant` (secondary,
  upper-left), the current score keeps `theme.score` + low glow (strongest,
  centered), pause uses `theme.outlineVariant` (neutral, less dominant). Fixed
  72px side columns keep the score truly centered; both score values are
  flexible with `adjustsFontSizeToFit` + `numberOfLines={1}` (so a multi-digit
  best shrinks rather than truncates) and cap OS font scaling, so columns can't
  collide at large accessibility sizes.
- `app/game.tsx` — renders `<ReactorBackground />` full-bleed behind the
  safe-area content; wires the HUD best score from the **single** existing
  profile read path (`useProfile().profile.bestScore` in the real `GameScreen`
  route), threaded to `GameView`/`ScoreHeader` as `best` (defaults to 0 for the
  pre-load/default-profile state and isolated renders). The `best={0}` stub is
  gone.

**HUD / data decisions:**

- One profile read path only — the real route reads `useProfile`; `GameView`
  takes `best` as a prop, so component tests stay provider-light and the default
  profile (bestScore 0) is a safe pre-load display value.
- Best is deliberately _secondary_ (dimmed `onSurfaceVariant`), not the
  reference's brighter cyan, to honor "small and secondary" and keep the score
  dominant.
- Combo visibility unchanged (`ComboIndicator` still renders only when
  `combo > 0`), pause label/role intact.

**Token / background decisions:**

- Background hues live in semantic `theme.background.*` tokens, not hardcoded in
  the component — every theme stays low contrast and the board remains primary.
- Reactor aligned toward Premium navy/graphite; the four other themes derive
  their background from their own palette so Arctic/Magma/Void/Solar are
  unaffected. Token changes limited strictly to what P1-2 needs — no
  block/timer/rubble/tray/reward color changes.

**Tests:** `themes.test.ts` validates the background token set (valid hex) for
all five themes; `ReactorBackground.test.tsx` asserts it renders, is
non-interactive, and paints the Reactor base; `ScoreHeader.test.tsx` adds a
non-zero best (testID + a11y label), intact score/best/pause a11y labels, and
the text-scale guards; `gameLayout.test.tsx` threads a persisted best into the
HUD end-to-end, asserts the background renders alongside the still-exactly-64
board, and that best defaults to 0. Full suite: **79 suites / 441 tests** green;
coverage **89.57%** (new files 100%).

**Verification:** typecheck ✅, lint ✅, test ✅, coverage ✅ 89.57%,
format:check ✅, expo-doctor ✅ 20/20, `expo export --platform android` ✅.

**Screenshot / device finding:** no Android device or emulator is available in
this environment, so an after-capture at the baseline resolution
(`docs/current game images/phase1-p2-hud-background-after.jpg`) was **not**
produced — recorded here rather than fabricated. The Android export succeeds,
confirming the HUD + background build. On-device visual confirmation is deferred
to when a device/emulator is available.

**Risks:** (1) The central-lift "glow" panel is a rounded-rect approximation of
a radial gradient, not a true gradient — acceptable and cheap, but a real
gradient (P1 has no gradient dep) would read smoother; revisit only if a
dependency is later approved. (2) Background tokens for the four non-Reactor
themes were derived, not visually tuned on-device — validate contrast against
board cells when a device is available. (3) Extreme best scores (7+ digits)
shrink to fit the fixed side column via `adjustsFontSizeToFit`; at some point the
digits get small, but they stay legible and never truncate.
