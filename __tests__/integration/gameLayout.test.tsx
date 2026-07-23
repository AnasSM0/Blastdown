import { render, userEvent } from "@testing-library/react-native";

import { GameScreenContent, computeBoardSide } from "../../app/game";

const NOW = 1_752_800_000_000;
const options = { seed: "layout-seed", now: () => NOW };

describe("computeBoardSide (responsive board geometry)", () => {
  it("returns the largest square fitting width and the height left after the tray/dock reserve, capped", () => {
    // Width-bound (tall screen): board = full inner width.
    expect(computeBoardSide({ width: 320, height: 900 })).toBe(320);
    // Height-bound (short screen): board = height minus the fixed tray+dock
    // reserve (200), so those controls always fit beneath it.
    expect(computeBoardSide({ width: 800, height: 500 })).toBe(300);
    // Capped at the max on very large screens.
    expect(computeBoardSide({ width: 1200, height: 2000 })).toBe(420);
  });

  it("reserves fixed room for the tray and dock on short screens (P1-10)", () => {
    // The board never claims height the tray/dock need: at 460px inner height the
    // board is 260 (460 - 200), leaving the reserve free.
    expect(computeBoardSide({ width: 800, height: 460 })).toBe(260);
    // Extremely short: nothing left for the board after the reserve → 0.
    expect(computeBoardSide({ width: 800, height: 180 })).toBe(0);
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

  it("threads the persisted best score into the HUD and renders the reactor background (P1-2)", async () => {
    const result = await render(
      <GameScreenContent controllerOptions={options} boardSize={320} best={42_130} />,
    );
    expect(result.getByTestId("best-value")).toHaveTextContent("42,130");
    expect(result.getByTestId("reactor-background")).toBeTruthy();
    // Board is still exactly 64 cells — the background is purely decorative.
    expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);
  });

  it("defaults the HUD best to 0 when no profile value is supplied", async () => {
    const result = await render(<GameScreenContent controllerOptions={options} boardSize={320} />);
    expect(result.getByTestId("best-value")).toHaveTextContent("0");
  });

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
