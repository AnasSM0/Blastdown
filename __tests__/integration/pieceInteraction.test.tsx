import { act, fireEvent, render } from "@testing-library/react-native";
import { DeviceEventEmitter, StyleSheet, type ViewStyle } from "react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function interactionState(handCount = 2): GameState {
  return {
    ...createInitialGameState("b07-interaction", NOW),
    hand: [
      { handId: "hand-0-0", shapeId: "single", colorId: "cyan" },
      { handId: "hand-0-1", shapeId: "single", colorId: "purple" },
      { handId: "hand-0-2", shapeId: "single", colorId: "amber" },
    ].slice(0, handCount),
  };
}

function options(state = interactionState()) {
  return {
    seed: "b07-interaction",
    now: () => NOW,
    nextSeed: () => "b07-restart",
    initialState: state,
  };
}

function dragPoint(absoluteX: number, absoluteY: number) {
  return { absoluteX, absoluteY };
}

function flat(node: { props: Record<string, unknown> }): ViewStyle {
  return (StyleSheet.flatten(node.props.style as ViewStyle) ?? {}) as ViewStyle;
}

describe("piece drag interaction lifecycle", () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("rejects an outside drop without mutation, returns the piece, and does not block the next pick", async () => {
    const view = await render(<GameScreenContent controllerOptions={options()} boardSize={328} />);
    const gesture = getByGestureTestId("tray-drag-hand-0-0");

    await act(() => fireGestureHandler(gesture, [dragPoint(500, 500)]));

    expect(view.getByTestId("drag-ghost")).toBeTruthy();
    expect(view.getByTestId("tray-piece-hand-0-0")).toBeTruthy();
    expect(view.getAllByTestId(/^tray-piece-/)).toHaveLength(2);

    await fireEvent.press(view.getByTestId("tray-piece-hand-0-1"));
    expect(view.getByTestId("tray-piece-hand-0-1").props.accessibilityState?.selected).toBe(true);

    await act(() => jest.advanceTimersByTime(180));
    expect(view.queryByTestId("drag-ghost")).toBeNull();
  });

  it("commits a valid release exactly once and removes the ghost before the board settles", async () => {
    const view = await render(<GameScreenContent controllerOptions={options()} boardSize={328} />);
    const gesture = getByGestureTestId("tray-drag-hand-0-0");

    await act(() => fireGestureHandler(gesture, [dragPoint(24, 78)]));

    expect(view.queryByTestId("drag-ghost")).toBeNull();
    expect(view.queryByTestId("tray-piece-hand-0-0")).toBeNull();
    expect(view.getAllByTestId(/^timer-badge-/)).toHaveLength(1);
    expect(view.getByTestId("block-0-0")).toBeTruthy();

    await act(() => fireGestureHandler(gesture, [dragPoint(24, 78)]));
    expect(view.getAllByTestId(/^timer-badge-/)).toHaveLength(1);
  });

  it("allows tap selection and drag completion to race without a second placement", async () => {
    const view = await render(<GameScreenContent controllerOptions={options()} boardSize={328} />);
    const stalePieceNode = view.getByTestId("tray-piece-hand-0-0");
    const gesture = getByGestureTestId("tray-drag-hand-0-0");

    await fireEvent.press(stalePieceNode);
    await act(() => fireGestureHandler(gesture, [dragPoint(24, 78)]));
    await fireEvent.press(stalePieceNode);
    await fireEvent.press(view.getByTestId("cell-2-2"));

    expect(view.getAllByTestId(/^timer-badge-/)).toHaveLength(1);
    expect(view.getAllByTestId(/^tray-piece-/)).toHaveLength(1);
  });

  it("clears an active ghost and selection when Pause becomes authoritative", async () => {
    const view = await render(<GameScreenContent controllerOptions={options()} boardSize={328} />);
    const gesture = getByGestureTestId("tray-drag-hand-0-0");
    const base = {
      handlerTag: gesture.handlerTag,
      numberOfPointers: 1,
      absoluteX: 24,
      absoluteY: 78,
      x: 24,
      y: 78,
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
    expect(view.getByTestId("drag-ghost")).toBeTruthy();
    expect(view.queryAllByTestId(/^preview-/)).toHaveLength(0);

    await fireEvent.press(view.getByTestId("pause-button"));

    expect(view.getByTestId("pause-overlay")).toBeTruthy();
    expect(view.queryByTestId("drag-ghost")).toBeNull();
    expect(view.getByTestId("tray-piece-hand-0-0").props.accessibilityState?.selected).toBe(false);
  });

  it("refills with the exact generated hand and keeps all new pieces immediately usable", async () => {
    const view = await render(
      <GameScreenContent controllerOptions={options(interactionState(1))} boardSize={328} />,
    );

    await fireEvent.press(view.getByTestId("tray-piece-hand-0-0"));
    await fireEvent.press(view.getByTestId("cell-0-0"));

    const refilled = view.getAllByTestId(/^tray-piece-hand-1-/);
    expect(refilled).toHaveLength(3);
    for (const slot of [0, 1, 2]) {
      const refill = flat(view.getByTestId(`tray-refill-${slot}`));
      expect(refill.opacity).toBeDefined();
      expect(refill.transform).toBeDefined();
    }

    await fireEvent.press(refilled[0]);
    await fireEvent.press(view.getByTestId("cell-3-3"));
    expect(view.getAllByTestId(/^tray-piece-hand-1-/)).toHaveLength(2);
  });
});
