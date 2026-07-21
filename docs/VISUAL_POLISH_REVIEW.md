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
