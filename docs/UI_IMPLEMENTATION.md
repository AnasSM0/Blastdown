# UI Implementation Mapping

> **Phase 0 audit status (2026-07-21).** This mapping is the original Stitch
> ingestion contract. Two things are now stale and are corrected in
> `docs/VISUAL_POLISH_REVIEW.md`: (1) **motion is implemented with React Native
> `Animated`, not Reanimated** — there are zero `react-native-reanimated`
> imports in the app (decision: `DECISIONS.md` 2026-07-20). Read every
> "Reanimated" mention below as "RN `Animated`". (2) The current gameplay build
> ships **outline-only blocks, board-colored empty cells, X-cross rubble, and a
> variable-count tray** — the UI Polish Phase 1 tasks in `docs/TASKS.md` bring
> these to the "Neon Reactor Premium" direction. The file-by-file ownership map
> lives in `docs/VISUAL_POLISH_REVIEW.md` §2.

How each visual element in the approved Stitch snapshot
(`docs/references/ui/stitch-mcp/`) becomes a React Native / Expo
implementation. This is the Part 6 deliverable of the Stitch design
ingestion: a translation contract, not implementation code — Codex builds
against this, `docs/STYLE_GUIDE.md`, `docs/ANIMATION_SPEC.md`, and the
existing domain interfaces; it does not read or import the Stitch HTML.

**Never do this** (repeating `BUILD_SPEC.md` §12.2 and the design-ingestion
task's explicit rules, because it's the most common way this kind of
reference snapshot gets misused):

- Do not embed any `source.html` in a `WebView`.
- Do not use a `screen.png` screenshot as an interactive gameplay
  background — screenshots are a visual reference for a human/Codex to
  read, never an asset shipped in the app.
- Do not copy DOM structure or class names out of `source.html` into
  Expo/JSX.
- Do not execute or port any `<script>` block from `source.html`.
- Do not add Tailwind (or `nativewind`) to the project just because the
  generated HTML happens to use Tailwind utility classes.
- Do not add `react-native-skia` because a screen has a glow effect —
  Reanimated + `View`/`shadow`/`elevation` covers everything in this
  snapshot (see the blur-performance note in `docs/UI_REFERENCE_AUDIT.md`
  item 9).

## Element-by-element mapping

| Web element (Stitch)                                                                                     | React Native implementation                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<div class="board-grid">` (8×8 CSS Grid)                                                                | `GameBoard` — a `View` laying out an 8×8 array of `GridCell`, sized from `GameState.grid` dimensions, not from any hardcoded pixel grid. Cell size computed at runtime from available width (`docs/STYLE_GUIDE.md`'s board geometry), not the mockups' literal 40px.                                                             |
| Each grid cell (`<div class="grid-cell">` / `.cell-border`)                                              | `GridCell` component — plain `View` with `borderWidth`, `backgroundColor`, `borderRadius` from `docs/STYLE_GUIDE.md`. No `backdrop-filter`.                                                                                                                                                                                      |
| Occupied cell "glass" look (`.glass-block`, blur + translucent bg + colored border)                      | Approximate with `View` + solid `rgba()` fill (no blur) + colored `borderWidth: 1` + `shadowColor/shadowOpacity/shadowRadius` (iOS) / `elevation` (Android) for the glow. See audit item 9 — this is a required deviation from the literal mockup, not optional.                                                                 |
| Timer badge (small floating circle with a digit)                                                         | `TimerBadge` — one instance per `ActiveTimedPiece`, rendered as a `View` positioned over the piece's topmost surviving cell (per the resolved convention in `docs/UI_REFERENCE_AUDIT.md` item 1) with a `Text` digit inside. Not repeated per cell.                                                                              |
| Ghost/ preview cells (dashed border, translucent fill)                                                   | Rendered by `GameBoard` from a `previewCells`/`isValidPreview` prop derived from the domain's placement-validity check (`src/domain/placement.ts` via a selector) — never recomputed in the component.                                                                                                                           |
| Invalid-placement conflict marker (red X icon on overlapping cell)                                       | An `Ionicons`/`MaterialIcons`-style vector icon (via `@expo/vector-icons`, already an Expo-bundled dependency) overlaid on the exact cell(s) where the attempted piece overlaps an occupied cell — not merely near it (audit item 1's overlap-alignment note).                                                                   |
| Piece tray (`tray-grid-3x3`, 3 slots)                                                                    | `PieceTray` renders exactly 3 `DraggablePiece` (or tap-select target, per the MVP's tap-first interaction) from `GameState.hand`. Bounding box size fixed per `docs/STYLE_GUIDE.md` (pick 64px, not the mockups' inconsistent 60/64px).                                                                                          |
| Piece shape inside a tray slot                                                                           | Rendered from the shape's `ShapeDefinition.cells` (relative coordinates) — never a static image, matching `BUILD_SPEC.md` §6.3's "do not store piece shapes as image assets."                                                                                                                                                    |
| Score header (`Best` / current score / Pause button)                                                     | `ScoreHeader` — plain `View`/`Text`/`Pressable` row. Current-score digits use the JetBrains Mono / `score-display-mobile` treatment from `docs/STYLE_GUIDE.md`; add the combo indicator here too (audit item 6), not as a floating overlay.                                                                                      |
| Combo indicator pill                                                                                     | `ComboIndicator` — small rounded `View` + `Text`, rendered only when `combo > 0`, placed in `ScoreHeader`, not absolutely positioned over the board.                                                                                                                                                                             |
| Power-up buttons (Freeze/Defuse, circular)                                                               | `RewardedActionButton` — circular `Pressable`, three visual states (available/idle, active/charged, disabled/exhausted) per audit item 5. Visibility/enabled state driven by `GameState.freezeTurnsRemaining`, `rewardedFreezeUses`, `rewardedDefuseUses`, and whether any `activeTimers` exist — never hardcoded visible.       |
| Home screen's circular Play button, glow border                                                          | `Pressable` with `borderWidth`/`borderColor` + shadow/elevation glow, `active:scale-95` translated to a Reanimated scale-down on press.                                                                                                                                                                                          |
| Pause / Game-Over / Second-Chance modal shell (scrim + centered panel)                                   | A shared `ModalOverlay` component: `View` with a semi-transparent background color (not blurred — see item 9) over the frozen last game frame, centered rounded panel. Reused by `PauseOverlay`, the revive modal, and any future full-screen dialog — one component, not one per screen.                                        |
| Final Results stat rows                                                                                  | `ResultsScreen` renders a fixed list of stat rows from the `GameState` run-summary fields (`piecesPlaced` — currently missing from the mockup, see audit item 4 — `linesCleared`, `piecesDefused`, `explosions`, `rubbleCleared`, `bestCombo`, bolts earned), not hardcoded strings.                                             |
| Tutorial step captions                                                                                   | Use the exact wording from `BUILD_SPEC.md` §9 (six scripted messages), not whatever placeholder copy a given Stitch tutorial screen happens to show — the mockups model layout/visual state, not final microcopy.                                                                                                                |
| Material Symbols icons (`ac_unit`, `bolt`, `pause`, `settings`, `trophy`, `replay`, `leaderboard`, etc.) | `@expo/vector-icons` (`MaterialIcons` set has equivalents for all of these except a couple; confirm per-icon during implementation). Never rely on a web font ligature rendering as literal text if it fails to load — vector icon components don't have that failure mode. Drop the `leaderboard` icon entirely (audit item 3). |
| Fonts (Geist, JetBrains Mono)                                                                            | Load via `expo-font` at app startup (`useFonts` in the root layout), referenced by family name in `StyleSheet`, not loaded per-screen.                                                                                                                                                                                           |
| Explosion/defuse animation sequence (sweep-illuminate → crack → particles → floating score)              | Reanimated shared values driving `View`/`Text` transforms and opacity; see `docs/ANIMATION_SPEC.md` for the extracted timing curve per stage. No CSS, no DOM particles — a small, capped number (`BUILD_SPEC.md` §18 "cap explosion particles") of `Animated.View` dots.                                                         |
| Line-clear sweep bar                                                                                     | A single `Animated.View` gradient bar translating across the cleared row/column, matching the `rowSweepAnim` timing in `docs/ANIMATION_SPEC.md`.                                                                                                                                                                                 |
| Rubble cell visual                                                                                       | Not present in any approved screen (audit item 12) — implement per `docs/STYLE_GUIDE.md`'s proposed placeholder (desaturated frame color + crack overlay) until a real screen is approved; flag to revisit once Stitch produces one.                                                                                             |

## Screens vs. routes

| Approved screen(s)                                         | Route (`app/`)                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `11-home`                                                  | `app/index.tsx`                                                                                                                            |
| `01`, `02`, `03`, `04`, `05`, `07`, `09` (gameplay states) | `app/game.tsx`, various states of the same screen driven by `GameState.status` and event flags — not separate routes per state             |
| `06-results`                                               | `app/results.tsx`                                                                                                                          |
| `08-game-over-revive`, `10-second-chance`                  | Rendered as an overlay/modal on `app/game.tsx` when `status === "awaitingRevive"`/immediately after a granted revive, not a separate route |
| `12-pause`                                                 | Overlay on `app/game.tsx` when `status === "paused"`, not a separate route                                                                 |
| `13`, `14`, `15` (tutorial)                                | `app/tutorial.tsx`                                                                                                                         |
| `16-developer-handoff`                                     | Not a route — design-token reference only                                                                                                  |

## Open items requiring a decision before Codex starts

See `docs/UI_REFERENCE_AUDIT.md` items 1, 5, 6, 8 and
`docs/STYLE_GUIDE.md`'s "unresolved" notes. Record each resolution in
`docs/DECISIONS.md` before assigning the corresponding Codex task in
`docs/TASKS.md`.
