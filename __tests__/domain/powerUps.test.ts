import {
  activateFreeze,
  applyRevive,
  applyRewardedDefuse,
  createInitialGameState,
  placePiece,
} from "../../src/domain/game";
import type { ActiveTimedPiece, GameState, GridCell } from "../../src/domain/gameTypes";
import type { GameEvent } from "../../src/domain/events";
import { getShapeById } from "../../src/domain/shapes";

const NOW = 1_752_800_000_000;

function craftState(overrides: Partial<GameState>): GameState {
  return { ...createInitialGameState("powerup-seed", NOW), ...overrides };
}

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function eventTypes(events: GameEvent[]): string[] {
  return events.map((event) => event.type);
}

function timer(
  id: string,
  remainingTurns: number,
  placedOnTurn: number,
  colorId = "purple",
): ActiveTimedPiece {
  return { id, shapeId: "single", remainingTurns, placedOnTurn, colorId };
}

function basicHand(): GameState["hand"] {
  return [
    { handId: "h1", shapeId: "single", colorId: "amber" },
    { handId: "h2", shapeId: "single", colorId: "amber" },
  ];
}

describe("freeze power-up", () => {
  it("activates: freeze counter 2, use counted, freezeActivated emitted", () => {
    const state = craftState({ hand: basicHand() });
    const result = activateFreeze(state, NOW);
    expect(result.ok).toBe(true);
    expect(result.state.freezeTurnsRemaining).toBe(2);
    expect(result.state.rewardedFreezeUses).toBe(1);
    expect(eventTypes(result.events)).toContain("freezeActivated");
  });

  it("rejects when already at the max rewarded freezes", () => {
    const state = craftState({ rewardedFreezeUses: 2 });
    const result = activateFreeze(state, NOW);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it("rejects while a freeze is already active", () => {
    const state = craftState({ freezeTurnsRemaining: 1 });
    const result = activateFreeze(state, NOW);
    expect(result.ok).toBe(false);
  });

  it("rejects when the run is not playing", () => {
    const state = craftState({ status: "gameOver" });
    const result = activateFreeze(state, NOW);
    expect(result.ok).toBe(false);
  });

  it("frozen placement: timers hold, freeze consumed, freezeConsumed emitted", () => {
    const grid = makeEmptyGrid(8);
    grid[7][0] = { kind: "timed", pieceInstanceId: "old", colorId: "purple" };
    const state = craftState({
      grid,
      hand: basicHand(),
      freezeTurnsRemaining: 2,
      activeTimers: { old: timer("old", 3, 1) },
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);

    expect(result.state.activeTimers.old.remainingTurns).toBe(3);
    expect(result.state.freezeTurnsRemaining).toBe(1);
    expect(eventTypes(result.events)).toContain("freezeConsumed");
    expect(eventTypes(result.events)).not.toContain("timerChanged");
    expect(eventTypes(result.events)).not.toContain("timerWarning");
  });

  it("newly placed pieces still receive timers during a freeze", () => {
    const state = craftState({ hand: basicHand(), freezeTurnsRemaining: 2 });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(Object.keys(result.state.activeTimers)).toHaveLength(1);
  });

  it("lasts exactly two successful placements", () => {
    const grid = makeEmptyGrid(8);
    grid[7][0] = { kind: "timed", pieceInstanceId: "old", colorId: "purple" };
    let state = craftState({
      grid,
      hand: [
        { handId: "h1", shapeId: "single", colorId: "amber" },
        { handId: "h2", shapeId: "single", colorId: "amber" },
        { handId: "h3", shapeId: "single", colorId: "amber" },
        { handId: "h4", shapeId: "single", colorId: "amber" },
      ],
      freezeTurnsRemaining: 2,
      activeTimers: { old: timer("old", 5, 1) },
    });

    state = placePiece(state, "h1", { row: 0, column: 0 }, NOW).state;
    expect(state.activeTimers.old.remainingTurns).toBe(5);
    state = placePiece(state, "h2", { row: 0, column: 2 }, NOW).state;
    expect(state.activeTimers.old.remainingTurns).toBe(5);
    expect(state.freezeTurnsRemaining).toBe(0);

    // Third placement decrements again. The two pieces placed during the
    // freeze also decrement now.
    state = placePiece(state, "h3", { row: 0, column: 4 }, NOW).state;
    expect(state.activeTimers.old.remainingTurns).toBe(4);
  });

  it("an invalid placement does not consume freeze", () => {
    const grid = makeEmptyGrid(8);
    grid[0][0] = { kind: "normal", colorId: "cyan" };
    const state = craftState({
      grid,
      hand: basicHand(),
      freezeTurnsRemaining: 2,
    });
    const result = placePiece(state, "h1", { row: 0, column: 0 }, NOW);
    expect(result.ok).toBe(false);
    expect(result.state.freezeTurnsRemaining).toBe(2);
  });
});

describe("rewarded defuse power-up", () => {
  function stateWithTimers(): GameState {
    const grid = makeEmptyGrid(8);
    grid[1][1] = { kind: "timed", pieceInstanceId: "low", colorId: "purple" };
    grid[1][2] = { kind: "timed", pieceInstanceId: "low", colorId: "purple" };
    grid[5][5] = { kind: "timed", pieceInstanceId: "high", colorId: "cyan" };
    return craftState({
      grid,
      hand: basicHand(),
      activeTimers: {
        low: {
          id: "low",
          shapeId: "line2h",
          remainingTurns: 2,
          placedOnTurn: 3,
          colorId: "purple",
        },
        high: timer("high", 6, 5, "cyan"),
      },
    });
  }

  it("defuses the piece with the lowest remaining timer into normal untimed blocks", () => {
    const state = stateWithTimers();
    const result = applyRewardedDefuse(state, NOW);

    expect(result.ok).toBe(true);
    expect(result.state.activeTimers.low).toBeUndefined();
    expect(result.state.activeTimers.high).toBeDefined();
    expect(result.state.grid[1][1]).toEqual({ kind: "normal", colorId: "purple" });
    expect(result.state.grid[1][2]).toEqual({ kind: "normal", colorId: "purple" });
    expect(result.state.rewardedDefuseUses).toBe(1);
    expect(result.state.piecesDefused).toBe(1);
    // No score change from a rewarded defuse.
    expect(result.state.score).toBe(state.score);
    const defused = result.events.find((event) => event.type === "defuseActivated");
    expect(defused).toBeDefined();
    if (defused?.type === "defuseActivated") {
      expect(defused.pieceId).toBe("low");
    }
  });

  it("resolves timer ties deterministically by earliest placement", () => {
    const grid = makeEmptyGrid(8);
    grid[1][1] = { kind: "timed", pieceInstanceId: "older", colorId: "purple" };
    grid[5][5] = { kind: "timed", pieceInstanceId: "newer", colorId: "cyan" };
    const state = craftState({
      grid,
      hand: basicHand(),
      activeTimers: {
        newer: timer("newer", 3, 8, "cyan"),
        older: timer("older", 3, 2),
      },
    });
    const result = applyRewardedDefuse(state, NOW);
    expect(result.state.activeTimers.older).toBeUndefined();
    expect(result.state.activeTimers.newer).toBeDefined();
  });

  it("rejects when no active timed pieces exist", () => {
    const state = craftState({ activeTimers: {} });
    const result = applyRewardedDefuse(state, NOW);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it("rejects beyond the max rewarded defuses", () => {
    const state = { ...stateWithTimers(), rewardedDefuseUses: 2 };
    const result = applyRewardedDefuse(state, NOW);
    expect(result.ok).toBe(false);
  });

  it("rejects when the run is not playing", () => {
    const state = { ...stateWithTimers(), status: "gameOver" as const };
    const result = applyRewardedDefuse(state, NOW);
    expect(result.ok).toBe(false);
  });
});

describe("revive power-up", () => {
  function gameOverState(): GameState {
    const grid = makeEmptyGrid(8);
    // Top half full of normal blocks, rubble pockets, one timed survivor.
    // The bottom rows stay open so a post-revive small/medium hand always
    // fits (revive re-checks game over).
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 8; column++) {
        grid[row][column] = { kind: "normal", colorId: "cyan" };
      }
    }
    grid[0][0] = { kind: "empty" };
    grid[3][3] = { kind: "rubble", explosionId: "e1" };
    grid[3][4] = { kind: "rubble", explosionId: "e1" };
    grid[6][6] = { kind: "timed", pieceInstanceId: "survivor", colorId: "purple" };
    return craftState({
      grid,
      status: "gameOver",
      score: 1234,
      combo: 3,
      activeTimers: { survivor: timer("survivor", 8, 4) },
      hand: [{ handId: "stuck", shapeId: "line4h", colorId: "amber" }],
    });
  }

  it("restores the run: rubble cleared, timers +2 capped, new small/medium hand", () => {
    const state = gameOverState();
    const result = applyRevive(state, NOW);

    expect(result.ok).toBe(true);
    expect(result.state.status).toBe("playing");
    expect(result.state.grid[3][3]).toEqual({ kind: "empty" });
    expect(result.state.grid[3][4]).toEqual({ kind: "empty" });
    // 8 + 2 capped at 9.
    expect(result.state.activeTimers.survivor.remainingTurns).toBe(9);
    expect(result.state.score).toBe(1234);
    expect(result.state.combo).toBe(0);
    expect(result.state.reviveUsed).toBe(true);
    expect(result.state.hand).toHaveLength(3);
    for (const piece of result.state.hand) {
      const category = getShapeById(piece.shapeId)!.category;
      expect(["small", "medium"]).toContain(category);
    }
    expect(eventTypes(result.events)).toContain("reviveApplied");
    expect(eventTypes(result.events)).toContain("handRefilled");
  });

  it("adds two turns without exceeding the cap for low timers", () => {
    const state = {
      ...gameOverState(),
      activeTimers: { survivor: timer("survivor", 3, 4) },
    };
    const result = applyRevive(state, NOW);
    expect(result.state.activeTimers.survivor.remainingTurns).toBe(5);
  });

  it("rejects a second revive", () => {
    const state = { ...gameOverState(), reviveUsed: true };
    const result = applyRevive(state, NOW);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it("rejects while still playing", () => {
    const state = { ...gameOverState(), status: "playing" as const };
    const result = applyRevive(state, NOW);
    expect(result.ok).toBe(false);
  });

  it("advances the rng deterministically for the replacement hand", () => {
    const first = applyRevive(gameOverState(), NOW);
    const second = applyRevive(gameOverState(), NOW);
    expect(first.state).toEqual(second.state);
    expect(first.state.rngState).not.toBe(gameOverState().rngState);
  });

  it("a rejected revive returns the exact same state object (no mutation)", () => {
    const state = { ...gameOverState(), reviveUsed: true };
    const before = JSON.parse(JSON.stringify(state));
    const result = applyRevive(state, NOW);
    expect(result.state).toBe(state);
    expect(state).toEqual(before);
  });
});
