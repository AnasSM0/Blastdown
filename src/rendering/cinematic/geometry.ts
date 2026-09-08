import { BOARD_CONTENT_INSET, FRAME_WIDTH } from "../../ui/boardGeometry";
import { radius, spacing } from "../../ui/theme";
import type { SceneGeometry, SceneRect } from "./types";

/** Board box model, reproduced exactly.
 *
 *  Every number here is derived from the same constants the React Native
 *  `GameBoard` uses, in the same order, because the drag system maps finger
 *  coordinates to cells through `src/ui/boardGeometry.ts` using those constants
 *  — not through whatever the renderer happens to draw. If the canvas drew cells
 *  on a different lattice, the board a player sees and the board they place onto
 *  would quietly disagree, and every drop would land a fraction of a cell from
 *  where it looked like it would.
 *
 *  That is why this module has no tuning constants of its own and why
 *  `__tests__/rendering/cinematicGeometry.test.ts` asserts cell rects against
 *  `cellFromPoint` round trips rather than against expected pixel values: the
 *  test asks "does a point inside this drawn rect map back to this cell", which
 *  is the property that actually matters. */

/** Resolve the board's geometry from its outer size. Returns `cellSize: 0` when
 *  the board has not been measured yet, which every layer treats as "draw
 *  nothing" — the same guard the React Native board uses. */
export function sceneGeometry(boardSide: number, size: number): SceneGeometry {
  const gutter = spacing.gridGutter;
  const contentSize = boardSide - 2 * BOARD_CONTENT_INSET;
  const cellSize = size > 0 && contentSize > 0 ? (contentSize - (size - 1) * gutter) / size : 0;
  return {
    size,
    boardSide,
    frameWidth: FRAME_WIDTH,
    contentInset: BOARD_CONTENT_INSET,
    cellSize,
    pitch: cellSize + gutter,
    gutter,
    boardRadius: radius.board,
    cellRadius: radius.cell,
  };
}

/** Canvas-local rectangle of one cell. */
export function cellRect(geometry: SceneGeometry, row: number, column: number): SceneRect {
  const { contentInset, pitch, cellSize } = geometry;
  return {
    x: contentInset + column * pitch,
    y: contentInset + row * pitch,
    width: cellSize,
    height: cellSize,
  };
}

/** Badge circle bounds for a piece anchored at (row, column).
 *
 *  The React Native board positions the badge with a wrapper offset of -8 px on
 *  both axes from the cell origin, then draws a circle of `visual.size` inside
 *  it. Both renderers therefore hang the badge off the cell's top-left corner
 *  by the same 8 px, and a badge that grows for the urgent state grows down and
 *  right from that fixed anchor rather than about its own centre — which is
 *  what keeps the size emphasis from looking like a jump. */
const BADGE_ANCHOR_OFFSET = 8;

export function badgeRect(
  geometry: SceneGeometry,
  row: number,
  column: number,
  badgeSize: number,
): SceneRect {
  const cell = cellRect(geometry, row, column);
  return {
    x: cell.x - BADGE_ANCHOR_OFFSET,
    y: cell.y - BADGE_ANCHOR_OFFSET,
    width: badgeSize,
    height: badgeSize,
  };
}

/** Centre point of a rect — used by rings, bursts and numerals. */
export function rectCenter(rect: SceneRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Canvas-local rectangle spanning a whole row or column of cells, gutters
 *  included. The line-clear sweep travels along this. */
export function laneRect(
  geometry: SceneGeometry,
  orientation: "row" | "column",
  index: number,
): SceneRect {
  const { contentInset, pitch, cellSize, size } = geometry;
  const span = (size - 1) * pitch + cellSize;
  return orientation === "row"
    ? { x: contentInset, y: contentInset + index * pitch, width: span, height: cellSize }
    : { x: contentInset + index * pitch, y: contentInset, width: cellSize, height: span };
}
