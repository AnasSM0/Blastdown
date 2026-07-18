import type { GridCell } from "./gameTypes";
import type { ShapeDefinition } from "./shapes";

export type CellPosition = {
  row: number;
  column: number;
};

export function isValidPlacement(
  grid: readonly (readonly GridCell[])[],
  shape: ShapeDefinition,
  origin: CellPosition,
): boolean {
  const size = grid.length;
  for (const cell of shape.cells) {
    const row = origin.row + cell.row;
    const column = origin.column + cell.column;
    if (row < 0 || row >= size || column < 0 || column >= size) {
      return false;
    }
    if (grid[row][column].kind !== "empty") {
      return false;
    }
  }
  return true;
}

export function applyPlacement(
  grid: readonly (readonly GridCell[])[],
  shape: ShapeDefinition,
  origin: CellPosition,
  colorId: string,
): GridCell[][] {
  if (!isValidPlacement(grid, shape, origin)) {
    throw new Error("Cannot apply an invalid placement");
  }

  const nextGrid = grid.map((row) => row.slice());
  for (const cell of shape.cells) {
    const row = origin.row + cell.row;
    const column = origin.column + cell.column;
    nextGrid[row][column] = { kind: "normal", colorId };
  }
  return nextGrid;
}
