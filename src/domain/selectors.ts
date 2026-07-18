import type { GameState } from "./gameTypes";
import type { CellPosition } from "./placement";
import { getShapeById } from "./shapes";
import { BOARD_SIZE } from "./board";

export type TimerBadgePlacement = {
  pieceId: string;
  position: CellPosition;
  remainingTurns: number;
  colorId: string;
};

/** One badge per active timed piece, positioned on its topmost surviving
 *  cell (leftmost on a tie) per BUILD_SPEC.md §6.11 and the resolved
 *  timer-badge convention in docs/DECISIONS.md. */
export function getTimerBadgePlacements(state: GameState): TimerBadgePlacement[] {
  const placements: TimerBadgePlacement[] = [];
  for (const timer of Object.values(state.activeTimers)) {
    let best: CellPosition | undefined;
    for (let row = 0; row < state.grid.length; row++) {
      for (let column = 0; column < state.grid[row].length; column++) {
        const cell = state.grid[row][column];
        if (cell.kind !== "timed" || cell.pieceInstanceId !== timer.id) {
          continue;
        }
        if (!best || row < best.row || (row === best.row && column < best.column)) {
          best = { row, column };
        }
      }
    }
    if (best) {
      placements.push({
        pieceId: timer.id,
        position: best,
        remainingTurns: timer.remainingTurns,
        colorId: timer.colorId,
      });
    }
  }
  return placements;
}

export type PlacementPreview = {
  valid: boolean;
  /** In-bounds ghost cells of the shape at the origin. */
  cells: CellPosition[];
  /** In-bounds ghost cells overlapping an occupied or rubble cell. */
  conflictCells: CellPosition[];
};

/** Preview of placing `shapeId` at `origin` — presentation data only; the
 *  validity rule itself stays in src/domain/placement.ts semantics. */
export function getPlacementPreview(
  state: GameState,
  shapeId: string,
  origin: CellPosition,
): PlacementPreview {
  const shape = getShapeById(shapeId);
  if (!shape) {
    return { valid: false, cells: [], conflictCells: [] };
  }

  const cells: CellPosition[] = [];
  const conflictCells: CellPosition[] = [];
  let valid = true;

  for (const shapeCell of shape.cells) {
    const row = origin.row + shapeCell.row;
    const column = origin.column + shapeCell.column;
    if (row < 0 || row >= BOARD_SIZE || column < 0 || column >= BOARD_SIZE) {
      valid = false;
      continue;
    }
    const position = { row, column };
    cells.push(position);
    if (state.grid[row][column].kind !== "empty") {
      valid = false;
      conflictCells.push(position);
    }
  }

  return { valid, cells, conflictCells };
}
