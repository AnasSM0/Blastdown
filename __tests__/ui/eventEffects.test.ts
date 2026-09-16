import { buildEffectPlan } from "../../src/ui/effects/eventEffects";
import type { GameEvent } from "../../src/domain/events";

describe("buildEffectPlan", () => {
  it("treats a plain placement as having no required sequence", () => {
    const events: GameEvent[] = [
      { type: "piecePlaced", handId: "h1", pieceId: "piece-1", cells: [{ row: 0, column: 0 }] },
      { type: "scoreChanged", delta: 4, score: 4 },
    ];
    const plan = buildEffectPlan(events, false);
    expect(plan.hasRequiredSequence).toBe(false);
    expect(plan.durationMs).toBe(0);
    expect(plan.clearedCells).toHaveLength(0);
  });

  it("dedups a cleared row/column intersection to a single cell, row-major", () => {
    const events: GameEvent[] = [{ type: "linesCleared", rows: [0], columns: [0] }];
    const plan = buildEffectPlan(events, false);
    // Row 0 (8 cells) + column 0 (8 cells) − shared (0,0) = 15.
    expect(plan.clearedCells).toHaveLength(15);
    const key = (c: { row: number; column: number }) => `${c.row},${c.column}`;
    expect(new Set(plan.clearedCells.map(key)).size).toBe(15);
    expect(plan.clearedCells[0]).toEqual({ row: 0, column: 0 });
    expect(plan.durationMs).toBe(560);
  });

  it("groups rubble under its explosion and keeps multiple explosions ordered", () => {
    const events: GameEvent[] = [
      {
        type: "explosionStarted",
        explosionId: "e-1",
        pieceId: "piece-1",
        sourceCells: [{ row: 1, column: 1 }],
      },
      {
        type: "explosionStarted",
        explosionId: "e-2",
        pieceId: "piece-2",
        sourceCells: [{ row: 5, column: 5 }],
      },
      { type: "rubbleCreated", explosionId: "e-2", cells: [{ row: 5, column: 5 }] },
      {
        type: "rubbleCreated",
        explosionId: "e-1",
        cells: [
          { row: 1, column: 1 },
          { row: 5, column: 5 },
        ],
      },
    ];
    const plan = buildEffectPlan(events, false);
    expect(plan.explosions.map((e) => e.explosionId)).toEqual(["e-1", "e-2"]);
    expect(plan.explosions[0].cells).toEqual([
      { row: 1, column: 1 },
      { row: 5, column: 5 },
    ]);
    expect(plan.explosions[1].cells).toEqual([{ row: 5, column: 5 }]);
    // Rubble union is deduped across explosions.
    expect(plan.rubbleCells).toHaveLength(2);
    expect(plan.durationMs).toBe(800);
  });

  it("coordinates a defuse and a line clear in the same turn", () => {
    const events: GameEvent[] = [
      { type: "linesCleared", rows: [3], columns: [] },
      { type: "pieceDefused", pieceId: "piece-2", bonus: 95, remainingTurns: 3 },
      { type: "scoreChanged", delta: 100, score: 100 },
      { type: "comboChanged", combo: 1 },
    ];
    const plan = buildEffectPlan(events, false);
    // Cells stay empty without a pre-turn grid: the event carries only the id,
    // so the layer falls back to the cleared lines for its anchor.
    expect(plan.defuses).toEqual([{ pieceId: "piece-2", bonus: 95, cells: [] }]);
    expect(plan.clearedCells).toHaveLength(8);
    expect(plan.combo).toBe(1);
    expect(plan.comboReset).toBe(false);
    expect(plan.hasRequiredSequence).toBe(true);
    // Clear + defuse share one beat; adding an explosion would extend it.
    expect(plan.durationMs).toBe(450);
  });

  it("captures score penalty and combo reset from an explosion turn", () => {
    const events: GameEvent[] = [
      {
        type: "explosionStarted",
        explosionId: "e-1",
        pieceId: "piece-1",
        sourceCells: [{ row: 2, column: 2 }],
      },
      { type: "rubbleCreated", explosionId: "e-1", cells: [{ row: 2, column: 2 }] },
      { type: "scoreChanged", delta: -50, score: 10 },
      { type: "comboChanged", combo: 0 },
    ];
    const plan = buildEffectPlan(events, false);
    expect(plan.scoreDelta).toBe(-50);
    expect(plan.combo).toBe(0);
    expect(plan.comboReset).toBe(true);
    expect(plan.durationMs).toBe(800);
  });

  it("collapses every required sequence to a brief beat under reduced motion", () => {
    const events: GameEvent[] = [
      { type: "linesCleared", rows: [0], columns: [1] },
      {
        type: "explosionStarted",
        explosionId: "e-1",
        pieceId: "piece-1",
        sourceCells: [{ row: 4, column: 4 }],
      },
      { type: "rubbleCreated", explosionId: "e-1", cells: [{ row: 4, column: 4 }] },
    ];
    const plan = buildEffectPlan(events, true);
    expect(plan.durationMs).toBe(180);
    // The cells themselves are unchanged — only timing/particles differ.
    expect(plan.explosions[0].cells).toEqual([{ row: 4, column: 4 }]);
  });
});
