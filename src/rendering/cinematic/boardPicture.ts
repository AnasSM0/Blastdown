import { alpha } from "./palette";
import type { CinematicPalette, SceneGeometry, SceneRect } from "./types";
import { boardCornerAccentRects } from "../../ui/boardChrome";

/** The static half of the board, as data.
 *
 *  Everything here depends only on `(geometry, palette)` — the recessed frame,
 *  the rim and shadow that make it a recess rather than a raised panel, the
 *  corner brackets, the etched grid, the empty cells, and the scanline
 *  ambience. None of it changes when a piece is placed, a timer ticks, or an
 *  effect plays. It changes when the board is resized or the theme is switched,
 *  and at no other time.
 *
 *  That is why it is emitted as a command list rather than drawn directly: the
 *  list is built once, cached, and replayed into a Skia `Picture`, so ~200 draw
 *  calls become one. And because it is a pure function returning plain data, the
 *  structure is testable — which matters here more than usual, since Skia draws
 *  nothing under jest and a canvas-only implementation would be verifiable only
 *  by looking at a phone.
 *
 *  Order is significant and is the drawing order: panel, recess, grid, cells,
 *  ambience, vignette, corners. */

export type DrawCommand =
  | {
      op: "rrect";
      rect: SceneRect;
      radius: number;
      color: string;
      style: "fill" | "stroke";
      strokeWidth?: number;
    }
  | {
      op: "rect";
      rect: SceneRect;
      color: string;
      style: "fill" | "stroke";
      strokeWidth?: number;
    }
  | { op: "line"; x1: number; y1: number; x2: number; y2: number; color: string; width: number };

/** Scanline spacing in px. Wide enough to read as texture rather than as a
 *  moiré pattern against the cell lattice, which is the failure mode of a
 *  scanline pitch close to the cell pitch. */
const SCANLINE_PITCH = 3;

export function boardDrawCommands(
  geometry: SceneGeometry,
  palette: CinematicPalette,
): DrawCommand[] {
  const commands: DrawCommand[] = [];
  const { boardSide, frameWidth, contentInset, cellSize, pitch, size, boardRadius, cellRadius } =
    geometry;

  if (cellSize <= 0 || boardSide <= 0) {
    return commands;
  }

  const outer: SceneRect = { x: 0, y: 0, width: boardSide, height: boardSide };

  // 1. The panel itself.
  commands.push({
    op: "rrect",
    rect: outer,
    radius: boardRadius,
    color: palette.boardBg,
    style: "fill",
  });

  // 2. The recess. A frame stroke, then a bright rim just inside its top edge
  //    and a dark shadow just inside its bottom edge. Light from above is what
  //    the eye reads as "sunk in"; reversing the two reads as "raised", which is
  //    the wrong illusion for a board pieces drop into.
  const half = frameWidth / 2;
  commands.push({
    op: "rrect",
    rect: { x: half, y: half, width: boardSide - frameWidth, height: boardSide - frameWidth },
    radius: boardRadius,
    color: palette.frame,
    style: "stroke",
    strokeWidth: frameWidth,
  });
  const inner: SceneRect = {
    x: frameWidth,
    y: frameWidth,
    width: boardSide - 2 * frameWidth,
    height: boardSide - 2 * frameWidth,
  };
  commands.push({
    op: "rrect",
    rect: inner,
    radius: Math.max(0, boardRadius - frameWidth),
    color: alpha(palette.frameShadow, 0.85),
    style: "stroke",
    strokeWidth: 1,
  });
  // The lit top edge: a horizontal hairline inset from both sides, so it reads
  // as a bevel catching light rather than as a second border.
  commands.push({
    op: "line",
    x1: frameWidth + boardRadius,
    y1: frameWidth + 0.5,
    x2: boardSide - frameWidth - boardRadius,
    y2: frameWidth + 0.5,
    color: alpha(palette.frameRim, 0.75),
    width: 1,
  });
  commands.push({
    op: "line",
    x1: frameWidth + boardRadius,
    y1: boardSide - frameWidth - 0.5,
    x2: boardSide - frameWidth - boardRadius,
    y2: boardSide - frameWidth - 0.5,
    color: alpha(palette.frameBevel, 0.35),
    width: 1,
  });

  // 3. The etched grid: one hairline down each gutter. Drawn beneath the cells
  //    so a cell's own border always wins where they meet.
  const span = (size - 1) * pitch + cellSize;
  for (let index = 1; index < size; index++) {
    const offset = contentInset + index * pitch - geometry.gutter / 2;
    commands.push({
      op: "line",
      x1: offset,
      y1: contentInset,
      x2: offset,
      y2: contentInset + span,
      color: palette.gridLine,
      width: 1,
    });
    commands.push({
      op: "line",
      x1: contentInset,
      y1: offset,
      x2: contentInset + span,
      y2: offset,
      color: palette.gridLine,
      width: 1,
    });
  }

  // 4. Empty cells. Static because "empty" is the board's resting state: a cell
  //    that gains a block is drawn OVER this by the dynamic layer, so the cached
  //    picture never needs rebuilding when a piece lands.
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const rect: SceneRect = {
        x: contentInset + column * pitch,
        y: contentInset + row * pitch,
        width: cellSize,
        height: cellSize,
      };
      commands.push({
        op: "rrect",
        rect,
        radius: cellRadius,
        color: palette.emptyCell,
        style: "fill",
      });
      commands.push({
        op: "rrect",
        rect,
        radius: cellRadius,
        color: palette.emptyCellBorder,
        style: "stroke",
        strokeWidth: 1,
      });
    }
  }

  // 5. Scanline ambience across the playable area only, so it never crosses the
  //    frame and break the recess illusion.
  for (let y = contentInset; y < contentInset + span; y += SCANLINE_PITCH) {
    commands.push({
      op: "line",
      x1: contentInset,
      y1: y,
      x2: contentInset + span,
      y2: y,
      color: palette.ambience,
      width: 1,
    });
  }

  // 6. Corner brackets, on top of everything static.
  for (const rect of boardCornerAccentRects(boardSide)) {
    commands.push({
      op: "rect",
      rect,
      color: alpha(palette.frameCorner, 0.85),
      style: "fill",
    });
  }

  return commands;
}
