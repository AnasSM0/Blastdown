import { createInitialGameState } from "../../src/domain/game";
import {
  canActivateFreeze,
  canApplyRewardedDefuse,
  canRevive,
  getRewardedDefuseTarget,
} from "../../src/domain/selectors";
import type { ActiveTimedPiece, GameState } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function timer(id: string, remainingTurns: number, placedOnTurn: number): ActiveTimedPiece {
  return { id, shapeId: "single", remainingTurns, placedOnTurn, colorId: "cyan" };
}

function withTimers(...timers: ActiveTimedPiece[]): GameState {
  return {
    ...createInitialGameState("sel-seed", NOW),
    status: "playing",
    activeTimers: Object.fromEntries(timers.map((t) => [t.id, t])),
  };
}

describe("getRewardedDefuseTarget", () => {
  it("returns null with no active timers", () => {
    expect(getRewardedDefuseTarget(withTimers())).toBeNull();
  });

  it("picks the lowest remaining timer", () => {
    const target = getRewardedDefuseTarget(withTimers(timer("a", 5, 1), timer("b", 2, 2)));
    expect(target?.id).toBe("b");
  });

  it("breaks ties by earliest placement", () => {
    const target = getRewardedDefuseTarget(withTimers(timer("late", 3, 9), timer("early", 3, 4)));
    expect(target?.id).toBe("early");
  });
});

describe("reward capability predicates", () => {
  it("canActivateFreeze needs a timer and is false while frozen or at the cap", () => {
    expect(canActivateFreeze(withTimers())).toBe(false);
    expect(canActivateFreeze(withTimers(timer("a", 3, 1)))).toBe(true);
    expect(canActivateFreeze({ ...withTimers(timer("a", 3, 1)), freezeTurnsRemaining: 2 })).toBe(
      false,
    );
    expect(canActivateFreeze({ ...withTimers(timer("a", 3, 1)), rewardedFreezeUses: 2 })).toBe(
      false,
    );
  });

  it("canApplyRewardedDefuse needs a timer and available uses", () => {
    expect(canApplyRewardedDefuse(withTimers())).toBe(false);
    expect(canApplyRewardedDefuse(withTimers(timer("a", 3, 1)))).toBe(true);
    expect(canApplyRewardedDefuse({ ...withTimers(timer("a", 3, 1)), rewardedDefuseUses: 2 })).toBe(
      false,
    );
  });

  it("canRevive only from game over, once per run", () => {
    const over: GameState = { ...createInitialGameState("s", NOW), status: "gameOver" };
    expect(canRevive(over)).toBe(true);
    expect(canRevive({ ...over, reviveUsed: true })).toBe(false);
    expect(canRevive({ ...over, status: "playing" })).toBe(false);
  });
});
