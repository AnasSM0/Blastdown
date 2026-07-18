import { clearLines, detectCompletedLines } from "../../src/domain/lineClearing";
import type { GridCell } from "../../src/domain/gameTypes";

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function fillRow(grid: GridCell[][], row: number, cell: GridCell): void {
  for (let column = 0; column < grid.length; column++) {
    grid[row][column] = { ...cell };
  }
}

function fillColumn(grid: GridCell[][], column: number, cell: GridCell): void {
  for (let row = 0; row < grid.length; row++) {
    grid[row][column] = { ...cell };
  }
}

describe("lineClearing", () => {
  it("detects no completed lines on an empty board", () => {
    const grid = makeEmptyGrid(8);
    expect(detectCompletedLines(grid)).toEqual({ rows: [], columns: [] });
  });

  it("detects a single completed row", () => {
    const grid = makeEmptyGrid(8);
    fillRow(grid, 3, { kind: "normal", colorId: "cyan" });
    expect(detectCompletedLines(grid)).toEqual({ rows: [3], columns: [] });
  });

  it("detects a single completed column", () => {
    const grid = makeEmptyGrid(8);
    fillColumn(grid, 5, { kind: "normal", colorId: "cyan" });
    expect(detectCompletedLines(grid)).toEqual({ rows: [], columns: [5] });
  });

  it("detects a row that is not fully filled as incomplete", () => {
    const grid = makeEmptyGrid(8);
    fillRow(grid, 0, { kind: "normal", colorId: "cyan" });
    grid[0][7] = { kind: "empty" };
    expect(detectCompletedLines(grid)).toEqual({ rows: [], columns: [] });
  });

  it("counts rubble cells toward a completed line", () => {
    const grid = makeEmptyGrid(8);
    fillRow(grid, 2, { kind: "normal", colorId: "cyan" });
    grid[2][4] = { kind: "rubble", explosionId: "e1" };
    expect(detectCompletedLines(grid)).toEqual({ rows: [2], columns: [] });
  });

  it("detects an intersecting row and column", () => {
    const grid = makeEmptyGrid(8);
    fillRow(grid, 0, { kind: "normal", colorId: "cyan" });
    fillColumn(grid, 0, { kind: "normal", colorId: "amber" });
    expect(detectCompletedLines(grid)).toEqual({ rows: [0], columns: [0] });
  });

  it("clears completed rows and columns, emptying the intersection once", () => {
    const grid = makeEmptyGrid(8);
    fillRow(grid, 0, { kind: "normal", colorId: "cyan" });
    fillColumn(grid, 0, { kind: "normal", colorId: "amber" });

    const result = clearLines(grid, [0], [0]);

    for (let column = 0; column < 8; column++) {
      expect(result[0][column]).toEqual({ kind: "empty" });
    }
    for (let row = 0; row < 8; row++) {
      expect(result[row][0]).toEqual({ kind: "empty" });
    }
  });

  it("clears rubble as part of a completed line", () => {
    const grid = makeEmptyGrid(8);
    fillRow(grid, 1, { kind: "normal", colorId: "cyan" });
    grid[1][4] = { kind: "rubble", explosionId: "e1" };

    const result = clearLines(grid, [1], []);

    expect(result[1][4]).toEqual({ kind: "empty" });
  });

  it("leaves cells outside cleared lines unchanged", () => {
    const grid = makeEmptyGrid(8);
    fillRow(grid, 0, { kind: "normal", colorId: "cyan" });
    grid[3][3] = { kind: "normal", colorId: "purple" };

    const result = clearLines(grid, [0], []);

    expect(result[3][3]).toEqual({ kind: "normal", colorId: "purple" });
  });

  it("does not mutate the original grid", () => {
    const grid = makeEmptyGrid(8);
    fillRow(grid, 0, { kind: "normal", colorId: "cyan" });

    clearLines(grid, [0], []);

    expect(grid[0][0]).toEqual({ kind: "normal", colorId: "cyan" });
  });
});
