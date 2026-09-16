import type { GameEvent } from "../../src/domain/events";
import { resolveScoreImpactForTurn } from "../../src/ui/scoreImpact";

function scored(delta: number, extras: GameEvent[]): GameEvent[] {
  return [...extras, { type: "scoreChanged", delta, score: delta }];
}

describe("resolveScoreImpactForTurn", () => {
  it("gives a single clear a small impact using the committed delta", () => {
    expect(
      resolveScoreImpactForTurn(scored(126, [{ type: "linesCleared", rows: [0], columns: [] }]), 3),
    ).toMatchObject({ level: 1, delta: 126, reason: "singleClear" });
  });

  it("makes a multi-clear stronger than a single", () => {
    const single = resolveScoreImpactForTurn(
      scored(126, [{ type: "linesCleared", rows: [0], columns: [] }]),
      1,
    );
    const multi = resolveScoreImpactForTurn(
      scored(301, [{ type: "linesCleared", rows: [0, 1], columns: [] }]),
      2,
    );
    expect(multi?.level).toBeGreaterThan(single?.level ?? 0);
  });

  it("makes a natural defuse stronger than a single clear", () => {
    const impact = resolveScoreImpactForTurn(
      scored(201, [
        { type: "linesCleared", rows: [0], columns: [] },
        { type: "pieceDefused", pieceId: "saved", bonus: 75, remainingTurns: 5 },
      ]),
      4,
    );
    expect(impact).toMatchObject({ level: 2, reason: "naturalDefuse", delta: 201 });
  });

  it("reserves the strongest impact for a clutch defuse or 4+ clear", () => {
    const clutch = resolveScoreImpactForTurn(
      scored(161, [
        { type: "linesCleared", rows: [0], columns: [] },
        { type: "pieceDefused", pieceId: "saved", bonus: 35, remainingTurns: 1 },
      ]),
      5,
    );
    const overload = resolveScoreImpactForTurn(
      scored(900, [{ type: "linesCleared", rows: [0, 1, 2, 3], columns: [] }]),
      6,
    );
    expect(clutch?.level).toBe(3);
    expect(overload?.level).toBe(3);
  });

  it("does not over-celebrate an ordinary placement or a non-positive score change", () => {
    expect(
      resolveScoreImpactForTurn(
        scored(4, [
          { type: "piecePlaced", handId: "h", pieceId: "p", cells: [{ row: 0, column: 0 }] },
        ]),
        1,
      ),
    ).toBeNull();
    expect(
      resolveScoreImpactForTurn(scored(-50, [{ type: "linesCleared", rows: [0], columns: [] }]), 2),
    ).toBeNull();
  });
});
