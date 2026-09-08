import { cellRect, laneRect, sceneGeometry } from "../../src/rendering/cinematic/geometry";
import { cellFromPoint, type BoardLayout } from "../../src/ui/boardGeometry";

/** Geometry parity is the one place a rendering bug becomes a GAMEPLAY bug.
 *
 *  Dragging maps finger coordinates to cells through `cellFromPoint`, using the
 *  board's measured layout — not through anything the renderer draws. So if the
 *  canvas drew its cells on a lattice even slightly different from that one, the
 *  board a player sees and the board they place onto would disagree, and pieces
 *  would land beside where they looked like they would.
 *
 *  These tests therefore assert the round trip rather than expected pixel
 *  values: a point inside the rect the canvas draws for cell (r, c) must map
 *  back to cell (r, c). That is the property that matters, and unlike a table of
 *  numbers it stays true if the board's box model is ever legitimately retuned. */

const SIZES = [280, 320, 328, 360, 390, 420];

describe("a point inside a drawn cell maps back to that cell", () => {
  it.each(SIZES)("board side %ipx", (boardSide) => {
    const geometry = sceneGeometry(boardSide, 8);
    const layout: BoardLayout = {
      // The screen builds this from the board's measured window position; at
      // origin (0, 0) window space and canvas space coincide, which is what
      // makes the two coordinate systems directly comparable here.
      contentLeft: geometry.contentInset,
      contentTop: geometry.contentInset,
      cellSize: geometry.cellSize,
      pitch: geometry.pitch,
      size: 8,
    };

    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        const rect = cellRect(geometry, row, column);
        const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        expect(cellFromPoint(center, layout)).toEqual({ row, column });
      }
    }
  });

  it("keeps the mapping correct at the very edges of a cell, not only its centre", () => {
    const geometry = sceneGeometry(328, 8);
    const layout: BoardLayout = {
      contentLeft: geometry.contentInset,
      contentTop: geometry.contentInset,
      cellSize: geometry.cellSize,
      pitch: geometry.pitch,
      size: 8,
    };
    const rect = cellRect(geometry, 4, 5);

    // A drag released a hair inside a cell's own border must not resolve to its
    // neighbour. The gutter gives ~2px of slack; this checks the drawn rect sits
    // inside the mapped cell rather than straddling the boundary.
    expect(cellFromPoint({ x: rect.x + 0.5, y: rect.y + 0.5 }, layout)).toEqual({
      row: 4,
      column: 5,
    });
    expect(
      cellFromPoint({ x: rect.x + rect.width - 0.5, y: rect.y + rect.height - 0.5 }, layout),
    ).toEqual({ row: 4, column: 5 });
  });
});

describe("the cell lattice", () => {
  it("fits the content box exactly, with no drift accumulated across the row", () => {
    const geometry = sceneGeometry(328, 8);
    const last = cellRect(geometry, 7, 7);

    // The right edge of the last cell must land on the content box's right edge.
    // Accumulating position as `inset + index * pitch` rather than by repeated
    // addition is what keeps this exact at fractional cell sizes.
    expect(last.x + last.width).toBeCloseTo(328 - geometry.contentInset, 6);
    expect(last.y + last.height).toBeCloseTo(328 - geometry.contentInset, 6);
  });

  it("leaves exactly one gutter between neighbours", () => {
    const geometry = sceneGeometry(360, 8);
    const a = cellRect(geometry, 0, 0);
    const b = cellRect(geometry, 0, 1);

    expect(b.x - (a.x + a.width)).toBeCloseTo(geometry.gutter, 6);
  });

  it("reports nothing measurable before layout", () => {
    expect(sceneGeometry(0, 8).cellSize).toBe(0);
    // A board smaller than its own frame would otherwise yield a negative cell
    // size, and a negative rect draws as an inverted one rather than as nothing.
    expect(sceneGeometry(4, 8).cellSize).toBeLessThanOrEqual(0);
  });
});

describe("lane rects span a whole row or column", () => {
  it("covers the first and last cell of the lane and nothing beyond", () => {
    const geometry = sceneGeometry(328, 8);
    const row = laneRect(geometry, "row", 3);
    const first = cellRect(geometry, 3, 0);
    const last = cellRect(geometry, 3, 7);

    expect(row.x).toBeCloseTo(first.x, 6);
    expect(row.y).toBeCloseTo(first.y, 6);
    expect(row.x + row.width).toBeCloseTo(last.x + last.width, 6);
    expect(row.height).toBeCloseTo(geometry.cellSize, 6);
  });

  it("runs the other way for a column", () => {
    const geometry = sceneGeometry(328, 8);
    const column = laneRect(geometry, "column", 2);

    expect(column.width).toBeCloseTo(geometry.cellSize, 6);
    expect(column.height).toBeGreaterThan(column.width);
  });
});
