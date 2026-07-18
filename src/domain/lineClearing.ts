import type { GridCell } from "./gameTypes";

export type CompletedLines = {
  rows: number[];
  columns: number[];
};

export function detectCompletedLines(grid: readonly (readonly GridCell[])[]): CompletedLines {
  const size = grid.length;
  const rows: number[] = [];
  const columns: number[] = [];

  for (let row = 0; row < size; row++) {
    if (grid[row].every((cell) => cell.kind !== "empty")) {
      rows.push(row);
    }
  }

  for (let column = 0; column < size; column++) {
    if (grid.every((row) => row[column].kind !== "empty")) {
      columns.push(column);
    }
  }

  return { rows, columns };
}

export function clearLines(
  grid: readonly (readonly GridCell[])[],
  rows: readonly number[],
  columns: readonly number[],
): GridCell[][] {
  const rowSet = new Set(rows);
  const columnSet = new Set(columns);

  return grid.map((rowCells, rowIndex) =>
    rowCells.map((cell, columnIndex): GridCell =>
      rowSet.has(rowIndex) || columnSet.has(columnIndex) ? { kind: "empty" } : cell,
    ),
  );
}
