import { BOARD_CONTENT_INSET } from "./boardGeometry";

export type BoardChromeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Decorative corner brackets stay entirely in the frame/gutter zone.
 *
 * The playable grid starts at `BOARD_CONTENT_INSET`. Keeping the bracket's
 * thickness one pixel clear of that boundary prevents edge-row and edge-column
 * clear lanes from reading as if a fragment survived at a corner. Length runs
 * along the perimeter and therefore does not reduce the playable area. */
export const BOARD_CORNER_ACCENT_LENGTH = 12;
export const BOARD_CORNER_ACCENT_THICKNESS = 2;
export const BOARD_CORNER_ACCENT_INSET = Math.max(
  0,
  BOARD_CONTENT_INSET - BOARD_CORNER_ACCENT_THICKNESS - 1,
);

/** Eight rectangles (horizontal + vertical at each corner), in stable order. */
export function boardCornerAccentRects(boardSide: number): readonly BoardChromeRect[] {
  const inset = BOARD_CORNER_ACCENT_INSET;
  const length = BOARD_CORNER_ACCENT_LENGTH;
  const thickness = BOARD_CORNER_ACCENT_THICKNESS;
  return [
    { x: inset, y: inset, width: length, height: thickness },
    { x: inset, y: inset, width: thickness, height: length },
    { x: boardSide - inset - length, y: inset, width: length, height: thickness },
    { x: boardSide - inset - thickness, y: inset, width: thickness, height: length },
    { x: inset, y: boardSide - inset - thickness, width: length, height: thickness },
    { x: inset, y: boardSide - inset - length, width: thickness, height: length },
    {
      x: boardSide - inset - length,
      y: boardSide - inset - thickness,
      width: length,
      height: thickness,
    },
    {
      x: boardSide - inset - thickness,
      y: boardSide - inset - length,
      width: thickness,
      height: length,
    },
  ];
}
