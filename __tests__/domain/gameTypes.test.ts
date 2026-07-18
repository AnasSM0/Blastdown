import type { ActiveTimedPiece, GameState, GridCell, HandPiece } from "../../src/domain/gameTypes";

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

describe("gameTypes", () => {
  it("constructs a valid initial GameState", () => {
    const state: GameState = {
      version: 1,
      seed: "seed-1",
      rngState: 0,
      turn: 0,
      grid: makeEmptyGrid(8),
      hand: [],
      activeTimers: {},
      score: 0,
      combo: 0,
      bestCombo: 0,
      linesCleared: 0,
      piecesPlaced: 0,
      piecesDefused: 0,
      explosions: 0,
      rubbleCleared: 0,
      freezeTurnsRemaining: 0,
      rewardedFreezeUses: 0,
      rewardedDefuseUses: 0,
      reviveUsed: false,
      handRefills: 0,
      status: "ready",
      startedAt: 0,
      lastUpdatedAt: 0,
    };

    expect(state.grid).toHaveLength(8);
    expect(state.grid[0]).toHaveLength(8);
    expect(state.status).toBe("ready");
  });

  it("narrows GridCell by kind", () => {
    const cells: GridCell[] = [
      { kind: "empty" },
      { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" },
      { kind: "normal", colorId: "amber" },
      { kind: "rubble", explosionId: "e1" },
    ];

    const timedCell = cells.find((cell) => cell.kind === "timed");
    expect(timedCell?.kind).toBe("timed");
    if (timedCell?.kind === "timed") {
      expect(timedCell.pieceInstanceId).toBe("p1");
    }
  });

  it("constructs an ActiveTimedPiece and HandPiece", () => {
    const timedPiece: ActiveTimedPiece = {
      id: "p1",
      shapeId: "single",
      remainingTurns: 7,
      placedOnTurn: 0,
      colorId: "cyan",
    };
    const handPiece: HandPiece = {
      handId: "h1",
      shapeId: "single",
      colorId: "cyan",
    };

    expect(timedPiece.remainingTurns).toBe(7);
    expect(handPiece.shapeId).toBe("single");
  });
});
