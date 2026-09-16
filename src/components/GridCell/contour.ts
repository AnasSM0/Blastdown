/** Which sides of a timed cell sit on the outer boundary of its piece — a side
 *  is a boundary when its neighbor is not part of the same timed piece. Drives
 *  the piece contour. Computed by the board from existing piece metadata. */
export type CellEdges = { top: boolean; right: boolean; bottom: boolean; left: boolean };

/** The same four sides packed into one number, so the prop is a primitive and a
 *  cell can be memoized (a fresh `CellEdges` object every render would defeat
 *  `memo` on every timed cell).
 *
 *  A leaf module on purpose: the cinematic renderer needs the bitmask to trace a
 *  piece silhouette, and importing it from the component would pull GridCell,
 *  BlockSurface and RubbleSurface into the Skia module graph for four integers. */
export const CONTOUR_TOP = 1;
export const CONTOUR_RIGHT = 2;
export const CONTOUR_BOTTOM = 4;
export const CONTOUR_LEFT = 8;

export function contourMaskOf(edges: CellEdges): number {
  return (
    (edges.top ? CONTOUR_TOP : 0) |
    (edges.right ? CONTOUR_RIGHT : 0) |
    (edges.bottom ? CONTOUR_BOTTOM : 0) |
    (edges.left ? CONTOUR_LEFT : 0)
  );
}
