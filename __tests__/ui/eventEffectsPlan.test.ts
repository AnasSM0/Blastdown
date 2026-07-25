import { BOARD_SIZE } from "../../src/domain/board";
import type { GameEvent } from "../../src/domain/events";
import type { GridCell } from "../../src/domain/gameTypes";
import {
  buildCuePlan,
  buildEffectPlan,
  cellsOfPiece,
  rubbleCellsOf,
  sweepDelaysFor,
  MAX_BURST_CELLS,
} from "../../src/ui/effects/eventEffects";

function emptyGrid(): GridCell[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, (): GridCell => ({ kind: "empty" })),
  );
}

function key(cell: { row: number; column: number }): string {
  return `${cell.row},${cell.column}`;
}

describe("line-clear sweep direction", () => {
  it("sweeps a cleared row left to right and a cleared column top to bottom", () => {
    const rowDelays = sweepDelaysFor([2], [], 10, 1000);
    // Along the cleared row, the delay grows with the column: a direction.
    expect(rowDelays.get("2,0")).toBe(0);
    expect(rowDelays.get("2,3")).toBe(30);
    expect(rowDelays.get("2,7")).toBe(70);

    const columnDelays = sweepDelaysFor([], [4], 10, 1000);
    expect(columnDelays.get("0,4")).toBe(0);
    expect(columnDelays.get("5,4")).toBe(50);
  });

  it("gives an intersection the earlier of the two sweeps, so neither line stalls", () => {
    // Row 0 reaches column 6 at 60ms; column 6 reaches row 0 at 0ms.
    const delays = sweepDelaysFor([0], [6], 10, 1000);
    expect(delays.get("0,6")).toBe(0);
    // Cells that belong to only one line keep that line's own pacing.
    expect(delays.get("0,7")).toBe(70);
    expect(delays.get("7,6")).toBe(70);
  });

  it("caps the sweep so a full-board clear still resolves inside the sequence", () => {
    const delays = sweepDelaysFor([0], [], 14, 40);
    expect(delays.get("0,7")).toBe(40);
  });

  it("keeps simultaneous clears understandable: every cleared cell appears exactly once", () => {
    const events: GameEvent[] = [
      { type: "linesCleared", rows: [1, 5], columns: [2, 6] },
      { type: "scoreChanged", delta: 400, score: 400 },
    ];
    const plan = buildEffectPlan(events, false);
    // 2 rows + 2 columns on an 8x8 board, minus the 4 intersections counted once.
    expect(plan.clearedCells).toHaveLength(8 + 8 + 8 + 8 - 4);
    expect(new Set(plan.clearedCells.map(key)).size).toBe(plan.clearedCells.length);
    // Row-major order, so the effect reads consistently across turns.
    expect(plan.clearedCells[0]).toEqual({ row: 0, column: 2 });
  });
});

describe("defuse targeting", () => {
  it("resolves the defused piece's own cells from the pre-turn grid", () => {
    const previousGrid = emptyGrid();
    previousGrid[3][3] = { kind: "timed", pieceInstanceId: "piece-9", colorId: "cyan" };
    previousGrid[3][4] = { kind: "timed", pieceInstanceId: "piece-9", colorId: "cyan" };
    // A different piece on the same cleared row must not be picked up.
    previousGrid[3][6] = { kind: "timed", pieceInstanceId: "piece-other", colorId: "amber" };

    const events: GameEvent[] = [
      { type: "linesCleared", rows: [3], columns: [] },
      { type: "pieceDefused", pieceId: "piece-9", bonus: 80 },
      { type: "scoreChanged", delta: 180, score: 180 },
    ];
    const plan = buildEffectPlan(events, false, { previousGrid });

    expect(plan.defuses).toHaveLength(1);
    expect(plan.defuses[0].pieceId).toBe("piece-9");
    expect(plan.defuses[0].cells).toEqual([
      { row: 3, column: 3 },
      { row: 3, column: 4 },
    ]);
  });

  it("keeps two defuses on the same turn separately targeted", () => {
    const previousGrid = emptyGrid();
    previousGrid[0][0] = { kind: "timed", pieceInstanceId: "a", colorId: "cyan" };
    previousGrid[7][7] = { kind: "timed", pieceInstanceId: "b", colorId: "purple" };

    const plan = buildEffectPlan(
      [
        { type: "linesCleared", rows: [0, 7], columns: [] },
        { type: "pieceDefused", pieceId: "a", bonus: 40 },
        { type: "pieceDefused", pieceId: "b", bonus: 60 },
      ],
      false,
      { previousGrid },
    );

    expect(plan.defuses.map((defuse) => defuse.cells)).toEqual([
      [{ row: 0, column: 0 }],
      [{ row: 7, column: 7 }],
    ]);
  });

  it("falls back to no cells when the pre-turn grid is unavailable", () => {
    const plan = buildEffectPlan([{ type: "pieceDefused", pieceId: "gone", bonus: 10 }], false);
    expect(plan.defuses[0].cells).toEqual([]);
  });
});

describe("expiry and rubble", () => {
  it("takes rubble from the authoritative event, grouped per explosion", () => {
    const plan = buildEffectPlan(
      [
        { type: "explosionStarted", explosionId: "e-1", pieceId: "p-1" },
        {
          type: "rubbleCreated",
          explosionId: "e-1",
          cells: [
            { row: 2, column: 2 },
            { row: 2, column: 3 },
          ],
        },
        { type: "explosionStarted", explosionId: "e-2", pieceId: "p-2" },
        // A cell shared with the first explosion must be drawn once.
        {
          type: "rubbleCreated",
          explosionId: "e-2",
          cells: [
            { row: 2, column: 3 },
            { row: 5, column: 5 },
          ],
        },
      ],
      false,
    );

    expect(plan.explosions.map((explosion) => explosion.explosionId)).toEqual(["e-1", "e-2"]);
    expect(plan.explosions[0].cells).toHaveLength(2);
    expect(plan.rubbleCells).toHaveLength(3);
    expect(new Set(plan.rubbleCells.map(key)).size).toBe(3);
  });

  it("bounds the burst budget across all explosions in a turn", () => {
    const events: GameEvent[] = [];
    // Six simultaneous expiries, six cells each — far past the budget.
    for (let index = 0; index < 6; index++) {
      events.push({ type: "explosionStarted", explosionId: `e-${index}`, pieceId: `p-${index}` });
      events.push({
        type: "rubbleCreated",
        explosionId: `e-${index}`,
        cells: Array.from({ length: 6 }, (_, cell) => ({ row: index, column: cell })),
      });
    }
    const plan = buildEffectPlan(events, false);
    const total = plan.explosions.reduce((sum, explosion) => sum + explosion.cells.length, 0);
    expect(total).toBe(36);
    // The plan keeps every authoritative cell; the LAYER is what is budgeted, so
    // the cap must be below the total for that budget to mean anything.
    expect(MAX_BURST_CELLS).toBeLessThan(total);
  });
});

describe("out-of-turn cues", () => {
  it("builds a revive cue over the restored cells and never locks input", () => {
    const cells = [
      { row: 1, column: 1 },
      { row: 4, column: 2 },
    ];
    const plan = buildCuePlan("revive", cells, false);
    expect(plan.cue).toBe("revive");
    expect(plan.reviveCells).toEqual(cells);
    // The board is already repaired; holding input would delay play for nothing.
    expect(plan.hasRequiredSequence).toBe(false);
    expect(plan.durationMs).toBeGreaterThan(0);
    expect(plan.durationMs).toBeLessThanOrEqual(450);
  });

  it("builds a rewarded-defuse cue on the piece's cells, with no bonus text", () => {
    const cells = [{ row: 6, column: 6 }];
    const plan = buildCuePlan("rewardedDefuse", cells, false);
    expect(plan.cue).toBe("rewardedDefuse");
    expect(plan.defuses).toEqual([{ pieceId: "", bonus: 0, cells }]);
    expect(plan.hasRequiredSequence).toBe(false);
  });

  it("shortens a cue under reduced motion", () => {
    const cells = [{ row: 0, column: 0 }];
    const moving = buildCuePlan("revive", cells, false);
    const reduced = buildCuePlan("revive", cells, true);
    expect(reduced.durationMs).toBeLessThan(moving.durationMs);
  });
});

describe("authoritative state reads", () => {
  it("cellsOfPiece finds exactly the timed cells of one piece, row-major", () => {
    const grid = emptyGrid();
    grid[1][1] = { kind: "timed", pieceInstanceId: "x", colorId: "cyan" };
    grid[0][5] = { kind: "timed", pieceInstanceId: "x", colorId: "cyan" };
    grid[2][2] = { kind: "timed", pieceInstanceId: "y", colorId: "amber" };
    grid[3][3] = { kind: "normal", colorId: "cyan" };

    expect(cellsOfPiece(grid, "x")).toEqual([
      { row: 0, column: 5 },
      { row: 1, column: 1 },
    ]);
  });

  it("rubbleCellsOf finds exactly the rubble, so a revive wave covers what was restored", () => {
    const grid = emptyGrid();
    grid[2][0] = { kind: "rubble", explosionId: "e" };
    grid[2][1] = { kind: "normal", colorId: "cyan" };
    grid[7][7] = { kind: "rubble", explosionId: "e" };

    expect(rubbleCellsOf(grid)).toEqual([
      { row: 2, column: 0 },
      { row: 7, column: 7 },
    ]);
  });
});

describe("score and combo come from the events, not from board state", () => {
  it("carries the score delta and combo the engine reported", () => {
    const plan = buildEffectPlan(
      [
        { type: "linesCleared", rows: [0], columns: [] },
        { type: "scoreChanged", delta: 250, score: 1250 },
        { type: "comboChanged", combo: 3 },
      ],
      false,
    );
    expect(plan.scoreDelta).toBe(250);
    expect(plan.score).toBe(1250);
    expect(plan.combo).toBe(3);
    expect(plan.comboReset).toBe(false);
  });

  it("marks a combo reset without inventing one when the combo never changed", () => {
    const reset = buildEffectPlan([{ type: "comboChanged", combo: 0 }], false);
    expect(reset.comboReset).toBe(true);

    const untouched = buildEffectPlan([{ type: "linesCleared", rows: [0], columns: [] }], false);
    expect(untouched.combo).toBeNull();
    expect(untouched.comboReset).toBe(false);
  });
});
