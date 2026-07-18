import { createInitialGameState, placePiece } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import type { GameEvent } from "../../src/domain/events";
import {
  EXPLOSION_ADJACENT_RUBBLE_MAX_PER_TURN,
  EXPLOSION_SCORE_PENALTY,
} from "../../src/config/balance";

const NOW = 1_752_800_000_000;

function craftState(overrides: Partial<GameState>): GameState {
  return { ...createInitialGameState("explosion-seed", NOW), ...overrides };
}

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function eventTypes(events: GameEvent[]): string[] {
  return events.map((event) => event.type);
}

function countRubble(state: GameState): number {
  let count = 0;
  for (const row of state.grid) {
    for (const cell of row) {
      if (cell.kind === "rubble") {
        count += 1;
      }
    }
  }
  return count;
}

/** A state with one timed piece ("doomed") at (4,4) that will hit 0 on the
 *  next placement, and a plain hand to trigger the turn. */
function stateWithDoomedPiece(overrides: Partial<GameState> = {}): GameState {
  const grid = makeEmptyGrid(8);
  grid[4][4] = { kind: "timed", pieceInstanceId: "doomed", colorId: "purple" };
  return craftState({
    grid,
    hand: [
      { handId: "trigger", shapeId: "single", colorId: "amber" },
      { handId: "spare", shapeId: "single", colorId: "amber" },
    ],
    activeTimers: {
      doomed: {
        id: "doomed",
        shapeId: "single",
        remainingTurns: 1,
        placedOnTurn: 1,
        colorId: "purple",
      },
    },
    ...overrides,
  });
}

describe("single explosion", () => {
  it("converts the expired piece's surviving cells to rubble and removes its timer", () => {
    const state = stateWithDoomedPiece();
    const result = placePiece(state, "trigger", { row: 0, column: 0 }, NOW);

    expect(result.state.grid[4][4].kind).toBe("rubble");
    expect(result.state.activeTimers.doomed).toBeUndefined();
    expect(result.state.explosions).toBe(1);
    expect(result.state.lastExplosionId).toBeDefined();
  });

  it("emits explosionStarted and rubbleCreated events", () => {
    const state = stateWithDoomedPiece();
    const result = placePiece(state, "trigger", { row: 0, column: 0 }, NOW);

    const started = result.events.find((event) => event.type === "explosionStarted");
    expect(started).toBeDefined();
    if (started?.type === "explosionStarted") {
      expect(started.pieceId).toBe("doomed");
    }
    const rubble = result.events.find((event) => event.type === "rubbleCreated");
    expect(rubble).toBeDefined();
    if (rubble?.type === "rubbleCreated") {
      expect(rubble.cells).toEqual(
        expect.arrayContaining([expect.objectContaining({ row: 4, column: 4 })]),
      );
    }
  });

  it("converts up to 4 orthogonally adjacent empty cells to rubble", () => {
    const state = stateWithDoomedPiece();
    const result = placePiece(state, "trigger", { row: 0, column: 0 }, NOW);

    // doomed cell itself + up to 4 adjacent = 5 rubble cells max; the doomed
    // piece sits mid-board with 4 empty orthogonal neighbours, so exactly 5.
    expect(countRubble(result.state)).toBe(5);
    const adjacent = [
      result.state.grid[3][4],
      result.state.grid[5][4],
      result.state.grid[4][3],
      result.state.grid[4][5],
    ];
    for (const cell of adjacent) {
      expect(cell.kind).toBe("rubble");
    }
  });

  it("only converts empty cells: occupied neighbours are untouched", () => {
    const grid = makeEmptyGrid(8);
    grid[4][4] = { kind: "timed", pieceInstanceId: "doomed", colorId: "purple" };
    grid[3][4] = { kind: "normal", colorId: "cyan" };
    grid[5][4] = { kind: "normal", colorId: "cyan" };
    const state = stateWithDoomedPiece({ grid });
    const result = placePiece(state, "trigger", { row: 0, column: 0 }, NOW);

    expect(result.state.grid[3][4].kind).toBe("normal");
    expect(result.state.grid[5][4].kind).toBe("normal");
    // doomed + the two remaining empty neighbours (4,3) and (4,5)
    expect(countRubble(result.state)).toBe(3);
  });

  it("applies the explosion score penalty with a floor of zero", () => {
    const state = stateWithDoomedPiece({ score: 30 });
    const result = placePiece(state, "trigger", { row: 0, column: 0 }, NOW);
    // 30 + 1 placement point - 50 penalty -> floored at 0.
    expect(result.state.score).toBe(0);
  });

  it("subtracts the penalty from a large enough score", () => {
    const state = stateWithDoomedPiece({ score: 500 });
    const result = placePiece(state, "trigger", { row: 0, column: 0 }, NOW);
    expect(result.state.score).toBe(500 + 1 - EXPLOSION_SCORE_PENALTY);
  });

  it("resets the combo and emits comboChanged", () => {
    const state = stateWithDoomedPiece({ combo: 4, bestCombo: 4 });
    const result = placePiece(state, "trigger", { row: 0, column: 0 }, NOW);
    expect(result.state.combo).toBe(0);
    expect(result.state.bestCombo).toBe(4);
    expect(eventTypes(result.events)).toContain("comboChanged");
  });

  it("is deterministic: identical states produce identical explosion results", () => {
    const first = placePiece(stateWithDoomedPiece(), "trigger", { row: 0, column: 0 }, NOW);
    const second = placePiece(stateWithDoomedPiece(), "trigger", { row: 0, column: 0 }, NOW);
    expect(first.state).toEqual(second.state);
    expect(first.events).toEqual(second.events);
  });

  it("advances the rng state when adjacent cells are selected", () => {
    const state = stateWithDoomedPiece();
    const result = placePiece(state, "trigger", { row: 0, column: 0 }, NOW);
    expect(result.state.rngState).not.toBe(state.rngState);
  });
});

describe("simultaneous expirations", () => {
  function stateWithTwoDoomed(): GameState {
    const grid = makeEmptyGrid(8);
    grid[1][1] = { kind: "timed", pieceInstanceId: "doomed-a", colorId: "purple" };
    grid[6][6] = { kind: "timed", pieceInstanceId: "doomed-b", colorId: "cyan" };
    return craftState({
      grid,
      hand: [
        { handId: "trigger", shapeId: "single", colorId: "amber" },
        { handId: "spare", shapeId: "single", colorId: "amber" },
      ],
      activeTimers: {
        "doomed-a": {
          id: "doomed-a",
          shapeId: "single",
          remainingTurns: 1,
          placedOnTurn: 1,
          colorId: "purple",
        },
        "doomed-b": {
          id: "doomed-b",
          shapeId: "single",
          remainingTurns: 1,
          placedOnTurn: 2,
          colorId: "cyan",
        },
      },
    });
  }

  it("resolves both explosions in one phase with capped total adjacent rubble", () => {
    const state = stateWithTwoDoomed();
    const result = placePiece(state, "trigger", { row: 0, column: 3 }, NOW);

    expect(result.state.explosions).toBe(2);
    expect(result.state.activeTimers["doomed-a"]).toBeUndefined();
    expect(result.state.activeTimers["doomed-b"]).toBeUndefined();
    expect(result.state.grid[1][1].kind).toBe("rubble");
    expect(result.state.grid[6][6].kind).toBe("rubble");

    // 2 piece cells + adjacent rubble capped at 6 for the whole turn.
    const rubble = countRubble(result.state);
    expect(rubble).toBeLessThanOrEqual(2 + EXPLOSION_ADJACENT_RUBBLE_MAX_PER_TURN);
    expect(rubble).toBe(8); // both have 4 free neighbours; 4 + 4 > cap -> 6 adjacent
  });

  it("emits one explosionStarted per expired piece, in deterministic order", () => {
    const state = stateWithTwoDoomed();
    const result = placePiece(state, "trigger", { row: 0, column: 3 }, NOW);
    const started = result.events.filter((event) => event.type === "explosionStarted");
    expect(started).toHaveLength(2);
    if (started[0].type === "explosionStarted" && started[1].type === "explosionStarted") {
      // Ordered by placedOnTurn: doomed-a (turn 1) before doomed-b (turn 2).
      expect(started[0].pieceId).toBe("doomed-a");
      expect(started[1].pieceId).toBe("doomed-b");
    }
  });

  it("applies one penalty per explosion", () => {
    const state = stateWithTwoDoomed();
    const withScore = { ...state, score: 1000 };
    const result = placePiece(withScore, "trigger", { row: 0, column: 3 }, NOW);
    expect(result.state.score).toBe(1000 + 1 - 2 * EXPLOSION_SCORE_PENALTY);
  });

  it("does not trigger recursive explosions or an automatic line clear", () => {
    // Fill row 3 almost fully with normal blocks; the explosion's adjacent
    // rubble could complete it, but no clear may happen this turn.
    const grid = makeEmptyGrid(8);
    for (let column = 0; column < 7; column++) {
      grid[3][column] = { kind: "normal", colorId: "cyan" };
    }
    grid[3][7] = { kind: "empty" };
    grid[2][7] = { kind: "timed", pieceInstanceId: "doomed", colorId: "purple" };
    const state = craftState({
      grid,
      hand: [
        { handId: "trigger", shapeId: "single", colorId: "amber" },
        { handId: "spare", shapeId: "single", colorId: "amber" },
      ],
      activeTimers: {
        doomed: {
          id: "doomed",
          shapeId: "single",
          remainingTurns: 1,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    });
    const result = placePiece(state, "trigger", { row: 7, column: 0 }, NOW);

    // If (3,7) became rubble, row 3 is now visually complete - but it must
    // NOT clear this turn, and no additional explosion may fire.
    expect(result.state.explosions).toBe(1);
    const linesClearedEvents = result.events.filter((event) => event.type === "linesCleared");
    expect(linesClearedEvents).toHaveLength(0);
    expect(result.state.linesCleared).toBe(0);
  });
});

describe("rubble interaction with placement and clearing", () => {
  it("rubble blocks placement", () => {
    const grid = makeEmptyGrid(8);
    grid[0][0] = { kind: "rubble", explosionId: "e1" };
    const state = craftState({
      grid,
      hand: [
        { handId: "h1", shapeId: "single", colorId: "amber" },
        { handId: "h2", shapeId: "single", colorId: "amber" },
      ],
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(result.ok).toBe(false);
  });

  it("rubble clears through a completed line, counts rubbleCleared, and emits rubbleCleared", () => {
    const grid = makeEmptyGrid(8);
    for (let column = 0; column < 6; column++) {
      grid[7][column] = { kind: "normal", colorId: "cyan" };
    }
    grid[7][6] = { kind: "rubble", explosionId: "e1" };
    const state = craftState({
      grid,
      hand: [
        { handId: "filler", shapeId: "single", colorId: "amber" },
        { handId: "spare", shapeId: "single", colorId: "amber" },
      ],
    });
    const result = placePiece(state, "filler", { row: 7, column: 7 }, NOW);

    expect(result.ok).toBe(true);
    expect(result.state.grid[7][6]).toEqual({ kind: "empty" });
    expect(result.state.rubbleCleared).toBe(1);
    const rubbleCleared = result.events.find((event) => event.type === "rubbleCleared");
    expect(rubbleCleared).toBeDefined();
    if (rubbleCleared?.type === "rubbleCleared") {
      expect(rubbleCleared.cells).toEqual([{ row: 7, column: 6 }]);
    }
  });

  it("checks game over after explosions fill the board", () => {
    // Nearly full board of normal blocks with a small empty pocket around a
    // doomed piece; after the explosion converts the pocket to rubble, the
    // remaining hand cannot fit anywhere.
    const grid = makeEmptyGrid(8);
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        grid[row][column] = { kind: "normal", colorId: "cyan" };
      }
    }
    // Pocket: (4,4) doomed, (3,4), (5,4), (4,3), (4,5) empty, and a
    // separate placement spot at (0,0). Two holes per row/column are not
    // needed here because rows stay incomplete via the pocket cells.
    grid[4][4] = { kind: "timed", pieceInstanceId: "doomed", colorId: "purple" };
    grid[3][4] = { kind: "empty" };
    grid[5][4] = { kind: "empty" };
    grid[4][3] = { kind: "empty" };
    grid[4][5] = { kind: "empty" };
    grid[0][0] = { kind: "empty" };
    // Keep every row/column incomplete: punch one extra hole per full row.
    for (let row = 0; row < 8; row++) {
      if (row !== 4) {
        grid[row][row === 0 ? 5 : 0] = { kind: "empty" };
      }
    }
    const state = craftState({
      grid,
      hand: [
        { handId: "trigger", shapeId: "single", colorId: "amber" },
        { handId: "spare", shapeId: "line4h", colorId: "amber" },
      ],
      activeTimers: {
        doomed: {
          id: "doomed",
          shapeId: "single",
          remainingTurns: 1,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    });

    const result = placePiece(state, "trigger", { row: 0, column: 0 }, NOW);
    expect(result.ok).toBe(true);
    // The 4-cell line cannot fit in the scattered single holes left over.
    expect(result.state.status).toBe("gameOver");
  });
});
