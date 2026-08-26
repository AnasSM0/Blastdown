import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler } from "react-native";

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

function renderGame(onExit = jest.fn(), onRestart?: () => void) {
  return render(
    <GameScreenContent
      controllerOptions={{ seed: "pause-seed", now: () => NOW, initialState: playingState() }}
      boardSize={328}
      adService={createMockAdService()}
      onExit={onExit}
      onRestart={onRestart}
    />,
  );
}

describe("pause flow", () => {
  let hardwareBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
  let backSubscription: jest.SpyInstance;

  beforeEach(() => {
    hardwareBack = undefined;
    backSubscription = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        hardwareBack = handler;
        return { remove: jest.fn() };
      });
  });

  afterEach(() => backSubscription.mockRestore());

  async function pressHardwareBack() {
    await act(async () => {
      expect(hardwareBack).toBeDefined();
      expect(hardwareBack?.({ type: "hardwareBackPress", timeStamp: Date.now() })).toBe(true);
    });
  }

  it("opens the pause menu and resumes", async () => {
    const result = await renderGame();
    expect(result.queryByTestId("pause-overlay")).toBeNull();

    await fireEvent.press(result.getByTestId("pause-button"));
    expect(result.getByTestId("pause-overlay")).toBeTruthy();

    await fireEvent.press(result.getByTestId("resume-button"));
    expect(result.queryByTestId("pause-overlay")).toBeNull();
  });

  it("opens Pause on hardware Back without consuming or abandoning the run", async () => {
    const onExit = jest.fn();
    const result = await renderGame(onExit);
    const timerBefore = result.getByText("2").props.children;

    await pressHardwareBack();

    expect(result.getByTestId("pause-overlay")).toBeTruthy();
    expect(result.getByText("2").props.children).toBe(timerBefore);
    expect(onExit).not.toHaveBeenCalled();
  });

  it("resumes the exact run when hardware Back is pressed on Pause", async () => {
    const result = await renderGame();
    await pressHardwareBack();
    expect(result.getByTestId("pause-overlay")).toBeTruthy();

    await pressHardwareBack();

    expect(result.queryByTestId("pause-overlay")).toBeNull();
    expect(result.getByText("2")).toBeTruthy();
  });

  it("requires restart confirmation and Cancel returns to Pause unchanged", async () => {
    const result = await renderGame();
    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-restart-button"));

    expect(result.getByTestId("restart-confirm")).toBeTruthy();
    expect(result.getByTestId("pause-overlay")).toBeTruthy();
    await fireEvent.press(result.getByTestId("restart-cancel-button"));
    expect(result.queryByTestId("restart-confirm")).toBeNull();
    expect(result.getByTestId("pause-overlay")).toBeTruthy();
    expect(result.getByText("2")).toBeTruthy();
  });

  it("restarts into a fresh run only after confirmation and closes the menu", async () => {
    const result = await renderGame();
    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-restart-button"));
    await fireEvent.press(result.getByTestId("restart-confirm-button"));
    expect(result.queryByTestId("pause-overlay")).toBeNull();
    expect(result.queryByTestId("restart-confirm")).toBeNull();
    // A fresh seeded run deals a full hand of three.
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(3);
    expect(result.queryByText("2")).toBeNull();
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
    await fireEvent.press(result.getByTestId("restart-confirm-button"));
    // Both overlays are gone after restart.
    expect(result.queryByTestId("pause-overlay")).toBeNull();
    expect(result.queryByTestId("defuse-confirm")).toBeNull();
  });

  it("treats rapid duplicate Restart confirmation as one action", async () => {
    const onRestart = jest.fn();
    const result = await renderGame(jest.fn(), onRestart);
    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-restart-button"));
    const confirm = result.getByTestId("restart-confirm-button");

    await fireEvent.press(confirm);
    await fireEvent.press(confirm);

    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(result.queryByTestId("pause-overlay")).toBeNull();
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(3);
  });
});
