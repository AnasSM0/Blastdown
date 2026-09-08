import { contourMaskOf, type CellEdges } from "../../components/GridCell";
import { getRubbleGeometry } from "../../components/RubbleSurface/rubbleGeometry";
import { getBadgeVisual } from "../../components/TimerBadge/timerBadgeStyle";
import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import type { PlacementPreview } from "../../domain/selectors";
import { blockSurface, type BlockVariant } from "../../ui/blockSurface";
import { blockColor, type ThemePalette } from "../../ui/themes";
import { getTimerVisualState } from "../../ui/timerStates";
import { preClearVisual } from "../../ui/preClearPreview";
import { badgeRect, cellRect, laneRect } from "./geometry";
import type {
  BoardScene,
  BoardSceneInput,
  SceneBlock,
  SceneGeometry,
  SceneNumeral,
  ScenePreview,
  ScenePreviewState,
  ScenePreClearHighlight,
  SceneRubble,
} from "./types";

/** The renderer adapter: authoritative game state in, one immutable frame
 *  description out.
 *
 *  This is the only place the cinematic renderer reads game state, and it reads
 *  it exactly as the React Native `GameBoard` does — same inputs, same derived
 *  sets, same shared helpers (`blockSurface`, `getBadgeVisual`,
 *  `getRubbleGeometry`, `contourMaskOf`, `getTimerVisualState`). Reusing those
 *  helpers rather than reimplementing them is what makes renderer parity a
 *  structural property: there is no second definition of what a critical block
 *  looks like that could drift from the first.
 *
 *  It is pure and allocation-bounded: one pass over the grid, no closures kept,
 *  no reads of anything but its arguments. Callers memoize it on the inputs that
 *  actually change, so a frame of animation never rebuilds it. */

/** Boundary sides of a timed cell within its piece — a side is a boundary when
 *  the neighbour is not the same timed piece. Identical to the React Native
 *  board's own `contourEdgesFor`; kept in step by
 *  `__tests__/rendering/cinematicParity.test.ts`, which compares the two. */
function contourEdgesFor(
  grid: readonly (readonly DomainGridCell[])[],
  row: number,
  column: number,
): CellEdges | undefined {
  const cell = grid[row][column];
  if (cell.kind !== "timed") {
    return undefined;
  }
  const id = cell.pieceInstanceId;
  const samePiece = (r: number, c: number): boolean => {
    const neighbor = grid[r]?.[c];
    return neighbor?.kind === "timed" && neighbor.pieceInstanceId === id;
  };
  return {
    top: !samePiece(row - 1, column),
    right: !samePiece(row, column + 1),
    bottom: !samePiece(row + 1, column),
    left: !samePiece(row, column - 1),
  };
}

const PREVIEW_VARIANT: Record<ScenePreviewState, BlockVariant> = {
  valid: "previewValid",
  invalid: "previewInvalid",
  conflict: "previewConflict",
};

export function buildBoardScene(input: BoardSceneInput): BoardScene {
  const { grid, badges, theme, geometry, palette, highlightPieceId, frozen, reducedMotion } = input;
  const size = grid.length;

  const blocks: SceneBlock[] = [];
  const rubble: SceneRubble[] = [];
  const numerals: SceneNumeral[] = [];

  // Nothing is measurable before layout. Returning an empty scene rather than a
  // half-built one keeps the "board not ready" case identical in both renderers.
  if (geometry.cellSize <= 0) {
    return { geometry, palette, blocks, rubble, numerals, frozen, reducedMotion };
  }

  // Pieces whose countdown is urgent get the "critical" block material. Derived
  // from the badge data the screen already computed — the renderer never
  // re-derives a gameplay fact.
  const criticalPieceIds = new Set(
    badges
      .filter((badge) => getTimerVisualState(badge.remainingTurns) === "urgent")
      .map((badge) => badge.pieceId),
  );

  for (let row = 0; row < size; row++) {
    const rowCells = grid[row];
    for (let column = 0; column < rowCells.length; column++) {
      const cell = rowCells[column];
      // Empty cells are not described here: they are baked into the cached
      // board picture, which is why they cost nothing per turn. Building scene
      // objects for them was 128 allocations per rebuild that nothing drew.
      if (cell.kind === "empty") {
        continue;
      }
      const rect = cellRect(geometry, row, column);
      switch (cell.kind) {
        case "rubble":
          rubble.push({ row, column, rect, geometry: getRubbleGeometry(row, column) });
          break;
        case "timed":
        case "normal": {
          const accent = blockColor(theme, cell.colorId);
          const critical = cell.kind === "timed" && criticalPieceIds.has(cell.pieceInstanceId);
          const edges = contourEdgesFor(grid, row, column);
          blocks.push({
            row,
            column,
            rect,
            accent,
            surface: blockSurface(theme, accent, critical ? "critical" : "normal"),
            contourMask: edges ? contourMaskOf(edges) : undefined,
            highlighted:
              highlightPieceId != null &&
              cell.kind === "timed" &&
              cell.pieceInstanceId === highlightPieceId,
          });
          break;
        }
      }
    }
  }

  for (const badge of badges) {
    const state = getTimerVisualState(badge.remainingTurns);
    const visual = getBadgeVisual(state, frozen, theme);
    numerals.push({
      pieceId: badge.pieceId,
      row: badge.position.row,
      column: badge.position.column,
      rect: badgeRect(geometry, badge.position.row, badge.position.column, visual.size),
      value: badge.remainingTurns,
      state,
      frozen,
      visual,
    });
  }

  return { geometry, palette, blocks, rubble, numerals, frozen, reducedMotion };
}

/** The placement ghost for the piece under the finger.
 *
 *  Separate from `buildBoardScene` because it is the only thing that changes
 *  during a drag — see `PreviewScene` for why that matters. Pure, and cheap:
 *  a shape covers at most four cells.
 *
 *  Conflicts are applied AFTER the base ghost so an overlapping cell takes the
 *  stronger treatment. The domain reports a conflicting cell in both lists, so
 *  the reverse order would silently downgrade an overlap to an ordinary invalid
 *  ghost — and an overlap is the case a player most needs to see. */
export function buildPreviewCells(
  preview: PlacementPreview | null | undefined,
  geometry: SceneGeometry,
  theme: ThemePalette,
): ScenePreview[] {
  if (!preview || geometry.cellSize <= 0) {
    return EMPTY_PREVIEW;
  }

  const states = new Map<string, ScenePreviewState>();
  for (const cell of preview.cells) {
    states.set(`${cell.row},${cell.column}`, preview.valid ? "valid" : "invalid");
  }
  for (const cell of preview.conflictCells) {
    states.set(`${cell.row},${cell.column}`, "conflict");
  }

  const cells: ScenePreview[] = [];
  for (const [key, state] of states) {
    const [row, column] = key.split(",").map(Number);
    // Valid ghosts take the theme accent; invalid and conflicting ones take the
    // danger hue AND a dashed edge, so "can't place here" is never signalled by
    // colour alone.
    const accent = state === "valid" ? theme.accent : theme.timerCritical;
    cells.push({
      row,
      column,
      rect: cellRect(geometry, row, column),
      state,
      surface: blockSurface(theme, accent, PREVIEW_VARIANT[state]),
    });
  }
  return cells;
}

/** Shared empty result, so "no piece held" — the common case — allocates
 *  nothing and keeps a stable identity the memoized preview layer can skip. */
const EMPTY_PREVIEW: ScenePreview[] = [];

/** Full lanes predicted by the pure domain preview. Kept separate from both the
 * static board and the placement ghost so crossing a logical anchor rebuilds
 * only these bounded arrays (at most eight rows plus eight columns). */
export function buildPreClearHighlights(
  preview: PlacementPreview | null | undefined,
  geometry: SceneGeometry,
  theme: ThemePalette,
): readonly ScenePreClearHighlight[] {
  if (!preview?.valid || geometry.cellSize <= 0) {
    return EMPTY_PRE_CLEAR;
  }
  const visual = preClearVisual(theme);
  return [
    ...preview.clear.rows.map((index): ScenePreClearHighlight => ({
      orientation: "row",
      index,
      rect: laneRect(geometry, "row", index),
      visual,
    })),
    ...preview.clear.columns.map((index): ScenePreClearHighlight => ({
      orientation: "column",
      index,
      rect: laneRect(geometry, "column", index),
      visual,
    })),
  ];
}

const EMPTY_PRE_CLEAR: readonly ScenePreClearHighlight[] = [];
