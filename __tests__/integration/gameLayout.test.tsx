import { render, userEvent } from "@testing-library/react-native";

import { GameScreenContent, computeBoardSide } from "../../app/game";

const NOW = 1_752_800_000_000;
const options = { seed: "layout-seed", now: () => NOW };

describe("computeBoardSide (responsive board geometry)", () => {
  it("returns the largest square fitting width and the height budget, capped", () => {
    // Width-bound (tall screen): board = full width.
    expect(computeBoardSide({ width: 320, height: 900 })).toBe(320);
    // Height-bound (short screen): board = height * 0.62.
    expect(computeBoardSide({ width: 800, height: 500 })).toBeCloseTo(310, 5);
    // Capped at the max on very large screens.
    expect(computeBoardSide({ width: 1200, height: 2000 })).toBe(420);
  });

  it("returns 0 until the content box is measured (nothing renders that frame)", () => {
    expect(computeBoardSide({ width: 0, height: 0 })).toBe(0);
    expect(computeBoardSide({ width: 300, height: 0 })).toBe(0);
  });
});

describe("gameplay composition (P1-1)", () => {
  it.each([320, 360, 390, 420])(
    "renders exactly a 64-cell board plus HUD, tray, and action dock at width %ipx",
    async (boardSize) => {
      const result = await render(
        <GameScreenContent controllerOptions={options} boardSize={boardSize} />,
      );

      // Board is exactly 8×8 = 64 cells, at every supported width.
      expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);

      // All four vertical zones are present and reachable.
      expect(result.getByTestId("score-header")).toBeTruthy();
      expect(result.getByTestId("game-board")).toBeTruthy();
      expect(result.getByTestId("piece-tray")).toBeTruthy();
      expect(result.getByTestId("rewarded-action-bar")).toBeTruthy();

      // Pause and reward controls remain reachable.
      expect(result.getByTestId("pause-button")).toBeTruthy();
      expect(result.getByTestId("freeze-button")).toBeTruthy();
      expect(result.getByTestId("defuse-button")).toBeTruthy();
    },
  );

  it("keeps tap placement working after the layout restructure", async () => {
    const user = userEvent.setup();
    const result = await render(<GameScreenContent controllerOptions={options} boardSize={320} />);

    const trayPieces = result.getAllByTestId(/^tray-piece-/);
    const firstHandId = trayPieces[0].props.testID.replace("tray-piece-", "");
    await user.press(trayPieces[0]);
    await user.press(result.getByTestId("cell-0-0"));

    // The piece was placed: it left the tray and the board still has 64 cells.
    expect(result.queryByTestId(`tray-piece-${firstHandId}`)).toBeNull();
    expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);
  });
});
