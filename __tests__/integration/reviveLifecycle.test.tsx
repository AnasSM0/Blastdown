import { fireEvent, render } from "@testing-library/react-native";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import { createMockAdService } from "../../src/services/ads/MockAdService";
import type { AdService } from "../../src/services/ads/types";
import type { GameState, GridCell } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function emptyGrid(): GridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
}

/** A game-over run with rubble and one active timer, revive still available. */
function gameOverState(overrides: Partial<GameState> = {}): GameState {
  const grid = emptyGrid();
  grid[3][3] = { kind: "rubble", explosionId: "x1" };
  return {
    ...createInitialGameState("revive-seed", NOW),
    status: "gameOver",
    score: 8450,
    grid,
    activeTimers: {
      t1: { id: "t1", shapeId: "single", remainingTurns: 1, placedOnTurn: 1, colorId: "cyan" },
    },
    ...overrides,
  };
}

function renderOver(adService: AdService, onResults = jest.fn(), state = gameOverState()) {
  return render(
    <GameScreenContent
      controllerOptions={{ seed: "revive-seed", now: () => NOW, initialState: state }}
      boardSize={328}
      adService={adService}
      onResults={onResults}
    />,
  );
}

describe("revive lifecycle", () => {
  it("repairs and resumes the run on an earned reward, then shows SECOND CHANCE", async () => {
    const service = createMockAdService({ rewarded: { rewarded_revive: "earned" } });
    const result = await renderOver(service);

    expect(result.getByTestId("game-over-overlay")).toBeTruthy();

    await fireEvent.press(result.getByTestId("revive-button"));

    // Back in play: overlay gone, second-chance banner shown, reward spent.
    expect(result.queryByTestId("game-over-overlay")).toBeNull();
    expect(result.getByTestId("second-chance-banner")).toBeTruthy();
    expect(service.shown).toEqual(["rewarded_revive"]);
  });

  it.each(["closed", "error"] as const)(
    "leaves the game over unchanged when the revive reward is %s",
    async (outcome) => {
      const service = createMockAdService({ rewarded: { rewarded_revive: outcome } });
      const result = await renderOver(service);

      await fireEvent.press(result.getByTestId("revive-button"));

      // Still game over, no second chance.
      expect(result.getByTestId("game-over-overlay")).toBeTruthy();
      expect(result.queryByTestId("second-chance-banner")).toBeNull();
      expect(service.shown).toEqual(["rewarded_revive"]);
    },
  );

  it("offers no revive once the run's revive is already used", async () => {
    const service = createMockAdService();
    const result = await renderOver(service, jest.fn(), gameOverState({ reviveUsed: true }));

    expect(result.getByTestId("game-over-overlay")).toBeTruthy();
    expect(result.queryByTestId("revive-button")).toBeNull();
    expect(result.getByTestId("end-run-button")).toBeTruthy();
  });

  it("opens results on End Run", async () => {
    const service = createMockAdService();
    const onResults = jest.fn();
    const result = await renderOver(service, onResults);

    await fireEvent.press(result.getByTestId("end-run-button"));

    expect(onResults).toHaveBeenCalledTimes(1);
    expect(service.shown).toEqual([]);
  });
});
