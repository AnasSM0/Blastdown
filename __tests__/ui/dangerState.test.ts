import { applyRewardedDefuse, createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import { resolveDangerState } from "../../src/ui/dangerState";

const NOW = 1_752_800_000_000;

function stateWithTimers(...remaining: number[]): GameState {
  const state = createInitialGameState("danger-test", NOW);
  return {
    ...state,
    activeTimers: Object.fromEntries(
      remaining.map((remainingTurns, index) => {
        const id = `timer-${index}`;
        return [
          id,
          {
            id,
            shapeId: "single",
            remainingTurns,
            placedOnTurn: index,
            colorId: "cyan",
          },
        ];
      }),
    ),
  };
}

describe("resolveDangerState", () => {
  it("maps no timers to calm", () => {
    expect(resolveDangerState(stateWithTimers())).toEqual({
      level: "calm",
      lowestTimer: null,
      intensity: 0,
      pulseDurationMs: null,
      tone: "default",
    });
  });

  it.each([
    [7, "safe", "cool", 2000],
    [5, "safe", "cool", 2000],
    [4, "watch", "neutral", 1600],
    [3, "caution", "warm", 1200],
    [2, "warning", "warning", 800],
    [1, "critical", "critical", 500],
  ] as const)("maps timer %i to %s/%s at %ims", (timer, level, tone, pulseDurationMs) => {
    expect(resolveDangerState(stateWithTimers(timer))).toMatchObject({
      level,
      tone,
      lowestTimer: timer,
      pulseDurationMs,
    });
  });

  it("always uses the lowest active timer", () => {
    expect(resolveDangerState(stateWithTimers(7, 4, 2, 5)).lowestTimer).toBe(2);
  });

  it("decreases after a rewarded defuse removes the lowest timer", () => {
    const state = stateWithTimers(1, 4);
    const grid: GridCell[][] = state.grid.map((row) => [...row]);
    grid[0][0] = { kind: "timed", pieceInstanceId: "timer-0", colorId: "cyan" };
    grid[1][1] = { kind: "timed", pieceInstanceId: "timer-1", colorId: "purple" };
    const before = { ...state, grid };
    const after = applyRewardedDefuse(before, NOW + 1).state;
    expect(resolveDangerState(before).level).toBe("critical");
    expect(resolveDangerState(after)).toMatchObject({ level: "watch", lowestTimer: 4 });
  });

  it("clears when the final timed piece is removed", () => {
    const state = stateWithTimers(2);
    const grid: GridCell[][] = state.grid.map((row) => [...row]);
    grid[0][0] = { kind: "timed", pieceInstanceId: "timer-0", colorId: "cyan" };
    const after = applyRewardedDefuse({ ...state, grid }, NOW + 1).state;
    expect(resolveDangerState(after).level).toBe("calm");
  });
});
