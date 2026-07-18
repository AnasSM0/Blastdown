import { createInitialGameState, placePiece } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import { getShapeById } from "../../src/domain/shapes";
import type { GameEvent } from "../../src/domain/events";

const NOW = 1_752_800_000_000;

function eventTypes(events: GameEvent[]): string[] {
  return events.map((event) => event.type);
}

/** Build a state whose hand and grid we control precisely. */
function craftState(
  overrides: Partial<GameState>,
  base: GameState = createInitialGameState("craft-seed", NOW),
): GameState {
  return { ...base, ...overrides };
}

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

describe("createInitialGameState", () => {
  it("creates an 8x8 empty grid, a 3-piece hand, and playing status", () => {
    const state = createInitialGameState("seed-1", NOW);
    expect(state.grid).toHaveLength(8);
    expect(state.grid.every((row) => row.every((cell) => cell.kind === "empty"))).toBe(true);
    expect(state.hand).toHaveLength(3);
    expect(state.status).toBe("playing");
    expect(state.version).toBe(1);
    expect(state.seed).toBe("seed-1");
    expect(state.turn).toBe(0);
    expect(state.score).toBe(0);
    expect(state.combo).toBe(0);
    expect(state.startedAt).toBe(NOW);
    expect(state.lastUpdatedAt).toBe(NOW);
  });

  it("is fully deterministic for the same seed", () => {
    expect(createInitialGameState("same-seed", NOW)).toEqual(
      createInitialGameState("same-seed", NOW),
    );
  });

  it("produces different hands for different seeds", () => {
    const a = createInitialGameState("seed-a", NOW);
    const b = createInitialGameState("seed-b", NOW);
    expect(a.rngState).not.toBe(b.rngState);
  });
});

describe("placePiece — rejection", () => {
  it("rejects an unknown handId without changing state", () => {
    const state = createInitialGameState("seed-1", NOW);
    const result = placePiece(state, "no-such-id", { row: 0, column: 0 }, NOW);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it("rejects an invalid placement without consuming the turn or the rng", () => {
    const base = createInitialGameState("seed-1", NOW);
    const state = craftState({
      hand: [{ handId: "h1", shapeId: "square2x2", colorId: "cyan" }],
    });
    const result = placePiece(state, "h1", { row: 7, column: 7 }, NOW);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.turn).toBe(base.turn);
    expect(result.state.rngState).toBe(state.rngState);
    expect(result.events).toEqual([]);
  });
});

describe("placePiece — classic resolution", () => {
  it("places the piece cells as blocks with the hand piece's color", () => {
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "line3h", colorId: "purple" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 2, column: 1 }, NOW);
    expect(result.ok).toBe(true);
    expect(result.state.grid[2][1].kind).not.toBe("empty");
    expect(result.state.grid[2][2].kind).not.toBe("empty");
    expect(result.state.grid[2][3].kind).not.toBe("empty");
  });

  it("consumes the placed piece from the hand", () => {
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "single", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(result.state.hand.map((piece) => piece.handId)).toEqual(["h2"]);
  });

  it("increments turn and piecesPlaced, and awards placement score", () => {
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "line3h", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(result.state.turn).toBe(state.turn + 1);
    expect(result.state.piecesPlaced).toBe(state.piecesPlaced + 1);
    expect(result.state.score).toBe(state.score + 3);
  });

  it("emits piecePlaced and scoreChanged events", () => {
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "single", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 4, column: 5 }, NOW);
    expect(eventTypes(result.events)).toContain("piecePlaced");
    expect(eventTypes(result.events)).toContain("scoreChanged");
    const placed = result.events.find((event) => event.type === "piecePlaced");
    if (placed?.type === "piecePlaced") {
      expect(placed.cells).toEqual([{ row: 4, column: 5 }]);
    }
  });

  it("refills the hand with 3 new unique pieces when the last hand piece is used", () => {
    const state = craftState({
      hand: [{ handId: "h-last", shapeId: "single", colorId: "cyan" }],
    });
    const result = placePiece(state, "h-last", { row: 0, column: 0 }, NOW);
    expect(result.state.hand).toHaveLength(3);
    expect(eventTypes(result.events)).toContain("handRefilled");
    expect(result.state.rngState).not.toBe(state.rngState);
    const oldIds = new Set(["h-last"]);
    for (const piece of result.state.hand) {
      expect(oldIds.has(piece.handId)).toBe(false);
    }
  });

  it("does not refill the hand while pieces remain", () => {
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "single", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(result.state.hand).toHaveLength(1);
    expect(eventTypes(result.events)).not.toContain("handRefilled");
    expect(result.state.rngState).toBe(state.rngState);
  });

  it("clears a completed row, scores it, and starts a combo", () => {
    const grid = makeEmptyGrid(8);
    for (let column = 0; column < 7; column++) {
      grid[0][column] = { kind: "normal", colorId: "cyan" };
    }
    const state = craftState({
      grid,
      hand: [
        { handId: "h1", shapeId: "single", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 0, column: 7 }, NOW);

    for (let column = 0; column < 8; column++) {
      expect(result.state.grid[0][column]).toEqual({ kind: "empty" });
    }
    expect(result.state.linesCleared).toBe(1);
    expect(result.state.combo).toBe(1);
    expect(result.state.bestCombo).toBe(1);
    // placement 1 + line 100 * 1 (single line) * 1.25 (combo 1) = 126,
    // + the placed single defusing itself in the clear (25 + 10 * 7) = 95.
    expect(result.state.score).toBe(221);
    expect(eventTypes(result.events)).toContain("linesCleared");
    expect(eventTypes(result.events)).toContain("comboChanged");
  });

  it("resets the combo on a non-clearing placement and emits comboChanged", () => {
    const state = craftState({
      combo: 3,
      bestCombo: 3,
      hand: [
        { handId: "h1", shapeId: "single", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(result.state.combo).toBe(0);
    expect(result.state.bestCombo).toBe(3);
    expect(eventTypes(result.events)).toContain("comboChanged");
  });

  it("does not emit comboChanged when the combo stays at 0", () => {
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "single", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(eventTypes(result.events)).not.toContain("comboChanged");
  });

  it("detects game over when no remaining hand piece fits", () => {
    // Every row and column has exactly two empty holes at (r, r) and
    // (r, (r+1) % 8), so nothing is complete before or after placing a
    // single at (0,0): row 0 keeps (0,1) empty, column 0 keeps (7,0) empty.
    // The remaining diagonal holes never form a 2x2 empty region, so the
    // square in hand cannot fit anywhere.
    const grid = makeEmptyGrid(8);
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        grid[row][column] = { kind: "normal", colorId: "cyan" };
      }
    }
    for (let row = 0; row < 8; row++) {
      grid[row][row] = { kind: "empty" };
      grid[row][(row + 1) % 8] = { kind: "empty" };
    }
    const state = craftState({
      grid,
      hand: [
        { handId: "h1", shapeId: "single", colorId: "cyan" },
        { handId: "h2", shapeId: "square2x2", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(eventTypes(result.events)).not.toContain("linesCleared");
    expect(result.state.status).toBe("gameOver");
    expect(eventTypes(result.events)).toContain("gameOver");
  });

  it("keeps playing when at least one hand piece still fits", () => {
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "single", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(result.state.status).toBe("playing");
    expect(eventTypes(result.events)).not.toContain("gameOver");
  });

  it("updates lastUpdatedAt to the provided timestamp", () => {
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "single", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const later = NOW + 60_000;
    const result = placePiece(state, "h1", { row: 0, column: 0 }, later);
    expect(result.state.lastUpdatedAt).toBe(later);
    expect(result.state.startedAt).toBe(state.startedAt);
  });

  it("does not mutate the input state", () => {
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "line3h", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const before = JSON.parse(JSON.stringify(state));
    placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(state).toEqual(before);
  });

  it("uses the shape catalog for placement geometry", () => {
    const tShape = getShapeById("tShape")!;
    const state = craftState({
      hand: [
        { handId: "h1", shapeId: "tShape", colorId: "cyan" },
        { handId: "h2", shapeId: "single", colorId: "cyan" },
      ],
    });
    const result = placePiece(state, "h1", { row: 3, column: 2 }, NOW);
    for (const cell of tShape.cells) {
      expect(result.state.grid[3 + cell.row][2 + cell.column].kind).not.toBe("empty");
    }
  });
});
