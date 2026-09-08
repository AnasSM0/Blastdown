import { fireEvent, render } from "@testing-library/react-native";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function rapidClearState(): GameState {
  const grid: GridCell[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
  for (let column = 0; column < 8; column++) {
    if (column !== 0) grid[0][column] = { kind: "normal", colorId: "cyan" };
    if (column !== 1) grid[2][column] = { kind: "normal", colorId: "purple" };
  }
  return {
    ...createInitialGameState("praise-integration", NOW),
    grid,
    hand: [
      { handId: "h-first", shapeId: "line2v", colorId: "amber" },
      { handId: "h-second", shapeId: "line2v", colorId: "cyan" },
    ],
  };
}

describe("game praise integration", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("presents one committed phrase and never blocks the next placement", async () => {
    const initialState = rapidClearState();
    const result = await render(
      <GameScreenContent
        boardSize={328}
        controllerOptions={{
          seed: "praise-integration",
          now: () => NOW,
          nextSeed: () => "praise-restart",
          initialState,
        }}
      />,
    );

    await fireEvent.press(result.getByTestId("tray-piece-h-first"));
    await fireEvent.press(result.getByTestId("cell-0-0"));
    expect(result.getAllByTestId("praise-overlay")).toHaveLength(1);
    expect(result.getByText("CLEAR")).toBeTruthy();
    expect(
      result.getByTestId("board-danger-safe", { includeHiddenElements: true }).props.pointerEvents,
    ).toBe("none");
    const firstScoreHint = result.getByTestId("score-value").props.accessibilityHint;
    expect(firstScoreHint).toMatch(/^Increased by /);

    await fireEvent.press(result.getByTestId("tray-piece-h-second"));
    await fireEvent.press(result.getByTestId("cell-2-1"));
    expect(result.queryByTestId("tray-piece-h-second")).toBeNull();
    expect(result.getAllByTestId("praise-overlay")).toHaveLength(1);
    expect(result.getByText("NICE")).toBeTruthy();
    expect(
      result.getByTestId("board-danger-safe", { includeHiddenElements: true }).props.pointerEvents,
    ).toBe("none");
    expect(result.getByTestId("score-value").props.accessibilityHint).toMatch(/^Increased by /);
    expect(result.getByTestId("score-value").props.accessibilityHint).not.toBe(firstScoreHint);
  });

  it("clears praise when restart replaces the session", async () => {
    const initialState = rapidClearState();
    const result = await render(
      <GameScreenContent
        boardSize={328}
        controllerOptions={{
          seed: "praise-integration",
          now: () => NOW,
          nextSeed: () => "praise-restart",
          initialState,
        }}
      />,
    );
    await fireEvent.press(result.getByTestId("tray-piece-h-first"));
    await fireEvent.press(result.getByTestId("cell-0-0"));
    expect(result.getByTestId("praise-overlay")).toBeTruthy();

    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-restart-button"));
    await fireEvent.press(result.getByTestId("restart-confirm-button"));

    expect(result.queryByTestId("praise-overlay")).toBeNull();
  });
});
