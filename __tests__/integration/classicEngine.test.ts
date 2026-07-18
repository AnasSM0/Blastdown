import { createInitialGameState, placePiece } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import type { GameEvent } from "../../src/domain/events";
import { getShapeById } from "../../src/domain/shapes";
import { canPlaceShapeAnywhere } from "../../src/domain/gameOver";

const NOW = 1_752_800_000_000;

function findValidOrigin(state: GameState, handId: string): { row: number; column: number } {
  const piece = state.hand.find((handPiece) => handPiece.handId === handId)!;
  const shape = getShapeById(piece.shapeId)!;
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const result = placePiece(state, handId, { row, column }, NOW);
      if (result.ok) {
        return { row, column };
      }
    }
  }
  throw new Error(`no valid origin for ${shape.id}`);
}

describe("classic engine integration", () => {
  it("plays a full hand cycle: three placements exhaust and refill the hand", () => {
    let state = createInitialGameState("cycle-seed", NOW);
    const initialIds = state.hand.map((piece) => piece.handId);
    let refillSeen = false;

    for (let i = 0; i < 3; i++) {
      const handId = state.hand[0].handId;
      const origin = findValidOrigin(state, handId);
      const result = placePiece(state, handId, origin, NOW + i);
      expect(result.ok).toBe(true);
      state = result.state;
      if (result.events.some((event) => event.type === "handRefilled")) {
        refillSeen = true;
      }
    }

    expect(refillSeen).toBe(true);
    expect(state.hand).toHaveLength(3);
    expect(state.piecesPlaced).toBe(3);
    expect(state.turn).toBe(3);
    for (const piece of state.hand) {
      expect(initialIds).not.toContain(piece.handId);
    }
  });

  it("completes a row mid-run and clears it", () => {
    let state = createInitialGameState("row-seed", NOW);
    // Craft a nearly complete bottom row, then place a single in the gap.
    const grid = state.grid.map((row) => row.slice());
    for (let column = 0; column < 7; column++) {
      grid[7][column] = { kind: "normal", colorId: "cyan" } as GridCell;
    }
    state = {
      ...state,
      grid,
      hand: [{ handId: "gap-filler", shapeId: "single", colorId: "amber" }, ...state.hand.slice(1)],
    };

    const result = placePiece(state, "gap-filler", { row: 7, column: 7 }, NOW);

    expect(result.ok).toBe(true);
    expect(result.state.grid[7].every((cell) => cell.kind === "empty")).toBe(true);
    expect(result.state.linesCleared).toBe(1);
    expect(result.events.some((event) => event.type === "linesCleared")).toBe(true);
  });

  it("builds a combo across consecutive clearing placements and resets it on a miss", () => {
    let state = createInitialGameState("combo-seed", NOW);

    // Two consecutive line clears from crafted rows.
    for (let clearRound = 0; clearRound < 2; clearRound++) {
      const grid = state.grid.map((row) => row.slice());
      const targetRow = clearRound === 0 ? 7 : 6;
      for (let column = 0; column < 7; column++) {
        grid[targetRow][column] = { kind: "normal", colorId: "cyan" } as GridCell;
      }
      state = {
        ...state,
        grid,
        hand: [
          { handId: `filler-${clearRound}`, shapeId: "single", colorId: "amber" },
          { handId: `spare-${clearRound}`, shapeId: "single", colorId: "amber" },
        ],
      };
      const result = placePiece(state, `filler-${clearRound}`, { row: targetRow, column: 7 }, NOW);
      expect(result.ok).toBe(true);
      state = result.state;
    }

    expect(state.combo).toBe(2);
    expect(state.bestCombo).toBe(2);

    // A non-clearing placement resets the combo but preserves bestCombo.
    state = {
      ...state,
      hand: [
        { handId: "misser", shapeId: "single", colorId: "amber" },
        { handId: "spare-x", shapeId: "single", colorId: "amber" },
      ],
    };
    const missResult = placePiece(state, "misser", { row: 0, column: 0 }, NOW);
    expect(missResult.state.combo).toBe(0);
    expect(missResult.state.bestCombo).toBe(2);
  });

  it("produces identical states and events for the same seed and action sequence", () => {
    const run = (): { states: GameState[]; events: GameEvent[][] } => {
      let state = createInitialGameState("replay-seed", NOW);
      const states: GameState[] = [state];
      const events: GameEvent[][] = [];
      for (let i = 0; i < 12; i++) {
        const handId = state.hand[0].handId;
        const piece = state.hand[0];
        const shape = getShapeById(piece.shapeId)!;
        if (!canPlaceShapeAnywhere(state.grid, shape)) {
          break;
        }
        const origin = findValidOrigin(state, handId);
        const result = placePiece(state, handId, origin, NOW + i);
        state = result.state;
        states.push(state);
        events.push(result.events);
      }
      return { states, events };
    };

    const first = run();
    const second = run();
    expect(first.states).toEqual(second.states);
    expect(first.events).toEqual(second.events);
  });

  it("leaves state and rng untouched for a stream of invalid actions", () => {
    const state = createInitialGameState("invalid-seed", NOW);
    const before = JSON.parse(JSON.stringify(state));

    const attempts = [
      placePiece(state, "not-a-real-id", { row: 0, column: 0 }, NOW),
      placePiece(state, state.hand[0].handId, { row: -1, column: 0 }, NOW),
      placePiece(state, state.hand[0].handId, { row: 99, column: 99 }, NOW),
    ];

    for (const attempt of attempts) {
      expect(attempt.ok).toBe(false);
      expect(attempt.events).toEqual([]);
      expect(attempt.state).toBe(state);
    }
    expect(state).toEqual(before);
  });
});
