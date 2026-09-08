import { createInitialGameState, placePiece } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import { getPlacementPrediction } from "../../src/domain/selectors";

const NOW = 1_752_800_000_000;

function emptyGrid(): GridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
}

function stateWithSingle(grid: GridCell[][]): GameState {
  return {
    ...createInitialGameState("prediction-seed", NOW),
    grid,
    hand: [{ handId: "candidate", shapeId: "single", colorId: "cyan" }],
  };
}

function fillRowExcept(grid: GridCell[][], row: number, missingColumn: number): void {
  for (let column = 0; column < 8; column++) {
    if (column !== missingColumn) {
      grid[row][column] = { kind: "normal", colorId: "purple" };
    }
  }
}

function fillColumnExcept(grid: GridCell[][], column: number, missingRow: number): void {
  for (let row = 0; row < 8; row++) {
    if (row !== missingRow) {
      grid[row][column] = { kind: "normal", colorId: "amber" };
    }
  }
}

describe("pure pre-clear placement prediction", () => {
  it("predicts one completed row and every cell participating in it", () => {
    const grid = emptyGrid();
    fillRowExcept(grid, 2, 4);

    const prediction = getPlacementPrediction(stateWithSingle(grid), "candidate", {
      row: 2,
      column: 4,
    });

    expect(prediction.valid).toBe(true);
    expect(prediction.clear.rows).toEqual([2]);
    expect(prediction.clear.columns).toEqual([]);
    expect(prediction.clear.cells).toEqual(
      Array.from({ length: 8 }, (_, column) => ({ row: 2, column })),
    );
    expect(prediction.clear.intersections).toEqual([]);
  });

  it("predicts one completed column", () => {
    const grid = emptyGrid();
    fillColumnExcept(grid, 5, 3);

    const prediction = getPlacementPrediction(stateWithSingle(grid), "candidate", {
      row: 3,
      column: 5,
    });

    expect(prediction.clear.rows).toEqual([]);
    expect(prediction.clear.columns).toEqual([5]);
    expect(prediction.clear.cells).toEqual(
      Array.from({ length: 8 }, (_, row) => ({ row, column: 5 })),
    );
  });

  it("predicts a simultaneous row and column with one deduplicated intersection", () => {
    const grid = emptyGrid();
    fillRowExcept(grid, 3, 4);
    fillColumnExcept(grid, 4, 3);

    const prediction = getPlacementPrediction(stateWithSingle(grid), "candidate", {
      row: 3,
      column: 4,
    });

    expect(prediction.clear.rows).toEqual([3]);
    expect(prediction.clear.columns).toEqual([4]);
    expect(prediction.clear.cells).toHaveLength(15);
    expect(prediction.clear.intersections).toEqual([{ row: 3, column: 4 }]);
    expect(
      prediction.clear.cells.filter((cell) => cell.row === 3 && cell.column === 4),
    ).toHaveLength(1);
  });

  it("returns no clear preview for an invalid overlap", () => {
    const grid = emptyGrid();
    fillRowExcept(grid, 0, 0);
    grid[0][0] = { kind: "rubble", explosionId: "blocked" };

    const prediction = getPlacementPrediction(stateWithSingle(grid), "candidate", {
      row: 0,
      column: 0,
    });

    expect(prediction.valid).toBe(false);
    expect(prediction.clear).toEqual({ rows: [], columns: [], cells: [], intersections: [] });
  });

  it("returns no clear preview when the candidate leaves the board", () => {
    const prediction = getPlacementPrediction(stateWithSingle(emptyGrid()), "candidate", {
      row: 8,
      column: 0,
    });

    expect(prediction.valid).toBe(false);
    expect(prediction.clear).toEqual({ rows: [], columns: [], cells: [], intersections: [] });
  });

  it("returns no line highlight for a valid placement that completes nothing", () => {
    const prediction = getPlacementPrediction(stateWithSingle(emptyGrid()), "candidate", {
      row: 4,
      column: 4,
    });

    expect(prediction.valid).toBe(true);
    expect(prediction.clear).toEqual({ rows: [], columns: [], cells: [], intersections: [] });
  });

  it("rejects a missing hand identity and a completed session", () => {
    const state = stateWithSingle(emptyGrid());
    expect(getPlacementPrediction(state, "stale", { row: 0, column: 0 }).valid).toBe(false);
    expect(
      getPlacementPrediction({ ...state, status: "gameOver" }, "candidate", {
        row: 0,
        column: 0,
      }).valid,
    ).toBe(false);
  });

  it("does not mutate GameState or advance score, timers, turn, or RNG", () => {
    const grid = emptyGrid();
    fillRowExcept(grid, 6, 2);
    const state: GameState = {
      ...stateWithSingle(grid),
      score: 1234,
      turn: 9,
      activeTimers: {
        existing: {
          id: "existing",
          shapeId: "single",
          remainingTurns: 2,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    };
    const before = structuredClone(state);

    getPlacementPrediction(state, "candidate", { row: 6, column: 2 });

    expect(state).toEqual(before);
    expect(state.grid).toBe(grid);
    expect(state.score).toBe(1234);
    expect(state.turn).toBe(9);
    expect(state.rngState).toEqual(before.rngState);
    expect(state.activeTimers).toEqual(before.activeTimers);
  });

  it.each([
    ["row", 1, 6, true, false],
    ["column", 5, 2, false, true],
    ["intersection", 4, 3, true, true],
  ] as const)(
    "matches actual resolved clear lines for %s",
    (_name, row, column, completeRow, completeColumn) => {
      const grid = emptyGrid();
      if (completeRow) fillRowExcept(grid, row, column);
      if (completeColumn) fillColumnExcept(grid, column, row);
      const state = stateWithSingle(grid);
      const predicted = getPlacementPrediction(state, "candidate", { row, column });

      const result = placePiece(state, "candidate", { row, column }, NOW + 1);
      const actual = result.events.find((event) => event.type === "linesCleared");

      expect(result.ok).toBe(true);
      expect(predicted.clear.rows).toEqual(actual?.rows ?? []);
      expect(predicted.clear.columns).toEqual(actual?.columns ?? []);
    },
  );
});
