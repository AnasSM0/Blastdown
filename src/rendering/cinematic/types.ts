import type { BadgeVisual } from "../../components/TimerBadge/timerBadgeStyle";
import type { RubbleGeometry } from "../../components/RubbleSurface/rubbleGeometry";
import type { BlockSurfaceStyle } from "../../ui/blockSurface";
import type { TimerVisualState } from "../../ui/timerStates";

/** The renderer contract.
 *
 *  A `BoardScene` is a complete, immutable description of one frame of the
 *  board: every colour resolved, every rectangle in canvas pixels, nothing left
 *  to look up. The canvas walks it and draws. It never reads game state, theme,
 *  or geometry itself.
 *
 *  Three properties are load-bearing, and the tests pin all three:
 *
 *  1. **It is pure.** `buildBoardScene` is a function of its inputs, so the
 *     entire "what should the board look like" question is testable without a
 *     canvas — which matters more than usual here, because Skia draws nothing
 *     under jest (see `test-utils/skiaMock.tsx`). Parity between the two
 *     renderers is asserted against this structure, not against pixels.
 *
 *  2. **It carries no motion.** Every animated quantity is a Reanimated shared
 *     value living outside the scene. If a value changed per frame and lived
 *     here, the scene object would be rebuilt per frame and React would
 *     re-render sixty times a second — the exact cost this renderer exists to
 *     remove. The scene changes when the GAME changes, which is a few times per
 *     second at most, and usually far less.
 *
 *  3. **It owns no hit testing.** Touch and accessibility stay on real React
 *     Native views layered over the canvas. A canvas is one view to the
 *     platform: it has no per-cell accessibility node and no per-cell touch
 *     target, and this game's documented accessibility fallback is
 *     tap-to-select then tap-to-place (`docs/GAME_RULES.md`), with per-cell
 *     labels and placement hints that `docs/ACCESSIBILITY.md` treats as
 *     shipped behaviour. Drawing moved; interaction did not. */

/** A rectangle in canvas-local pixels. */
export type SceneRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** One drawn block — a placed piece cell, timed or untimed.
 *
 *  `surface` is the same `BlockSurfaceStyle` the React Native renderer composes
 *  into its views, produced by the same `blockSurface()` call. Sharing the
 *  source rather than re-deriving it is what makes "the two renderers agree"
 *  a fact about the code instead of a hope: a change to the block material
 *  moves both renderers at once, and the parity test compares this field. */
export type SceneBlock = {
  row: number;
  column: number;
  rect: SceneRect;
  /** Resolved themed hue for this block's `colorId`. */
  accent: string;
  surface: BlockSurfaceStyle;
  /** Boundary sides within the owning timed piece, packed as the existing
   *  `contourMaskOf` bitmask. Undefined for untimed blocks, which have no
   *  piece silhouette to trace. */
  contourMask: number | undefined;
  /** Rewarded-defuse target ring. */
  highlighted: boolean;
};

/** One rubble cell, with the deterministic damage layout the React Native
 *  renderer draws — same `getRubbleGeometry(row, column)`, so a given cell
 *  cracks identically in both renderers and across sessions. */
export type SceneRubble = {
  row: number;
  column: number;
  rect: SceneRect;
  geometry: RubbleGeometry;
};

export type ScenePreviewState = "valid" | "invalid" | "conflict";

/** A ghost cell of the piece under the finger. */
export type ScenePreview = {
  row: number;
  column: number;
  rect: SceneRect;
  state: ScenePreviewState;
  surface: BlockSurfaceStyle;
};

/** A timer countdown drawn on its piece's badge cell.
 *
 *  The numeral is drawn, never implied: `docs/GAME_RULES.md` requires the number
 *  itself always be visible ("never rely on color alone"), so `value` is
 *  rendered as text and `state`/`frozen` only decide its treatment. */
export type SceneNumeral = {
  pieceId: string;
  row: number;
  column: number;
  /** Badge circle bounds, anchored on the piece's badge cell. */
  rect: SceneRect;
  value: number;
  state: TimerVisualState;
  frozen: boolean;
  /** The badge's look, from the same `getBadgeVisual()` the React Native badge
   *  uses — so ring weight, dash, size emphasis and glow match, and the
   *  non-colour state cues `docs/GAME_RULES.md` requires survive the port. */
  visual: BadgeVisual;
};

/** Empty cells. Drawn as part of the cached board picture where possible — they
 *  only change when the board size or theme changes, not per turn. */
export type SceneEmptyCell = {
  row: number;
  column: number;
  rect: SceneRect;
};

/** Colours the canvas draws with, resolved once from the active theme. Kept
 *  separate from `ThemePalette` so the canvas never reaches into theme internals
 *  and so the derived cinematic tones (rim, bevel, scanline, vignette) have one
 *  definition rather than being recomputed at each draw site. */
export type CinematicPalette = {
  /** Board panel fill, beneath everything. */
  boardBg: string;
  /** Outer frame body. */
  frame: string;
  /** Bright inner rim, the top edge of the recess. */
  frameRim: string;
  /** Dark inner shadow, the bottom edge of the recess. */
  frameShadow: string;
  /** Fine bevel highlight along the frame's top inner edge. */
  frameBevel: string;
  /** Corner bracket stroke. */
  frameCorner: string;
  /** Empty cell fill and its hairline border. */
  emptyCell: string;
  emptyCellBorder: string;
  /** Faint grid hairline drawn in the gutters. */
  gridLine: string;
  /** Scanline / noise ambience colour. Very low alpha by construction. */
  ambience: string;
  /** Corner darkening that seats the board into the screen. */
  vignette: string;
  /** Board light-breathing tint. */
  breath: string;
  /** Rubble tones, straight from the theme so both renderers match. */
  rubbleFill: string;
  rubbleEdge: string;
  rubbleFacet: string;
  rubbleCrack: string;
  rubbleFissure: string;
  /** Accent used by previews, highlights and sweeps. */
  accent: string;
  /** Danger hue for invalid previews and urgent timers. */
  danger: string;
  /** Timer badge tones by visual state. */
  timerNormal: string;
  timerWarning: string;
  timerCritical: string;
  timerFrozen: string;
  /** Badge interior, behind the numeral. */
  badgeBg: string;
  /** Numeral colour. */
  onSurface: string;
  /** Theme glow multiplier (1 = the Reactor baseline). */
  glow: number;
};

/** Geometry shared by every layer, so the frame, the cells, the effects and the
 *  touch overlay all derive positions from one source. Reproducing the React
 *  Native renderer's box model exactly is a hard requirement, not a nicety: the
 *  drag mapping in `src/ui/boardGeometry.ts` converts finger coordinates to
 *  cells using these same numbers, and a canvas that drew cells even a pixel off
 *  would put the visible board out of step with where pieces actually land. */
export type SceneGeometry = {
  /** Cells per side (8). */
  size: number;
  /** Outer edge length of the board view, in px. */
  boardSide: number;
  /** Frame border width. */
  frameWidth: number;
  /** Frame + gutter distance from the outer edge to the first cell. */
  contentInset: number;
  /** Cell edge length. */
  cellSize: number;
  /** Distance between adjacent cell origins (cellSize + gutter). */
  pitch: number;
  /** Gap between cells. */
  gutter: number;
  /** Corner radius of the board. */
  boardRadius: number;
  /** Corner radius of a cell. */
  cellRadius: number;
};

export type BoardScene = {
  geometry: SceneGeometry;
  palette: CinematicPalette;
  empties: readonly SceneEmptyCell[];
  blocks: readonly SceneBlock[];
  rubble: readonly SceneRubble[];
  preview: readonly ScenePreview[];
  numerals: readonly SceneNumeral[];
  /** True while the run's rewarded freeze is active. */
  frozen: boolean;
  /** Effective reduced motion. Part of the scene because it changes what is
   *  DRAWN (trails, travelling particles and shake are omitted, and event
   *  effects fall back to opacity emphasis), not only how fast. */
  reducedMotion: boolean;
};

/** Inputs to `buildBoardScene`. Deliberately the same values the React Native
 *  `GameBoard` already receives, so the game screen feeds both renderers from
 *  one place and neither can drift onto a private data path. */
export type BoardSceneInput = {
  grid: readonly (readonly import("../../domain/gameTypes").GridCell[])[];
  badges: readonly import("../../domain/selectors").TimerBadgePlacement[];
  preview: import("../../domain/selectors").PlacementPreview | null | undefined;
  theme: import("../../ui/themes").ThemePalette;
  /** Geometry and palette are supplied by the caller rather than derived here,
   *  and their IDENTITY is load-bearing. The cached board `Picture` is memoized
   *  on them; if the scene minted fresh objects each time it ran, that cache
   *  would miss on every turn and the whole point of baking the static board
   *  would be lost. The caller memoizes them on what they actually depend on —
   *  the board size and the theme — so they change on a resize or a theme
   *  switch and at no other time. */
  geometry: SceneGeometry;
  palette: CinematicPalette;
  highlightPieceId: string | null | undefined;
  frozen: boolean;
  reducedMotion: boolean;
};
