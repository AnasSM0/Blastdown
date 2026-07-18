import { createInitialGameState, placePiece } from "../../src/domain/game";
import type { ActiveTimedPiece, GameState, GridCell } from "../../src/domain/gameTypes";
import type { GameEvent } from "../../src/domain/events";

const NOW = 1_752_800_000_000;

function craftState(overrides: Partial<GameState>): GameState {
  return { ...createInitialGameState("timed-seed", NOW), ...overrides };
}

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function eventTypes(events: GameEvent[]): string[] {
  return events.map((event) => event.type);
}

function basicHand(): GameState["hand"] {
  return [
    { handId: "h1", shapeId: "line3h", colorId: "cyan" },
    { handId: "h2", shapeId: "single", colorId: "amber" },
  ];
}

function timerOf(state: GameState, pieceId: string): ActiveTimedPiece | undefined {
  return state.activeTimers[pieceId];
}

describe("timed piece creation", () => {
  it("places cells as timed cells sharing one piece-instance id", () => {
    const state = craftState({ hand: basicHand() });
    const result = placePiece(state, "h1", { row: 2, column: 1 }, NOW);

    const cells = [result.state.grid[2][1], result.state.grid[2][2], result.state.grid[2][3]];
    const ids = new Set<string>();
    for (const cell of cells) {
      expect(cell.kind).toBe("timed");
      if (cell.kind === "timed") {
        ids.add(cell.pieceInstanceId);
        expect(cell.colorId).toBe("cyan");
      }
    }
    expect(ids.size).toBe(1);
  });

  it("registers an active timer with the tier countdown for the placement turn", () => {
    const state = craftState({ hand: basicHand() });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);

    const timers = Object.values(result.state.activeTimers);
    expect(timers).toHaveLength(1);
    expect(timers[0].remainingTurns).toBe(7);
    expect(timers[0].placedOnTurn).toBe(1);
    expect(timers[0].shapeId).toBe("line3h");
    expect(timers[0].colorId).toBe("cyan");
  });

  it("uses the later tier countdown when the run is deeper", () => {
    const state = craftState({ hand: basicHand(), turn: 20 });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    const timers = Object.values(result.state.activeTimers);
    expect(timers[0].remainingTurns).toBe(6);
    expect(timers[0].placedOnTurn).toBe(21);
  });

  it("assigns unique piece ids across consecutive placements", () => {
    let state = craftState({ hand: basicHand() });
    let result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    state = result.state;
    result = placePiece(state, "h2", { row: 5, column: 5 }, NOW);
    expect(Object.keys(result.state.activeTimers)).toHaveLength(2);
  });
});

describe("timer decrement", () => {
  it("decrements existing timers by one after a successful placement", () => {
    const state = craftState({
      hand: basicHand(),
      grid: (() => {
        const grid = makeEmptyGrid(8);
        grid[7][0] = { kind: "timed", pieceInstanceId: "old-piece", colorId: "purple" };
        return grid;
      })(),
      activeTimers: {
        "old-piece": {
          id: "old-piece",
          shapeId: "single",
          remainingTurns: 5,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    });
    const result = placePiece(state, "h2", { row: 0, column: 0 }, NOW);
    expect(timerOf(result.state, "old-piece")?.remainingTurns).toBe(4);
  });

  it("does not decrement the newly placed piece on its own turn", () => {
    const state = craftState({ hand: basicHand() });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    const [timer] = Object.values(result.state.activeTimers);
    expect(timer.remainingTurns).toBe(7);
  });

  it("emits timerChanged for each decremented piece", () => {
    const state = craftState({
      hand: basicHand(),
      grid: (() => {
        const grid = makeEmptyGrid(8);
        grid[7][0] = { kind: "timed", pieceInstanceId: "old-piece", colorId: "purple" };
        return grid;
      })(),
      activeTimers: {
        "old-piece": {
          id: "old-piece",
          shapeId: "single",
          remainingTurns: 5,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    });
    const result = placePiece(state, "h2", { row: 0, column: 0 }, NOW);
    const changed = result.events.find((event) => event.type === "timerChanged");
    expect(changed).toBeDefined();
    if (changed?.type === "timerChanged") {
      expect(changed.pieceId).toBe("old-piece");
      expect(changed.remainingTurns).toBe(4);
    }
  });

  it("does not decrement timers when the placement is invalid", () => {
    const state = craftState({
      hand: basicHand(),
      grid: (() => {
        const grid = makeEmptyGrid(8);
        grid[7][0] = { kind: "timed", pieceInstanceId: "old-piece", colorId: "purple" };
        return grid;
      })(),
      activeTimers: {
        "old-piece": {
          id: "old-piece",
          shapeId: "single",
          remainingTurns: 5,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    });
    const result = placePiece(state, "h1", { row: 7, column: 7 }, NOW);
    expect(result.ok).toBe(false);
    expect(timerOf(result.state, "old-piece")?.remainingTurns).toBe(5);
  });

  it("emits timerWarning at 2 and at 1", () => {
    const makeState = (remaining: number): GameState =>
      craftState({
        hand: basicHand(),
        grid: (() => {
          const grid = makeEmptyGrid(8);
          grid[7][0] = { kind: "timed", pieceInstanceId: "old-piece", colorId: "purple" };
          return grid;
        })(),
        activeTimers: {
          "old-piece": {
            id: "old-piece",
            shapeId: "single",
            remainingTurns: remaining,
            placedOnTurn: 1,
            colorId: "purple",
          },
        },
      });

    const toTwo = placePiece(makeState(3), "h2", { row: 0, column: 0 }, NOW);
    const warningAtTwo = toTwo.events.find((event) => event.type === "timerWarning");
    expect(warningAtTwo).toBeDefined();
    if (warningAtTwo?.type === "timerWarning") {
      expect(warningAtTwo.remainingTurns).toBe(2);
    }

    const toOne = placePiece(makeState(2), "h2", { row: 0, column: 0 }, NOW);
    const warningAtOne = toOne.events.find((event) => event.type === "timerWarning");
    expect(warningAtOne).toBeDefined();
    if (warningAtOne?.type === "timerWarning") {
      expect(warningAtOne.remainingTurns).toBe(1);
    }

    const toFour = placePiece(makeState(5), "h2", { row: 0, column: 0 }, NOW);
    expect(eventTypes(toFour.events)).not.toContain("timerWarning");
  });
});

describe("partial clear and defuse", () => {
  function stateWithTimedRow(remaining: number): GameState {
    // "victim" occupies (7,0) and (6,0): a 2-cell vertical piece.
    // Row 7 is otherwise full of plain normal blocks, with (7,7) open.
    const grid = makeEmptyGrid(8);
    grid[7][0] = { kind: "timed", pieceInstanceId: "victim", colorId: "purple" };
    grid[6][0] = { kind: "timed", pieceInstanceId: "victim", colorId: "purple" };
    for (let column = 1; column < 7; column++) {
      grid[7][column] = { kind: "normal", colorId: "cyan" };
    }
    return craftState({
      grid,
      hand: [
        { handId: "filler", shapeId: "single", colorId: "amber" },
        { handId: "spare", shapeId: "single", colorId: "amber" },
      ],
      activeTimers: {
        victim: {
          id: "victim",
          shapeId: "line2v",
          remainingTurns: remaining,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    });
  }

  it("keeps the timer running when only part of the piece is cleared", () => {
    const state = stateWithTimedRow(5);
    const result = placePiece(state, "filler", { row: 7, column: 7 }, NOW);

    // Row 7 cleared: victim's (7,0) cell is gone, (6,0) survives.
    expect(result.state.grid[6][0].kind).toBe("timed");
    const timer = timerOf(result.state, "victim");
    expect(timer).toBeDefined();
    // Timer decremented normally (5 -> 4) but the piece was not defused.
    expect(timer?.remainingTurns).toBe(4);
    // Only the filler single (fully cleared by its own line) defused;
    // the partially cleared victim did not.
    expect(result.state.piecesDefused).toBe(1);
    expect(
      result.events.some((event) => event.type === "pieceDefused" && event.pieceId === "victim"),
    ).toBe(false);
  });

  it("defuses the piece and awards the bonus when its last cells are cleared", () => {
    // Victim occupies only (7,0); row 7 completed by the placement.
    const grid = makeEmptyGrid(8);
    grid[7][0] = { kind: "timed", pieceInstanceId: "victim", colorId: "purple" };
    for (let column = 1; column < 7; column++) {
      grid[7][column] = { kind: "normal", colorId: "cyan" };
    }
    const state = craftState({
      grid,
      hand: [
        { handId: "filler", shapeId: "single", colorId: "amber" },
        { handId: "spare", shapeId: "single", colorId: "amber" },
      ],
      activeTimers: {
        victim: {
          id: "victim",
          shapeId: "single",
          remainingTurns: 5,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    });

    const result = placePiece(state, "filler", { row: 7, column: 7 }, NOW);

    expect(timerOf(result.state, "victim")).toBeUndefined();
    // Both the victim and the just-placed filler are fully cleared, so both
    // defuse (BUILD_SPEC.md §6.10 steps 5-6 exclude nothing).
    expect(result.state.piecesDefused).toBe(2);
    const defusedEvents = result.events.filter((event) => event.type === "pieceDefused");
    expect(defusedEvents).toHaveLength(2);
    const victimDefused = defusedEvents.find(
      (event) => event.type === "pieceDefused" && event.pieceId === "victim",
    );
    expect(victimDefused).toBeDefined();
    if (victimDefused?.type === "pieceDefused") {
      // 25 base + 10 * 5 remaining
      expect(victimDefused.bonus).toBe(75);
    }
    // Score: placement 1 + line 100 * 1.25 (combo 1) = 126,
    // + victim defuse 75 + filler self-defuse (25 + 10 * 7) = 95 -> 296.
    expect(result.state.score).toBe(296);
  });

  it("saves a piece at 1: full clear this turn defuses it before any decrement", () => {
    const grid = makeEmptyGrid(8);
    grid[7][0] = { kind: "timed", pieceInstanceId: "victim", colorId: "purple" };
    for (let column = 1; column < 7; column++) {
      grid[7][column] = { kind: "normal", colorId: "cyan" };
    }
    const state = craftState({
      grid,
      hand: [
        { handId: "filler", shapeId: "single", colorId: "amber" },
        { handId: "spare", shapeId: "single", colorId: "amber" },
      ],
      activeTimers: {
        victim: {
          id: "victim",
          shapeId: "single",
          remainingTurns: 1,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    });

    const result = placePiece(state, "filler", { row: 7, column: 7 }, NOW);

    expect(timerOf(result.state, "victim")).toBeUndefined();
    // Victim saved at 1, plus the filler defusing itself.
    expect(result.state.piecesDefused).toBe(2);
    const defused = result.events.find(
      (event) => event.type === "pieceDefused" && event.pieceId === "victim",
    );
    if (defused?.type === "pieceDefused") {
      expect(defused.bonus).toBe(35); // 25 + 10 * 1
    }
    // No timerChanged or timerWarning for the defused piece.
    expect(eventTypes(result.events)).not.toContain("timerChanged");
    expect(eventTypes(result.events)).not.toContain("timerWarning");
  });

  it("the newly placed piece can defuse itself by completing a line over all its cells", () => {
    const grid = makeEmptyGrid(8);
    for (let column = 0; column < 7; column++) {
      grid[7][column] = { kind: "normal", colorId: "cyan" };
    }
    const state = craftState({
      grid,
      hand: [
        { handId: "filler", shapeId: "single", colorId: "amber" },
        { handId: "spare", shapeId: "single", colorId: "amber" },
      ],
    });

    const result = placePiece(state, "filler", { row: 7, column: 7 }, NOW);

    expect(Object.keys(result.state.activeTimers)).toHaveLength(0);
    expect(result.state.piecesDefused).toBe(1);
  });
});
