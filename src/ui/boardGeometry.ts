import type { CellPosition } from "../domain/placement";
import { DRAG_HYSTERESIS_RATIO } from "./pieceInteraction";
import { spacing } from "./theme";

/** Outer frame border width of the rendered board (px). */
export const FRAME_WIDTH = 2;

/** Frame + gutter offset from the board's outer edge to the first cell's edge.
 *  Lives here, in the neutral geometry module, so both the board and the
 *  effects overlay can share it without importing the GameBoard barrel (which
 *  would form a require cycle). Must stay in sync with the board's box model. */
export const BOARD_CONTENT_INSET = FRAME_WIDTH + spacing.gridGutter;

/** Absolute (window-space) geometry of the rendered board's playable content
 *  area, measured at runtime — never hardcoded device pixels. Produced by the
 *  game screen from the board's `measureInWindow` result plus the cell size the
 *  board computed from its own measured width. */
export type BoardLayout = {
  /** Left edge of the first column's cell, in window coordinates. */
  contentLeft: number;
  /** Top edge of the first row's cell, in window coordinates. */
  contentTop: number;
  /** Cell edge length in px. */
  cellSize: number;
  /** Distance between adjacent cell origins (cellSize + gutter). */
  pitch: number;
  /** Number of rows/columns (square board). */
  size: number;
};

export type Point = { x: number; y: number };

/** Map an absolute window point to the board cell containing it, or `null`
 *  when the point is outside the playable content area. Pure — the same input
 *  always yields the same cell, so drag mapping is testable without gestures. */
export function cellFromPoint(point: Point, layout: BoardLayout): CellPosition | null {
  const { contentLeft, contentTop, pitch, size } = layout;
  if (pitch <= 0 || size <= 0) {
    return null;
  }
  const relX = point.x - contentLeft;
  const relY = point.y - contentTop;
  if (relX < 0 || relY < 0) {
    return null;
  }
  const column = Math.floor(relX / pitch);
  const row = Math.floor(relY / pitch);
  if (row < 0 || row >= size || column < 0 || column >= size) {
    return null;
  }
  return { row, column };
}

/** Map a finger point to the board origin (top-left cell) for a dragged
 *  piece, accounting for the ghost being centered horizontally on the finger
 *  and floated `lift` px above it. The returned cell is where the shape's
 *  (0,0) cell would land, so the live preview aligns with the visible ghost.
 *  Returns `null` when that origin falls outside the board. */
export function dragOriginFromFinger(
  point: Point,
  shapeBounds: { maxRow: number; maxColumn: number },
  lift: number,
  layout: BoardLayout,
): CellPosition | null {
  const { cellSize, pitch } = layout;
  const gutter = pitch - cellSize;
  const width = (shapeBounds.maxColumn + 1) * pitch - gutter;
  const height = (shapeBounds.maxRow + 1) * pitch - gutter;
  const firstCellCenter: Point = {
    x: point.x - width / 2 + cellSize / 2,
    y: point.y - lift - height + cellSize / 2,
  };
  return cellFromPoint(firstCellCenter, layout);
}

/** Inverse of `dragOriginFromFinger` for the visual ghost. The returned point
 * positions the ghost so its (0,0) cell aligns exactly with `origin`, while the
 * logical placement remains expressed solely in board cells. */
export function fingerPointForDragOrigin(
  origin: CellPosition,
  shapeBounds: { maxRow: number; maxColumn: number },
  lift: number,
  layout: BoardLayout,
): Point {
  const { cellSize, pitch, contentLeft, contentTop } = layout;
  const gutter = pitch - cellSize;
  const width = (shapeBounds.maxColumn + 1) * pitch - gutter;
  const height = (shapeBounds.maxRow + 1) * pitch - gutter;
  return {
    x: contentLeft + origin.column * pitch + width / 2,
    y: contentTop + origin.row * pitch + lift + height,
  };
}

/**
 * Spatial hysteresis for boundary noise. A previous anchor remains selected in
 * a narrow, cell-relative band; crossing farther than that resolves the new
 * anchor immediately. There is no timer and deliberate placement stays exact.
 */
export function stableDragOriginFromFinger(
  point: Point,
  shapeBounds: { maxRow: number; maxColumn: number },
  lift: number,
  layout: BoardLayout,
  previous: CellPosition | null,
): CellPosition | null {
  const raw = dragOriginFromFinger(point, shapeBounds, lift, layout);
  if (!previous || layout.pitch <= 0) {
    return raw;
  }

  const { cellSize, pitch, contentLeft, contentTop } = layout;
  const gutter = pitch - cellSize;
  const width = (shapeBounds.maxColumn + 1) * pitch - gutter;
  const height = (shapeBounds.maxRow + 1) * pitch - gutter;
  const firstCellCenter = {
    x: point.x - width / 2 + cellSize / 2,
    y: point.y - lift - height + cellSize / 2,
  };
  const margin = pitch * DRAG_HYSTERESIS_RATIO;
  const previousLeft = contentLeft + previous.column * pitch;
  const previousTop = contentTop + previous.row * pitch;
  const withinPreviousColumn =
    firstCellCenter.x >= previousLeft - margin && firstCellCenter.x < previousLeft + pitch + margin;
  const withinPreviousRow =
    firstCellCenter.y >= previousTop - margin && firstCellCenter.y < previousTop + pitch + margin;

  return withinPreviousColumn && withinPreviousRow ? previous : raw;
}
