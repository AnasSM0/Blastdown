import type { GameEvent } from "../../src/domain/events";
import { buildEffectPlan } from "../../src/ui/effects/eventEffects";

function clearPlan(rows: number[], columns: number[] = [], reducedMotion = false) {
  const events: GameEvent[] = [
    { type: "linesCleared", rows, columns },
    { type: "scoreChanged", delta: (rows.length + columns.length) * 100, score: 1_000 },
  ];
  return buildEffectPlan(events, reducedMotion);
}

function cellKey(cell: { row: number; column: number }): string {
  return `${cell.row},${cell.column}`;
}

describe("line-clear presentation contract", () => {
  it("maps one line to the Tier-1 450ms treatment with no impulse", () => {
    const plan = clearPlan([2]);
    expect(plan.clear).toMatchObject({ lineCount: 1, tier: 1, rows: [2], columns: [] });
    expect(plan.clear?.timing.recoveryEndMs).toBe(450);
    expect(plan.boardImpulse).toBeNull();
  });

  it("escalates double and triple clears monotonically", () => {
    const single = clearPlan([0]).clear!;
    const double = clearPlan([0, 1]).clear!;
    const triple = clearPlan([0, 1, 2]).clear!;
    expect(double.tier).toBe(2);
    expect(triple.tier).toBe(3);
    expect(double.bloomIntensity).toBeGreaterThan(single.bloomIntensity);
    expect(triple.bloomIntensity).toBeGreaterThan(double.bloomIntensity);
    expect(double.timing.recoveryEndMs).toBeGreaterThan(single.timing.recoveryEndMs);
    expect(triple.timing.recoveryEndMs).toBeGreaterThan(double.timing.recoveryEndMs);
    expect([
      single.timing.recoveryEndMs,
      double.timing.recoveryEndMs,
      triple.timing.recoveryEndMs,
      clearPlan([0, 1, 2, 3]).clear?.timing.recoveryEndMs,
    ]).toEqual([450, 560, 680, 880]);
  });

  it("caps four or more lines at the maximum normal-clear tier", () => {
    expect(clearPlan([0, 1, 2, 3]).clear?.tier).toBe(4);
    expect(clearPlan([0, 1, 2, 3, 4], [0]).clear?.tier).toBe(4);
    expect(clearPlan([0, 1, 2, 3]).clear?.timing.recoveryEndMs).toBe(880);
  });

  it("uses 0/2/4/6px clear impulses and keeps explosions stronger", () => {
    expect(clearPlan([0]).boardImpulse).toBeNull();
    expect(clearPlan([0, 1]).boardImpulse?.amplitudePx).toBe(2);
    expect(clearPlan([0, 1, 2]).boardImpulse?.amplitudePx).toBe(4);
    expect(clearPlan([0, 1, 2, 3]).boardImpulse?.amplitudePx).toBe(6);

    const explosion = buildEffectPlan(
      [{ type: "explosionStarted", explosionId: "x", pieceId: "p" }],
      false,
    );
    expect(explosion.boardImpulse?.amplitudePx).toBeGreaterThan(6);
  });

  it("disables impulse under Reduced Motion while preserving clear geometry", () => {
    const plan = clearPlan([1, 4], [3], true);
    expect(plan.boardImpulse).toBeNull();
    expect(plan.clear).toMatchObject({ rows: [1, 4], columns: [3], lineCount: 3 });
    expect(plan.clear?.cells.length).toBeGreaterThan(0);
  });

  it("keeps row and column lanes in one coordinated contract", () => {
    const plan = clearPlan([3], [5]);
    expect(plan.clear).not.toBeNull();
    expect(plan.clear?.rows).toEqual([3]);
    expect(plan.clear?.columns).toEqual([5]);
    expect(plan.clear?.lineCount).toBe(2);
  });

  it("deduplicates participating cells and records each intersection once", () => {
    const clear = clearPlan([1, 5], [2, 6]).clear!;
    expect(clear.cells).toHaveLength(28);
    expect(new Set(clear.cells.map(cellKey)).size).toBe(clear.cells.length);
    expect(clear.intersections).toEqual([
      { row: 1, column: 2 },
      { row: 1, column: 6 },
      { row: 5, column: 2 },
      { row: 5, column: 6 },
    ]);
  });

  it("does not mutate committed events or consume random state", () => {
    const events: GameEvent[] = [
      { type: "linesCleared", rows: [4], columns: [7] },
      { type: "scoreChanged", delta: 240, score: 800 },
    ];
    const before = JSON.stringify(events);
    const random = jest.spyOn(Math, "random");
    buildEffectPlan(events, false);
    expect(JSON.stringify(events)).toBe(before);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });
});
