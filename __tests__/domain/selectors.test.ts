import { getPlacementPreview, getTimerBadgePlacements } from "../../src/domain/selectors";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function craftState(overrides: Partial<GameState>): GameState {
  return { ...createInitialGameState("selector-seed", NOW), ...overrides };
}

describe("getTimerBadgePlacements", () => {
  it("returns one badge per active timed piece on its topmost surviving cell", () => {
    const grid = makeEmptyGrid(8);
    // L-shaped piece: (2,3), (3,3), (3,4) — topmost is (2,3).
    grid[2][3] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
    grid[3][3] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
    grid[3][4] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
    const state = craftState({
      grid,
      activeTimers: {
        p1: { id: "p1", shapeId: "lSmall", remainingTurns: 5, placedOnTurn: 1, colorId: "cyan" },
      },
    });

    const placements = getTimerBadgePlacements(state);
    expect(placements).toHaveLength(1);
    expect(placements[0]).toEqual({
      pieceId: "p1",
      position: { row: 2, column: 3 },
      remainingTurns: 5,
      colorId: "cyan",
    });
  });

  it("breaks topmost ties with the leftmost cell", () => {
    const grid = makeEmptyGrid(8);
    grid[4][6] = { kind: "timed", pieceInstanceId: "p1", colorId: "purple" };
    grid[4][5] = { kind: "timed", pieceInstanceId: "p1", colorId: "purple" };
    const state = craftState({
      grid,
      activeTimers: {
        p1: { id: "p1", shapeId: "line2h", remainingTurns: 3, placedOnTurn: 2, colorId: "purple" },
      },
    });

    const placements = getTimerBadgePlacements(state);
    expect(placements[0].position).toEqual({ row: 4, column: 5 });
  });

  it("uses only surviving cells after a partial clear", () => {
    const grid = makeEmptyGrid(8);
    // Piece originally spanned (0,0)-(1,0); row 0 was cleared.
    grid[1][0] = { kind: "timed", pieceInstanceId: "p1", colorId: "amber" };
    const state = craftState({
      grid,
      activeTimers: {
        p1: { id: "p1", shapeId: "line2v", remainingTurns: 2, placedOnTurn: 3, colorId: "amber" },
      },
    });

    expect(getTimerBadgePlacements(state)[0].position).toEqual({ row: 1, column: 0 });
  });

  it("returns an empty list when no timers are active", () => {
    const state = craftState({ activeTimers: {} });
    expect(getTimerBadgePlacements(state)).toEqual([]);
  });

  it("returns one badge per piece for multiple pieces", () => {
    const grid = makeEmptyGrid(8);
    grid[0][0] = { kind: "timed", pieceInstanceId: "a", colorId: "cyan" };
    grid[7][7] = { kind: "timed", pieceInstanceId: "b", colorId: "amber" };
    const state = craftState({
      grid,
      activeTimers: {
        a: { id: "a", shapeId: "single", remainingTurns: 7, placedOnTurn: 1, colorId: "cyan" },
        b: { id: "b", shapeId: "single", remainingTurns: 1, placedOnTurn: 2, colorId: "amber" },
      },
    });

    const placements = getTimerBadgePlacements(state);
    expect(placements).toHaveLength(2);
    const byId = Object.fromEntries(placements.map((p) => [p.pieceId, p]));
    expect(byId.a.position).toEqual({ row: 0, column: 0 });
    expect(byId.b.position).toEqual({ row: 7, column: 7 });
    expect(byId.b.remainingTurns).toBe(1);
  });
});

describe("getPlacementPreview", () => {
  it("marks a fully valid placement with all ghost cells and no conflicts", () => {
    const state = craftState({ grid: makeEmptyGrid(8) });
    const preview = getPlacementPreview(state, "line3h", { row: 2, column: 1 });

    expect(preview.valid).toBe(true);
    expect(preview.cells).toEqual([
      { row: 2, column: 1 },
      { row: 2, column: 2 },
      { row: 2, column: 3 },
    ]);
    expect(preview.conflictCells).toEqual([]);
  });

  it("marks exactly the overlapping occupied cells as conflicts", () => {
    const grid = makeEmptyGrid(8);
    grid[2][2] = { kind: "normal", colorId: "cyan" };
    const state = craftState({ grid });
    const preview = getPlacementPreview(state, "line3h", { row: 2, column: 1 });

    expect(preview.valid).toBe(false);
    expect(preview.conflictCells).toEqual([{ row: 2, column: 2 }]);
    expect(preview.cells).toHaveLength(3);
  });

  it("marks rubble overlap as a conflict", () => {
    const grid = makeEmptyGrid(8);
    grid[0][1] = { kind: "rubble", explosionId: "e1" };
    const state = craftState({ grid });
    const preview = getPlacementPreview(state, "line2h", { row: 0, column: 0 });

    expect(preview.valid).toBe(false);
    expect(preview.conflictCells).toEqual([{ row: 0, column: 1 }]);
  });

  it("is invalid when part of the shape leaves the board, listing only in-bounds ghost cells", () => {
    const state = craftState({ grid: makeEmptyGrid(8) });
    const preview = getPlacementPreview(state, "line3h", { row: 0, column: 6 });

    expect(preview.valid).toBe(false);
    expect(preview.cells).toEqual([
      { row: 0, column: 6 },
      { row: 0, column: 7 },
    ]);
    expect(preview.conflictCells).toEqual([]);
  });

  it("returns an invalid empty preview for an unknown shape", () => {
    const state = craftState({});
    const preview = getPlacementPreview(state, "not-a-shape", { row: 0, column: 0 });
    expect(preview).toEqual({
      valid: false,
      cells: [],
      conflictCells: [],
      clear: { rows: [], columns: [], cells: [], intersections: [] },
    });
  });
});
