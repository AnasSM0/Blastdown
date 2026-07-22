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

---

## Phase 1 · P1-3 — Board frame and empty cells (2026-07-22)

Third Phase 1 task, built on the P1-2 tokens. Scope: premium board frame depth
and distinct empty-cell presentation — no block-material, timer, rubble, tray,
action-dock, or animation work.

**Files changed:**

- `src/ui/themes.ts` — added board-frame + empty-cell tokens to `ThemePalette`
  and all five palettes: `boardFrameInner` (fine inner ring), `boardFrameBevel`
  (top inset highlight), `boardFrameCorner` (corner accent), `emptyCell` (fill),
  `emptyCellBorder`. Reactor is the reference; the other four derive from their
  own board tones so all stay readable. Token additions limited to P1-3 needs.
- `src/components/GameBoard/GameBoard.tsx` — frame depth via three decorative,
  `pointerEvents="none"` layers that do **not** touch layout geometry: a
  hairline inner-border ring and a subtle top bevel drawn behind the cells
  within the frame/gutter zone, and four small theme-aware corner brackets drawn
  on top. `BOARD_CONTENT_INSET` (`FRAME_WIDTH 2 + gridGutter 2`) is unchanged, so
  drag mapping, badge anchors, cell size, squareness (`aspectRatio: 1`), and the
  64-cell geometry are all preserved.
- `src/components/GridCell/GridCell.tsx` — the empty case now fills with
  `theme.emptyCell` + `theme.emptyCellBorder` instead of the board-panel color,
  so the 8×8 structure reads clearly. No extra per-cell View/wrapper (fill +
  border only) to protect performance across 64 cells.

**Frame / cell decisions:**

- Frame depth is purely additive overlays — zero change to the board's box
  model — which is the only way to add a bezel without disturbing the measured
  drag geometry the whole input path depends on.
- Inner ring + bevel sit behind cells inside the 4px frame/gutter zone (never
  covering playable area); corner brackets sit on top but are thin (2px) and
  short (12px), non-interactive, so hit testing is untouched.
- Empty cell kept to fill + border (no inner-highlight sub-View) — the distinct
  fill already reveals the grid, and avoiding a 64× extra View honors the
  performance rule.
- Distinctness matrix preserved: empty (`emptyCell` navy/tonal fill) ≠ filled
  (`${accent}22` + accent border) ≠ rubble (`rubbleFill` + cracks) ≠ preview
  (dashed overlay) ≠ highlight (solid accent ring).

**Token changes:** five new semantic tokens per theme
(`boardFrameInner/Bevel/Corner`, `emptyCell`, `emptyCellBorder`); no
gameplay-critical color is hardcoded in `GameBoard`/`GridCell`; no
block/timer/rubble/tray/reward colors touched.

**Tests:** `themes.test.ts` validates the five new tokens (valid hex) for all
themes and asserts `emptyCell` is distinct from the board panel and rubble;
`GridCell.test.tsx` (new) asserts the empty fill uses the dedicated token and
stays distinct from filled/rubble/preview, with the empty a11y label intact;
`GameBoard.test.tsx` asserts the board stays square, the frame layers render and
are non-interactive, and the cell count is still 64;
`GameBoardInteraction.test.tsx` (unchanged) confirms tap/hit testing still
works. Full suite: **80 suites / 448 tests** green; coverage **89.59%**.

**Verification:** typecheck ✅, lint ✅, test ✅, coverage ✅ 89.59%,
format:check ✅, expo-doctor ✅ 20/20, `expo export --platform android` ✅.

**Screenshot / device finding:** no Android device/emulator available, so
`docs/current game images/phase1-p3-board-after.jpg` was **not** produced —
recorded here rather than fabricated. Android export succeeds, confirming the
frame/cell changes build. On-device visual confirmation deferred.

**Risks:** (1) Corner brackets overlap the outermost cells' corners by ~2px
(decorative bezel, `pointerEvents="none"` so no touch impact) — acceptable and
intentional. (2) The hairline inner ring at very small board widths (≈320px)
sits close to the outer frame; still legible, revisit if it reads as a double
line on-device. (3) Non-Reactor frame/empty tokens were derived, not tuned
on-device — validate contrast against blocks/rubble when a device is available.

---

## Phase 1 · P1-4 — Premium block surfaces (2026-07-22)

Fourth Phase 1 task. Scope: replace the outline-only filled cells with a shared,
layered "energy tile" material and give every block state a distinct, readable
treatment — no timer, rubble, tray-restructure, action-dock, or animation work.

**Files changed:**

- `src/ui/blockSurface.ts` — new. Pure `blockSurface(theme, accent, variant)`
  returning a flattened surface (`fill`, `edge`, `borderWidth`, `highlight`,
  `glow`, `opacity`, `dashed`) for eight states: `normal`, `tray`, `selected`,
  `critical`, `disabled`, `previewValid`, `previewInvalid`, `previewConflict`.
  All alpha/tint math lives here, so components hold no scattered hex.
- `src/components/BlockSurface/**` — new. Renders one layered tile: dark
  translucent themed fill + saturated edge + restrained glow + an upper-inner
  highlight sheen, small consistent radius. Static Views only (no blur, image,
  or animated shadow).
- `src/components/GridCell/GridCell.tsx` — filled `timed`/`normal` cells now
  render a `BlockSurface` (variant `critical` when flagged, else `normal`);
  empty/rubble keep their P1-3 treatments. Preview overlays route through the
  shared variants: valid = solid accent, invalid/conflict = the theme's danger
  hue with a **dashed** edge (the non-color cue).
- `src/components/GameBoard/GameBoard.tsx` — derives the set of urgent piece ids
  from the badge data already supplied (`getTimerVisualState(remainingTurns) ===
"urgent"`) and passes `critical` to those pieces' timed cells. No new timer
  logic, no piece-grouping logic — just reads existing metadata.
- `src/components/PieceTray/PieceTray.tsx` — tray mini-cells use the shared `tray`
  material; the dragged piece's tray copy uses the `disabled` material
  (consumed: no glow, reduced priority); the selected slot uses the `selected`
  material (saturated edge + stronger glow).
- `src/components/DragGhost/DragGhost.tsx` — the dragged ghost uses `previewValid`
  (solid) / `previewInvalid` (dashed danger edge) so a bad drop is unmistakable
  while the piece color identity is retained in the fill.

**Material / state decisions:**

- One shared material across board, tray, and ghost, keyed on the piece's
  `colorId` → `blockColor` accent, so cyan/violet/amber identity is preserved
  everywhere and cells of one piece read as related (same material + edge
  intensity) without any UI-side grouping logic.
- Critical preserves color: the danger read is a thicker saturated edge + a
  stronger glow + a brighter highlight, never a recolor.
- Disabled/consumed loses glow and drops opacity — clearly de-emphasized.
- Valid vs invalid preview differ by pattern (solid vs dashed), not color alone
  — an accessibility-safe non-color cue.

**Token changes:** none added — P1-4 reuses existing `blockColor` mapping and the
per-theme `accent`/`timerCritical`/glow tokens; the new `blockSurface` module is
the single place that tints them. No gameplay-critical color is hardcoded in a
component.

**Tests:** `blockSurface.test.ts` (new) — premium material for all three colors,
normal/selected/critical/disabled distinct, critical keeps color, dashed
non-color cue for invalid/conflict, valid strings for every state under all five
themes; `GridCell.test.tsx` — filled cells render the shared tile per color,
empty/filled/rubble distinct, critical intensifies without recolor, no tile for
empty/rubble; `GameBoard.test.tsx` — critical material applies only to urgent
timed pieces; `PieceTray.test.tsx` (unchanged) — selection, drag-dim (opacity
0.4), tap all still pass. Full suite: **81 suites / 457 tests** green; coverage
**89.61%** (`blockSurface` 100%).

**Verification:** typecheck ✅, lint ✅, test ✅, coverage ✅ 89.61%,
format:check ✅, expo-doctor ✅ 20/20, `expo export --platform android` ✅.

**Screenshot / device finding:** no Android device/emulator available, so
`docs/current game images/phase1-p4-block-surfaces-after.jpg` was **not**
produced — recorded here, not fabricated. Android export succeeds, confirming
the block surfaces build. On-device visual confirmation deferred.

**Risks:** (1) Each filled block adds one static sheen sub-View; on a very full
board that is up to ~64 extra Views — static and cheap (no blur/animation), but
worth watching on low-end devices. (2) The "critical" threshold reuses the
existing urgent visual state (≤1 move); if design later wants warning (2 moves)
to also intensify, extend `criticalPieceIds`. (3) Non-Reactor block materials
are alpha-tinted from each theme's accents, not tuned on-device — validate
contrast against empty cells and rubble when a device is available.

## Phase 1 · P1-5 — Timer badges and piece contours

**Scope:** refine the timer badge and make each timed piece's ownership visually
unambiguous, without touching timer rules or values.

**Badge decisions:**

- All badge styling moved into a pure `getBadgeVisual(visualState, frozen,
theme)` (`src/ui/timerBadgeStyle.ts`), matching the `blockSurface` pattern;
  `TimerBadge` is now a thin consumer that keeps the numeral and pulse handling.
- **Exactly one badge per timed piece** is unchanged — it still comes from the
  domain selector `getTimerBadgePlacements` (topmost, then leftmost surviving
  cell), so it stays anchored after partial clears. No domain change.
- Dark center + tabular-nums numeral + theme-aware ring preserved and legible
  over every block color and theme.

**State handling (never color-only):**

- **normal** — thin `timerNormal` ring, static.
- **caution (3–4)** — calm thin amber ring, static (pre-warning).
- **warning (2)** — restrained amber, medium-weight ring, gentle pulse.
- **critical (1)** — `timerCritical` danger ring, **heavier and larger** badge,
  high glow, stronger pulse.
- **frozen** — icy `timerFrozen` ring, the only **dashed** ring, **static**
  (timers paused), labelled "frozen". Overrides the countdown emphasis.
- Distinctness is carried by ring width, badge size, and the dashed cue — not
  hue — so the states remain distinguishable for colorblind players. The block
  color beneath the badge is never changed.
- **Defused-transition** state is intentionally not a distinct badge look: a
  defuse removes the timer entirely, so no such metadata exists to drive it.

**Piece contour:**

- `GameBoard` computes each timed cell's boundary sides from the existing
  `pieceInstanceId` (adjacency only — no grouping reconstructed) and passes
  `contourEdges` to `GridCell`.
- `GridCell` strokes the piece's own `blockColor` accent on **outer sides only**
  (interior transparent), non-interactive. Internal shared sides are left
  unstroked so a multi-cell piece reads as one bounded group, distinct from a
  plain same-color block. It never covers block highlights, previews, rubble, or
  the badge numeral (those draw over it or sit on a higher layer).

**Motion / reduced motion:** pulse still routes through `getPulseConfig` (event/
state-driven, reduced-motion gated); the badge keys its loop on the resolved
`pulseState` primitive, so ordinary rerenders never retrigger it. Reduced motion
disables the repeated pulse while the static ring/size/dashed cues remain.

**Themes / accessibility:** one new `timerFrozen` token added to all five themes
(Reactor/Arctic/Magma/Void/Solar), verified distinct from each theme's other
timer hues. Accessibility labels describe remaining moves and announce "frozen"
when paused. Board geometry and tap/drag hit testing untouched (contour and
badge are `pointerEvents="none"`).

**Tests:** `timerBadgeStyle.test.ts` (new) — semantic ring colors, non-color
distinctness of the named states, frozen static + dashed + override, and a valid
distinct `timerFrozen` in every theme; `TimerBadge.test.tsx` — frozen shows a
dashed icy ring and announces "frozen" while keeping the numeral, solid ring
otherwise; `GameBoard.test.tsx` — contour only on timed cells with the internal
shared side unstroked, and freeze puts every badge into the frozen cue;
`GridCell.test.tsx` — contour strokes the accent on boundary sides only and is
non-interactive, none when unsupplied. Full suite: **82 suites / 468 tests**
green; coverage **89.71%** (`timerBadgeStyle` + `TimerBadge` 100%, `GridCell`
97.5%, `GameBoard` 96.55%).

**Verification:** typecheck ✅, lint ✅, test ✅, coverage ✅ 89.71%,
format:check ✅, expo-doctor ✅ 20/20, `expo export --platform android` ✅.

**Screenshot / device finding:** no Android device/emulator available, so
`docs/current game images/phase1-p5-timers-contours-after.jpg` was **not**
produced — recorded here, not fabricated. Android export succeeds. On-device
visual confirmation deferred.

**Risks:** (1) The contour adds one static per-timed-cell overlay View; timed
cells are few, so cost is negligible, but it stacks with P1-4's sheen sub-View
on the same cells — still no blur/animation. (2) The contour accent equals the
block edge color; on-device it should read as a heavier outline via width — if
it looks too subtle, lightening the contour tone or a dedicated `timerContour`
token is the follow-up. (3) Frozen is driven by the global freeze flag, so all
badges show frozen together (correct — freeze pauses all timers); if per-piece
freeze is ever added, thread a per-badge flag instead.
