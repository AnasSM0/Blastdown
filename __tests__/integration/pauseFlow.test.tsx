import { fireEvent, render } from "@testing-library/react-native";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import { createMockAdService } from "../../src/services/ads/MockAdService";
import type { GameState, GridCell } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function emptyGrid(): GridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
}

function playingState(): GameState {
  const grid = emptyGrid();
  grid[0][0] = { kind: "timed", pieceInstanceId: "t1", colorId: "cyan" };
  return {
    ...createInitialGameState("pause-seed", NOW),
    status: "playing",
    grid,
    activeTimers: {
      t1: { id: "t1", shapeId: "single", remainingTurns: 2, placedOnTurn: 1, colorId: "cyan" },
    },
  };
}

function renderGame(onExit = jest.fn()) {
  return render(
    <GameScreenContent
      controllerOptions={{ seed: "pause-seed", now: () => NOW, initialState: playingState() }}
      boardSize={328}
      adService={createMockAdService()}
      onExit={onExit}
    />,
  );
}

describe("pause flow", () => {
  it("opens the pause menu and resumes", async () => {
    const result = await renderGame();
    expect(result.queryByTestId("pause-overlay")).toBeNull();

    await fireEvent.press(result.getByTestId("pause-button"));
    expect(result.getByTestId("pause-overlay")).toBeTruthy();

    await fireEvent.press(result.getByTestId("resume-button"));
    expect(result.queryByTestId("pause-overlay")).toBeNull();
  });

  it("restarts into a fresh run and closes the menu", async () => {
    const result = await renderGame();
    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-restart-button"));
    expect(result.queryByTestId("pause-overlay")).toBeNull();
    // A fresh seeded run deals a full hand of three.
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(3);
  });

  it("returns to Home from the pause menu", async () => {
    const onExit = jest.fn();
    const result = await renderGame(onExit);
    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-home-button"));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(result.queryByTestId("pause-overlay")).toBeNull();
  });

  it("restart clears a pending defuse confirm card", async () => {
    const result = await renderGame();
    // Open the defuse confirm, then pause over it.
    await fireEvent.press(result.getByTestId("defuse-button"));
    expect(result.getByTestId("defuse-confirm")).toBeTruthy();
    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-restart-button"));
    // Both overlays are gone after restart.
    expect(result.queryByTestId("pause-overlay")).toBeNull();
    expect(result.queryByTestId("defuse-confirm")).toBeNull();
  });
});
