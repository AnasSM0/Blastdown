import { render, userEvent, waitFor } from "@testing-library/react-native";

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

function options(initialState: GameState) {
  return { seed: "effects-seed", now: () => NOW, nextSeed: () => "restart", initialState };
}

describe("gameplay effects pipeline", () => {
  it("plays a line-clear sequence overlay that clears itself, then accepts input again", async () => {
    const user = userEvent.setup();
    const result = await render(
      <GameScreenContent controllerOptions={options(clearingState())} boardSize={328} />,
    );

    expect(result.queryByTestId("effects-layer")).toBeNull();

    await user.press(result.getByTestId("tray-piece-h-single"));
    await user.press(result.getByTestId("cell-0-0"));

    // Row 0 cleared -> a required sequence plays and its overlay is up. The
    // spare piece survived (only the single was consumed), so a run continues.
    expect(await result.findByTestId("effects-layer")).toBeTruthy();
    expect(result.getByTestId("tray-piece-h-spare")).toBeTruthy();

    // The overlay clears itself when the sequence finishes (input unlocks).
    // Input-lock semantics themselves are covered by useEventAnimator's tests.
    await waitFor(() => expect(result.queryByTestId("effects-layer")).toBeNull(), {
      timeout: 2000,
    });

    // With the sequence over, the spare piece can be placed again.
    await user.press(result.getByTestId("tray-piece-h-spare"));
    await user.press(result.getByTestId("cell-5-5"));
    await waitFor(() => expect(result.queryByTestId("tray-piece-h-spare")).toBeNull());
  });
});
