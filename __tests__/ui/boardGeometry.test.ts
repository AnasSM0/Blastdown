import { cellFromPoint, dragOriginFromFinger, type BoardLayout } from "../../src/ui/boardGeometry";

const LAYOUT: BoardLayout = {
  contentLeft: 100,
  contentTop: 200,
  cellSize: 40,
  pitch: 42,
  size: 8,
};

describe("cellFromPoint", () => {
  it("maps the top-left content corner to cell (0,0)", () => {
    expect(cellFromPoint({ x: 100, y: 200 }, LAYOUT)).toEqual({ row: 0, column: 0 });
  });

  it("maps a point in the last cell to (7,7)", () => {
    expect(cellFromPoint({ x: 100 + 300, y: 200 + 300 }, LAYOUT)).toEqual({ row: 7, column: 7 });
  });

  it("crosses to the next column exactly at one pitch", () => {
    expect(cellFromPoint({ x: 100 + 41.9, y: 200 }, LAYOUT)).toEqual({ row: 0, column: 0 });
    expect(cellFromPoint({ x: 100 + 42, y: 200 }, LAYOUT)).toEqual({ row: 0, column: 1 });
  });

  it("returns null left or above the content area", () => {
    expect(cellFromPoint({ x: 99, y: 200 }, LAYOUT)).toBeNull();
    expect(cellFromPoint({ x: 100, y: 199 }, LAYOUT)).toBeNull();
  });

  it("returns null past the far edge", () => {
    expect(cellFromPoint({ x: 100 + 8 * 42, y: 200 }, LAYOUT)).toBeNull();
    expect(cellFromPoint({ x: 100, y: 200 + 8 * 42 }, LAYOUT)).toBeNull();
  });

  it("returns null for a degenerate layout", () => {
    expect(cellFromPoint({ x: 100, y: 200 }, { ...LAYOUT, pitch: 0 })).toBeNull();
  });
});

describe("dragOriginFromFinger", () => {
  const lift = 28;

  it("places a single-cell piece's origin under the lifted finger", () => {
    const origin = dragOriginFromFinger(
      { x: 110, y: 200 + lift + 20 + 10 },
      { maxRow: 0, maxColumn: 0 },
      lift,
      LAYOUT,
    );
    expect(origin).toEqual({ row: 0, column: 0 });
  });

  it("returns null when the mapped origin leaves the board", () => {
    const origin = dragOriginFromFinger(
      { x: 110, y: 100 },
      { maxRow: 0, maxColumn: 0 },
      lift,
      LAYOUT,
    );
    expect(origin).toBeNull();
  });

  it("centers a wide piece horizontally on the finger", () => {
    // 2x2 piece: width = height = 2*42 - 2 = 82.
    // firstCellCenter = (fingerX - 41 + 20, fingerY - 28 - 82 + 20).
    // fingerX 140 -> cx 119 (col 0); fingerY 300 -> cy 210 (row 0).
    const origin = dragOriginFromFinger(
      { x: 140, y: 300 },
      { maxRow: 1, maxColumn: 1 },
      lift,
      LAYOUT,
    );
    expect(origin).toEqual({ row: 0, column: 0 });
  });
});
