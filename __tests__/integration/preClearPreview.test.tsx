import { act, fireEvent, render } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";
import { State } from "react-native-gesture-handler";
import { getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function emptyGrid(): GridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
}

function previewState(): GameState {
  const grid = emptyGrid();
  for (let column = 1; column < 8; column++) {
    grid[0][column] = { kind: "normal", colorId: "purple" };
  }
  for (let column = 0; column < 8; column++) {
    if (column !== 1) {
      grid[1][column] = { kind: "normal", colorId: "amber" };
    }
  }
  return {
    ...createInitialGameState("preclear-ui", NOW),
    grid,
    hand: [
      { handId: "candidate", shapeId: "single", colorId: "cyan" },
      { handId: "spare", shapeId: "single", colorId: "purple" },
    ],
  };
}

function options() {
  return {
    seed: "preclear-ui",
    now: () => NOW,
    nextSeed: () => "restart",
    initialState: previewState(),
  };
}

describe("pre-clear interaction lifecycle", () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("replaces the old tap-position prediction as the logical anchor changes", async () => {
    const view = await render(<GameScreenContent controllerOptions={options()} boardSize={328} />);
    await fireEvent.press(view.getByTestId("tray-piece-candidate"));

    await fireEvent(view.getByTestId("cell-0-0"), "pressIn");
    expect(view.getByTestId("preclear-row-0")).toBeTruthy();

    await fireEvent(view.getByTestId("cell-0-0"), "pressOut");
    await fireEvent(view.getByTestId("cell-1-1"), "pressIn");
    expect(view.queryByTestId("preclear-row-0")).toBeNull();
    expect(view.getByTestId("preclear-row-1")).toBeTruthy();

    await fireEvent(view.getByTestId("cell-1-1"), "pressOut");
    await fireEvent(view.getByTestId("cell-3-3"), "pressIn");
    expect(view.queryAllByTestId(/^preclear-/)).toHaveLength(0);
  });

  it("clears the prediction on drop and lets the committed clear effect take over", async () => {
    const view = await render(<GameScreenContent controllerOptions={options()} boardSize={328} />);
    await fireEvent.press(view.getByTestId("tray-piece-candidate"));
    await fireEvent(view.getByTestId("cell-0-0"), "pressIn");
    expect(view.getByTestId("preclear-row-0")).toBeTruthy();

    await fireEvent.press(view.getByTestId("cell-0-0"));

    expect(view.queryAllByTestId(/^preclear-/)).toHaveLength(0);
    expect(view.queryByTestId("tray-piece-candidate")).toBeNull();
    expect(view.getByTestId("effects-layer")).toBeTruthy();
    expect(view.getByTestId("clear-lane-row-0")).toBeTruthy();
    expect(view.getByTestId("clear-flash-0-0")).toBeTruthy();
  });

  it("removes a drag prediction on native cancellation without placing the piece", async () => {
    const view = await render(<GameScreenContent controllerOptions={options()} boardSize={328} />);
    const gesture = getByGestureTestId("tray-drag-candidate");
    const base = {
      handlerTag: gesture.handlerTag,
      numberOfPointers: 1,
      absoluteX: 24,
      absoluteY: 74,
      x: 24,
      y: 74,
      translationX: 0,
      translationY: 0,
      velocityX: 0,
      velocityY: 0,
    };

    await act(() => {
      DeviceEventEmitter.emit("onGestureHandlerStateChange", {
        ...base,
        state: State.BEGAN,
        oldState: State.UNDETERMINED,
      });
      DeviceEventEmitter.emit("onGestureHandlerStateChange", {
        ...base,
        state: State.ACTIVE,
        oldState: State.BEGAN,
      });
      DeviceEventEmitter.emit("onGestureHandlerEvent", { ...base, state: State.ACTIVE });
    });
    expect(view.getByTestId("preclear-row-0")).toBeTruthy();

    await act(() => {
      DeviceEventEmitter.emit("onGestureHandlerStateChange", {
        ...base,
        state: State.CANCELLED,
        oldState: State.ACTIVE,
      });
    });

    expect(view.queryAllByTestId(/^preclear-/)).toHaveLength(0);
    expect(view.getByTestId("tray-piece-candidate")).toBeTruthy();
  });
});
