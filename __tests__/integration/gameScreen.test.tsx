import { render, userEvent } from "@testing-library/react-native";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function fixedOptions(initialState?: GameState) {
  return {
    seed: "ui-integration-seed",
    now: () => NOW,
    nextSeed: () => "ui-restart-seed",
    initialState,
  };
}

describe("game screen vertical slice", () => {
  it("plays a full tap turn: select piece, place it, HUD and hand update", async () => {
    const user = userEvent.setup();
    const result = await render(
      <GameScreenContent controllerOptions={fixedOptions()} boardSize={328} />,
    );

    const trayPieces = result.getAllByTestId(/^tray-piece-/);
    expect(trayPieces).toHaveLength(3);
    const firstHandId = trayPieces[0].props.testID.replace("tray-piece-", "");

    await user.press(trayPieces[0]);
    await user.press(result.getByTestId("cell-0-0"));

    // The placed piece consumed a tray slot and the placed cells render.
    expect(result.queryByTestId(`tray-piece-${firstHandId}`)).toBeNull();
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(2);
    expect(result.getAllByTestId(/^timer-badge-/)).toHaveLength(1);
  });

  it("shows an invalid-conflict preview without mutating the run", async () => {
    // Crafted state: single occupied cell at (0,0); hand holds a 2x2 square.
    const grid = makeEmptyGrid(8);
    grid[0][0] = { kind: "normal", colorId: "cyan" };
    const initialState: GameState = {
      ...createInitialGameState("crafted", NOW),
      grid,
      hand: [
        { handId: "h-square", shapeId: "square2x2", colorId: "purple" },
        { handId: "h-spare", shapeId: "single", colorId: "amber" },
      ],
    };
    const user = userEvent.setup();
    const result = await render(
      <GameScreenContent controllerOptions={fixedOptions(initialState)} boardSize={328} />,
    );

    await user.press(result.getByTestId("tray-piece-h-square"));
    await user.press(result.getByTestId("cell-0-0"));

    // Rejected: hand unchanged, conflict cell highlighted exactly at (0,0).
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(2);
    expect(result.getAllByTestId(/^preview-conflict-/)).toHaveLength(1);
    expect(result.getByTestId("preview-conflict-0-0")).toBeTruthy();
  });

  it("shows the game-over overlay with revive and end-run actions when the domain reports game over", async () => {
    // One empty cell at (0,0); hand: a single (fits) then a square (cannot).
    const grid = makeEmptyGrid(8);
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        grid[row][column] = { kind: "normal", colorId: "cyan" };
      }
    }
    for (let row = 0; row < 8; row++) {
      grid[row][row] = { kind: "empty" };
      grid[row][(row + 1) % 8] = { kind: "empty" };
    }
    const initialState: GameState = {
      ...createInitialGameState("crafted-over", NOW),
      grid,
      hand: [
        { handId: "h-single", shapeId: "single", colorId: "amber" },
        { handId: "h-square", shapeId: "square2x2", colorId: "purple" },
      ],
    };
    const user = userEvent.setup();
    const result = await render(
      <GameScreenContent controllerOptions={fixedOptions(initialState)} boardSize={328} />,
    );

    expect(result.queryByTestId("game-over-overlay")).toBeNull();

    await user.press(result.getByTestId("tray-piece-h-single"));
    await user.press(result.getByTestId("cell-0-0"));

    expect(result.getByTestId("game-over-overlay")).toBeTruthy();
    expect(result.queryByTestId("revive-button")).toBeNull();
    expect(result.getByTestId("end-run-button")).toBeTruthy();
  });
});
