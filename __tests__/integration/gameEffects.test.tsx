import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

/** A run one move away from clearing row 0: columns 1–7 of row 0 are filled,
 *  and the hand's single at (0,0) completes it. */
function clearingState(): GameState {
  const grid = makeEmptyGrid(8);
  for (let column = 1; column < 8; column++) {
    grid[0][column] = { kind: "normal", colorId: "cyan" };
  }
  return {
    ...createInitialGameState("effects-seed", NOW),
    grid,
    hand: [
      { handId: "h-single", shapeId: "single", colorId: "amber" },
      { handId: "h-spare", shapeId: "single", colorId: "purple" },
    ],
  };
}

function explosionState(): GameState {
  const grid = makeEmptyGrid(8);
  grid[7][7] = { kind: "timed", pieceInstanceId: "doomed", colorId: "purple" };
  return {
    ...createInitialGameState("explosion-seed", NOW),
    grid,
    hand: [
      { handId: "h-trigger", shapeId: "single", colorId: "amber" },
      { handId: "h-follow", shapeId: "single", colorId: "cyan" },
    ],
    activeTimers: {
      doomed: {
        id: "doomed",
        shapeId: "single",
        remainingTurns: 1,
        placedOnTurn: 0,
        colorId: "purple",
      },
    },
  };
}

function consecutiveClearState(): GameState {
  const grid = makeEmptyGrid(8);
  for (let column = 1; column < 8; column++) {
    grid[0][column] = { kind: "normal", colorId: "cyan" };
    grid[1][column] = { kind: "normal", colorId: "purple" };
  }
  return {
    ...createInitialGameState("consecutive-effects", NOW),
    grid,
    hand: [
      { handId: "h-row-0", shapeId: "single", colorId: "amber" },
      { handId: "h-row-1", shapeId: "single", colorId: "cyan" },
    ],
  };
}

function explosionThenClearState(): GameState {
  const grid = makeEmptyGrid(8);
  grid[7][7] = { kind: "timed", pieceInstanceId: "doomed", colorId: "purple" };
  for (let column = 1; column < 8; column += 1) {
    grid[1][column] = { kind: "normal", colorId: "cyan" };
  }
  return {
    ...createInitialGameState("explosion-then-clear", NOW),
    grid,
    hand: [
      { handId: "h-trigger", shapeId: "single", colorId: "amber" },
      { handId: "h-clear", shapeId: "single", colorId: "cyan" },
    ],
    activeTimers: {
      doomed: {
        id: "doomed",
        shapeId: "single",
        remainingTurns: 1,
        placedOnTurn: 0,
        colorId: "purple",
      },
    },
  };
}

function dangerRecoveryState(): GameState {
  const state = explosionState();
  state.grid[6][6] = {
    kind: "timed",
    pieceInstanceId: "survivor",
    colorId: "cyan",
  };
  state.activeTimers.survivor = {
    id: "survivor",
    shapeId: "single",
    remainingTurns: 3,
    placedOnTurn: 0,
    colorId: "cyan",
  };
  return state;
}

function options(initialState: GameState) {
  return { seed: "effects-seed", now: () => NOW, nextSeed: () => "restart", initialState };
}

describe("gameplay effects pipeline", () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("keeps accepting placements while a line-clear sequence is active", async () => {
    const result = await render(
      <GameScreenContent controllerOptions={options(clearingState())} boardSize={328} />,
    );

    expect(result.queryByTestId("effects-layer")).toBeNull();

    await fireEvent.press(result.getByTestId("tray-piece-h-single"));
    await fireEvent.press(result.getByTestId("cell-0-0"));

    // Row 0 cleared -> a required sequence plays and its overlay is up. The
    // spare piece survived (only the single was consumed), so a run continues.
    expect(result.getByTestId("effects-layer")).toBeTruthy();
    expect(result.getByTestId("tray-piece-h-spare")).toBeTruthy();

    // Presentation is nonblocking: the next legal move lands while the first
    // turn's clear is still drawing, with no timer/debounce delay.
    await fireEvent.press(result.getByTestId("tray-piece-h-spare"));
    await fireEvent.press(result.getByTestId("cell-5-5"));
    expect(result.queryByTestId("tray-piece-h-spare")).toBeNull();

    // The earlier sequence remains independently alive until its own clock
    // completes; the second placement does not clear or restart it.
    expect(result.getByTestId("effects-layer")).toBeTruthy();
  });

  it("keeps accepting placements while an explosion sequence is active", async () => {
    const result = await render(
      <GameScreenContent controllerOptions={options(explosionState())} boardSize={328} />,
    );

    await fireEvent.press(result.getByTestId("tray-piece-h-trigger"));
    await fireEvent.press(result.getByTestId("cell-0-0"));
    expect(result.getByTestId("effects-layer")).toBeTruthy();

    await fireEvent.press(result.getByTestId("tray-piece-h-follow"));
    await fireEvent.press(result.getByTestId("cell-4-4"));

    expect(result.queryByTestId("tray-piece-h-follow")).toBeNull();
    expect(result.getByTestId("effects-layer")).toBeTruthy();
  });

  it("keeps consecutive turn effects alive together", async () => {
    const result = await render(
      <GameScreenContent controllerOptions={options(consecutiveClearState())} boardSize={328} />,
    );

    await fireEvent.press(result.getByTestId("tray-piece-h-row-0"));
    await fireEvent.press(result.getByTestId("cell-0-0"));
    expect(result.getByTestId("effects-layer")).toBeTruthy();

    await fireEvent.press(result.getByTestId("tray-piece-h-row-1"));
    await fireEvent.press(result.getByTestId("cell-1-0"));

    expect(result.getAllByTestId("effects-layer")).toHaveLength(2);
    expect(result.getAllByTestId(/^clear-flash-/)).toHaveLength(16);
  });

  it("keeps an explosion alive while the immediate next turn clears a line", async () => {
    const result = await render(
      <GameScreenContent controllerOptions={options(explosionThenClearState())} boardSize={328} />,
    );

    await fireEvent.press(result.getByTestId("tray-piece-h-trigger"));
    await fireEvent.press(result.getByTestId("cell-4-4"));
    expect(result.getByTestId("explosion-presentation")).toBeTruthy();

    await fireEvent.press(result.getByTestId("tray-piece-h-clear"));
    await fireEvent.press(result.getByTestId("cell-1-0"));

    expect(result.queryByTestId("tray-piece-h-clear")).toBeNull();
    expect(result.getAllByTestId("effects-layer")).toHaveLength(2);
    expect(result.getByTestId("explosion-presentation")).toBeTruthy();
    expect(result.getAllByTestId(/^clear-flash-/)).toHaveLength(8);
  });

  it("shows the post-explosion authoritative danger state while recovery is still active", async () => {
    const result = await render(
      <GameScreenContent controllerOptions={options(dangerRecoveryState())} boardSize={328} />,
    );

    await fireEvent.press(result.getByTestId("tray-piece-h-trigger"));
    await fireEvent.press(result.getByTestId("cell-0-0"));

    expect(result.getByTestId("explosion-presentation")).toBeTruthy();
    expect(
      result.getByTestId("board-danger-warning", { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      result.queryByTestId("board-danger-critical", { includeHiddenElements: true }),
    ).toBeNull();
  });

  it("consumes a duplicated native gesture completion exactly once", async () => {
    const success = jest.spyOn(Haptics, "notificationAsync");
    const initialState: GameState = {
      ...createInitialGameState("gesture-duplicate", NOW),
      hand: [
        { handId: "h-drag", shapeId: "single", colorId: "cyan" },
        { handId: "h-other", shapeId: "single", colorId: "purple" },
      ],
    };
    const result = await render(
      <GameScreenContent controllerOptions={options(initialState)} boardSize={328} />,
    );
    const gesture = getByGestureTestId("tray-drag-h-drag");
    const drop = { absoluteX: 24, absoluteY: 74 };

    await act(() => {
      fireGestureHandler(gesture, [drop]);
      fireGestureHandler(gesture, [drop]);
    });

    expect(result.queryByTestId("tray-piece-h-drag")).toBeNull();
    expect(success).toHaveBeenCalledTimes(1);
    success.mockRestore();
  });

  it("keeps Pause as an authoritative placement blocker", async () => {
    const result = await render(
      <GameScreenContent controllerOptions={options(explosionState())} boardSize={328} />,
    );

    await fireEvent.press(result.getByTestId("pause-button"));
    expect(result.getByTestId("pause-overlay")).toBeTruthy();
    await fireEvent.press(result.getByTestId("tray-piece-h-trigger"));
    await fireEvent.press(result.getByTestId("cell-0-0"));

    expect(result.getByTestId("tray-piece-h-trigger")).toBeTruthy();
  });

  it("keeps confirmation modals as authoritative placement blockers", async () => {
    const result = await render(
      <GameScreenContent controllerOptions={options(explosionState())} boardSize={328} />,
    );

    await fireEvent.press(result.getByTestId("defuse-button"));
    expect(result.getByTestId("defuse-confirm")).toBeTruthy();
    await fireEvent.press(result.getByTestId("tray-piece-h-trigger"));
    await fireEvent.press(result.getByTestId("cell-0-0"));

    expect(result.getByTestId("tray-piece-h-trigger")).toBeTruthy();
  });

  it("keeps Game Over as an authoritative placement blocker", async () => {
    const initialState = { ...explosionState(), status: "gameOver" as const };
    const result = await render(
      <GameScreenContent controllerOptions={options(initialState)} boardSize={328} />,
    );

    expect(result.getByTestId("game-over-overlay")).toBeTruthy();
    await fireEvent.press(result.getByTestId("tray-piece-h-trigger"));
    await fireEvent.press(result.getByTestId("cell-0-0"));

    expect(result.getByTestId("tray-piece-h-trigger")).toBeTruthy();
  });
});
