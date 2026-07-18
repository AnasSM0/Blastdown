import { applyPlacement, isValidPlacement } from "../../src/domain/placement";
import type { GridCell } from "../../src/domain/gameTypes";
import { getShapeById } from "../../src/domain/shapes";

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

describe("placement", () => {
  const square = getShapeById("square2x2")!;
  const line3h = getShapeById("line3h")!;

  it("is valid when the shape fits entirely inside an empty board", () => {
    const grid = makeEmptyGrid(8);
    expect(isValidPlacement(grid, square, { row: 0, column: 0 })).toBe(true);
  });

  it("is invalid when the shape would extend past the board's bottom-right edge", () => {
    const grid = makeEmptyGrid(8);
    expect(isValidPlacement(grid, square, { row: 7, column: 7 })).toBe(false);
  });

  it("is invalid when the shape would extend past the board's top-left edge", () => {
    const grid = makeEmptyGrid(8);
    expect(isValidPlacement(grid, square, { row: -1, column: 0 })).toBe(false);
  });

  it("is invalid when a target cell is already occupied by a normal block", () => {
    const grid = makeEmptyGrid(8);
    grid[0][1] = { kind: "normal", colorId: "cyan" };
    expect(isValidPlacement(grid, line3h, { row: 0, column: 0 })).toBe(false);
  });

  it("is invalid when a target cell contains rubble", () => {
    const grid = makeEmptyGrid(8);
    grid[0][1] = { kind: "rubble", explosionId: "e1" };
    expect(isValidPlacement(grid, line3h, { row: 0, column: 0 })).toBe(false);
  });

  it("is valid when placed next to (not overlapping) occupied cells", () => {
    const grid = makeEmptyGrid(8);
    grid[0][3] = { kind: "normal", colorId: "amber" };
    expect(isValidPlacement(grid, line3h, { row: 0, column: 0 })).toBe(true);
  });

  it("applies the shape's cells as normal blocks with the given color", () => {
    const grid = makeEmptyGrid(8);
    const result = applyPlacement(grid, line3h, { row: 2, column: 1 }, "cyan");

    expect(result[2][1]).toEqual({ kind: "normal", colorId: "cyan" });
    expect(result[2][2]).toEqual({ kind: "normal", colorId: "cyan" });
    expect(result[2][3]).toEqual({ kind: "normal", colorId: "cyan" });
  });

  it("does not mutate the original grid", () => {
    const grid = makeEmptyGrid(8);
    applyPlacement(grid, line3h, { row: 2, column: 1 }, "cyan");
    expect(grid[2][1]).toEqual({ kind: "empty" });
  });

  it("leaves untouched cells unchanged", () => {
    const grid = makeEmptyGrid(8);
    const result = applyPlacement(grid, line3h, { row: 2, column: 1 }, "cyan");
    expect(result[0][0]).toEqual({ kind: "empty" });
    expect(result[7][7]).toEqual({ kind: "empty" });
  });

  it("throws when applying an out-of-bounds placement", () => {
    const grid = makeEmptyGrid(8);
    expect(() => applyPlacement(grid, square, { row: 7, column: 7 }, "cyan")).toThrow();
  });
});
