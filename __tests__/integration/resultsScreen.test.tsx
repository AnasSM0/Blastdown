import { act, fireEvent, render } from "@testing-library/react-native";

import { createInitialGameState } from "../../src/domain/game";
import type { GameState } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;
const mockReplace = jest.fn();
const mockStartNewRun = jest.fn();

const mockFinishedState: GameState = {
  ...createInitialGameState("results-seed", NOW),
  status: "gameOver",
  score: 14200,
  bestCombo: 12,
  linesCleared: 48,
  piecesDefused: 156,
  explosions: 22,
  rubbleCleared: 89,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

jest.mock("../../src/state/GameSessionProvider", () => ({
  useGameSession: () => ({
    controller: { state: mockFinishedState },
    startNewRun: mockStartNewRun,
  }),
}));

describe("results route", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockStartNewRun.mockClear();
  });

  function renderResults() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ResultsScreen = require("../../app/results").default;
    return render(<ResultsScreen />);
  }

  it("shows the finished run's real stats from the session", async () => {
    const result = await renderResults();
    expect(result.getByTestId("results-score").props.children).toBe("14,200");
    expect(result.getByText("x12")).toBeTruthy();
    expect(result.getByText("156")).toBeTruthy();
  });

  it("Play Again starts a fresh run and navigates to the game", async () => {
    const result = await renderResults();
    await act(async () => {
      fireEvent.press(result.getByTestId("play-again-button"));
    });
    expect(mockStartNewRun).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/game");
  });

  it("Home returns to the menu", async () => {
    const result = await renderResults();
    await act(async () => {
      fireEvent.press(result.getByTestId("results-home-button"));
    });
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
