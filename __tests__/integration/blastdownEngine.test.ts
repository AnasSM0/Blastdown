import {
  activateFreeze,
  applyRevive,
  applyRewardedDefuse,
  createInitialGameState,
  placePiece,
} from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import type { GameEvent } from "../../src/domain/events";
import { getShapeById } from "../../src/domain/shapes";
import { canPlaceShapeAnywhere } from "../../src/domain/gameOver";

const NOW = 1_752_800_000_000;

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function craftState(overrides: Partial<GameState>, seed = "bd-seed"): GameState {
  return { ...createInitialGameState(seed, NOW), ...overrides };
}

describe("BlastDown engine integration", () => {
  it("full explosion lifecycle: expiry creates rubble, a later line clears it", () => {
    // A doomed single at (7,0) with row 7 partially prepared.
    const grid = makeEmptyGrid(8);
    grid[7][0] = { kind: "timed", pieceInstanceId: "doomed", colorId: "purple" };
    for (let column = 1; column < 6; column++) {
      grid[7][column] = { kind: "normal", colorId: "cyan" };
    }
    let state = craftState({
      grid,
      hand: [
        { handId: "t1", shapeId: "single", colorId: "amber" },
        { handId: "t2", shapeId: "single", colorId: "amber" },
        { handId: "t3", shapeId: "single", colorId: "amber" },
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

    // Turn 1: place far away; doomed expires and becomes rubble.
    let result = placePiece(state, "t1", { row: 0, column: 0 }, NOW);
    state = result.state;
    expect(state.explosions).toBe(1);
    expect(state.grid[7][0].kind).toBe("rubble");

    // The explosion may have added adjacent rubble; (7,1)..(7,5) were
    // occupied so candidates were (6,0) and (7,1)-adjacent empties above
    // row 7. Fill the remaining gaps of row 7 to clear it.
    const row7Gaps: number[] = [];
    for (let column = 0; column < 8; column++) {
      if (state.grid[7][column].kind === "empty") {
        row7Gaps.push(column);
      }
    }
    expect(row7Gaps.length).toBeGreaterThan(0);
    expect(row7Gaps.length).toBeLessThanOrEqual(2);

    let handIndex = 2;
    for (const column of row7Gaps) {
      result = placePiece(state, `t${handIndex}`, { row: 7, column }, NOW);
      expect(result.ok).toBe(true);
      state = result.state;
      handIndex += 1;
    }

    // Row 7 cleared, taking its rubble with it.
    expect(state.grid[7].every((cell) => cell.kind === "empty")).toBe(true);
    expect(state.rubbleCleared).toBeGreaterThan(0);
  });

  it("freeze lasts exactly two successful placements, then timers resume", () => {
    const grid = makeEmptyGrid(8);
    grid[7][7] = { kind: "timed", pieceInstanceId: "watched", colorId: "purple" };
    let state = craftState({
      grid,
      hand: [
        { handId: "p1", shapeId: "single", colorId: "amber" },
        { handId: "p2", shapeId: "single", colorId: "amber" },
        { handId: "p3", shapeId: "single", colorId: "amber" },
        { handId: "p4", shapeId: "single", colorId: "amber" },
      ],
      activeTimers: {
        watched: {
          id: "watched",
          shapeId: "single",
          remainingTurns: 6,
          placedOnTurn: 1,
          colorId: "purple",
        },
      },
    });

    const freezeResult = activateFreeze(state, NOW);
    expect(freezeResult.ok).toBe(true);
    state = freezeResult.state;
    expect(state.rewardedFreezeUses).toBe(1);

    // Invalid placement first: must not consume the freeze.
    const invalid = placePiece(state, "p1", { row: 7, column: 7 }, NOW);
    expect(invalid.ok).toBe(false);
    expect(invalid.state.freezeTurnsRemaining).toBe(2);

    state = placePiece(state, "p1", { row: 0, column: 0 }, NOW).state;
    expect(state.activeTimers.watched.remainingTurns).toBe(6);
    state = placePiece(state, "p2", { row: 0, column: 2 }, NOW).state;
    expect(state.activeTimers.watched.remainingTurns).toBe(6);
    expect(state.freezeTurnsRemaining).toBe(0);

    state = placePiece(state, "p3", { row: 0, column: 4 }, NOW).state;
    expect(state.activeTimers.watched.remainingTurns).toBe(5);
  });

  it("rewarded defuse picks the lowest timer and leaves untimed blocks that still clear", () => {
    const grid = makeEmptyGrid(8);
    for (let column = 0; column < 6; column++) {
      grid[7][column] = { kind: "normal", colorId: "cyan" };
    }
    grid[7][6] = { kind: "timed", pieceInstanceId: "low", colorId: "purple" };
    grid[0][0] = { kind: "timed", pieceInstanceId: "high", colorId: "cyan" };
    let state = craftState({
      grid,
      hand: [
        { handId: "p1", shapeId: "single", colorId: "amber" },
        { handId: "p2", shapeId: "single", colorId: "amber" },
      ],
      activeTimers: {
        low: {
          id: "low",
          shapeId: "single",
          remainingTurns: 2,
          placedOnTurn: 3,
          colorId: "purple",
        },
        high: {
          id: "high",
          shapeId: "single",
          remainingTurns: 7,
          placedOnTurn: 5,
          colorId: "cyan",
        },
      },
    });

    const defuseResult = applyRewardedDefuse(state, NOW);
    expect(defuseResult.ok).toBe(true);
    state = defuseResult.state;
    expect(state.grid[7][6]).toEqual({ kind: "normal", colorId: "purple" });
    expect(state.activeTimers.low).toBeUndefined();
    expect(state.activeTimers.high).toBeDefined();

    // The defused (now normal) block still participates in a line clear.
    const clearResult = placePiece(state, "p1", { row: 7, column: 7 }, NOW);
    expect(clearResult.ok).toBe(true);
    expect(clearResult.state.grid[7].every((cell) => cell.kind === "empty")).toBe(true);
  });

  it("revive restores a failed run and play continues", () => {
    const grid = makeEmptyGrid(8);
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 8; column++) {
        grid[row][column] = { kind: "normal", colorId: "cyan" };
      }
    }
    grid[2][2] = { kind: "rubble", explosionId: "e-old" };
    grid[5][5] = { kind: "timed", pieceInstanceId: "survivor", colorId: "purple" };
    let state = craftState({
      grid,
      status: "gameOver",
      score: 777,
      combo: 2,
      activeTimers: {
        survivor: {
          id: "survivor",
          shapeId: "single",
          remainingTurns: 4,
          placedOnTurn: 9,
          colorId: "purple",
        },
      },
      hand: [{ handId: "stuck", shapeId: "line4v", colorId: "amber" }],
    });

    const reviveResult = applyRevive(state, NOW);
    expect(reviveResult.ok).toBe(true);
    state = reviveResult.state;

    expect(state.status).toBe("playing");
    expect(state.score).toBe(777);
    expect(state.combo).toBe(0);
    expect(state.grid[2][2]).toEqual({ kind: "empty" });
    expect(state.activeTimers.survivor.remainingTurns).toBe(6);
    expect(state.reviveUsed).toBe(true);

    // Play continues with the replacement hand.
    const nextPiece = state.hand[0];
    const shape = getShapeById(nextPiece.shapeId)!;
    expect(canPlaceShapeAnywhere(state.grid, shape)).toBe(true);

    // A second revive attempt (e.g. after another game over) is rejected.
    const again = applyRevive({ ...state, status: "gameOver" }, NOW);
    expect(again.ok).toBe(false);
  });

  it("same seed and action sequence reproduce identical states and events, power-ups included", () => {
    const script = (seed: string): { states: GameState[]; events: GameEvent[][] } => {
      const grid = makeEmptyGrid(8);
      grid[6][6] = { kind: "timed", pieceInstanceId: "bomb", colorId: "purple" };
      let state = craftState(
        {
          grid,
          hand: [
            { handId: "s1", shapeId: "single", colorId: "amber" },
            { handId: "s2", shapeId: "single", colorId: "amber" },
            { handId: "s3", shapeId: "single", colorId: "amber" },
          ],
          activeTimers: {
            bomb: {
              id: "bomb",
              shapeId: "single",
              remainingTurns: 2,
              placedOnTurn: 1,
              colorId: "purple",
            },
          },
        },
        seed,
      );
      const states: GameState[] = [state];
      const events: GameEvent[][] = [];

      const record = (result: { state: GameState; events: GameEvent[] }): void => {
        state = result.state;
        states.push(state);
        events.push(result.events);
      };

      record(activateFreeze(state, NOW));
      record(placePiece(state, "s1", { row: 0, column: 0 }, NOW));
      record(placePiece(state, "s2", { row: 0, column: 2 }, NOW));
      // Freeze exhausted; this placement decrements bomb 2 -> 1.
      record(placePiece(state, "s3", { row: 0, column: 4 }, NOW));
      // Rewarded defuse saves it deterministically.
      record(applyRewardedDefuse(state, NOW));
      return { states, events };
    };

    const first = script("replay-bd");
    const second = script("replay-bd");
    expect(first.states).toEqual(second.states);
    expect(first.events).toEqual(second.events);
  });

  it("rejected power-up actions leave state, rng, and counters untouched", () => {
    const state = craftState({
      rewardedFreezeUses: 2,
      rewardedDefuseUses: 2,
      activeTimers: {},
    });
    const before = JSON.parse(JSON.stringify(state));

    const freeze = activateFreeze(state, NOW);
    const defuse = applyRewardedDefuse(state, NOW);
    const revive = applyRevive(state, NOW);

    for (const attempt of [freeze, defuse, revive]) {
      expect(attempt.ok).toBe(false);
      expect(attempt.state).toBe(state);
      expect(attempt.events).toEqual([]);
    }
    expect(state).toEqual(before);
  });
});
