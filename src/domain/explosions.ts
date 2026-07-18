import type { ActiveTimedPiece, GridCell } from "./gameTypes";
import type { GameEvent } from "./events";
import type { CellPosition } from "./placement";
import { nextInt } from "./seededRandom";
import {
  EXPLOSION_ADJACENT_RUBBLE_MAX_PER_PIECE,
  EXPLOSION_ADJACENT_RUBBLE_MAX_PER_TURN,
} from "../config/balance";

export type ExpirationResolution = {
  grid: GridCell[][];
  activeTimers: Record<string, ActiveTimedPiece>;
  rngState: number;
  explosionCount: number;
  lastExplosionId?: string;
  events: GameEvent[];
};

const ORTHOGONAL_OFFSETS: readonly CellPosition[] = [
  { row: -1, column: 0 },
  { row: 1, column: 0 },
  { row: 0, column: -1 },
  { row: 0, column: 1 },
];

function findPieceCells(
  grid: readonly (readonly GridCell[])[],
  pieceInstanceId: string,
): CellPosition[] {
  const cells: CellPosition[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[row].length; column++) {
      const cell = grid[row][column];
      if (cell.kind === "timed" && cell.pieceInstanceId === pieceInstanceId) {
        cells.push({ row, column });
      }
    }
  }
  return cells;
}

/** Resolve every expired timed piece (remainingTurns <= 0) as one
 *  simultaneous, non-recursive explosion phase (BUILD_SPEC.md §6.12). */
export function resolveExpirations(
  inputGrid: readonly (readonly GridCell[])[],
  inputTimers: Record<string, ActiveTimedPiece>,
  inputRngState: number,
  turn: number,
): ExpirationResolution {
  const expired = Object.values(inputTimers)
    .filter((timer) => timer.remainingTurns <= 0)
    .sort((a, b) => a.placedOnTurn - b.placedOnTurn);

  const grid = inputGrid.map((row) => row.slice());
  const activeTimers = { ...inputTimers };
  const events: GameEvent[] = [];
  let rngState = inputRngState;
  let adjacentBudget = EXPLOSION_ADJACENT_RUBBLE_MAX_PER_TURN;
  let lastExplosionId: string | undefined;

  for (const timer of expired) {
    const explosionId = `explosion-${turn}-${timer.id}`;
    const pieceCells = findPieceCells(grid, timer.id);
    const rubbleCells: CellPosition[] = [];

    // 1-2. Remove the timer record; convert surviving cells to rubble.
    delete activeTimers[timer.id];
    for (const cell of pieceCells) {
      grid[cell.row][cell.column] = { kind: "rubble", explosionId };
      rubbleCells.push(cell);
    }

    // 3. Orthogonally adjacent empty cells, deduped, in row-major order.
    const seen = new Set<string>();
    const candidates: CellPosition[] = [];
    for (const cell of pieceCells) {
      for (const offset of ORTHOGONAL_OFFSETS) {
        const row = cell.row + offset.row;
        const column = cell.column + offset.column;
        if (row < 0 || row >= grid.length || column < 0 || column >= grid.length) {
          continue;
        }
        const key = `${row},${column}`;
        if (seen.has(key) || grid[row][column].kind !== "empty") {
          continue;
        }
        seen.add(key);
        candidates.push({ row, column });
      }
    }
    candidates.sort((a, b) => a.row - b.row || a.column - b.column);

    // 4-5. Convert up to 4 of them (turn-capped) chosen via the seeded rng.
    const pickCount = Math.min(
      EXPLOSION_ADJACENT_RUBBLE_MAX_PER_PIECE,
      adjacentBudget,
      candidates.length,
    );
    const pool = candidates.slice();
    for (let i = 0; i < pickCount; i++) {
      const pick = nextInt(rngState, pool.length);
      rngState = pick.nextState;
      const [chosen] = pool.splice(pick.value, 1);
      grid[chosen.row][chosen.column] = { kind: "rubble", explosionId };
      rubbleCells.push(chosen);
    }
    adjacentBudget -= pickCount;

    // 6-7. One explosion event per expired piece plus its created rubble.
    events.push({ type: "explosionStarted", explosionId, pieceId: timer.id });
    events.push({ type: "rubbleCreated", explosionId, cells: rubbleCells });
    lastExplosionId = explosionId;
  }

  return {
    grid,
    activeTimers,
    rngState,
    explosionCount: expired.length,
    lastExplosionId,
    events,
  };
}
