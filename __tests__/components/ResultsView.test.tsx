import { act, fireEvent, render } from "@testing-library/react-native";

import { ResultsView, type RunStats } from "../../src/components/ResultsScreen";

const stats: RunStats = {
  score: 14200,
  bestCombo: 12,
  linesCleared: 48,
  piecesPlaced: 210,
  piecesDefused: 156,
  explosions: 22,
  rubbleCleared: 89,
};

describe("ResultsView", () => {
  it("renders the run's real statistics", async () => {
    const result = await render(
      <ResultsView stats={stats} onPlayAgain={jest.fn()} onHome={jest.fn()} />,
    );
    expect(result.getByTestId("results-score").props.children).toBe("14,200");
    expect(result.getByText("x12")).toBeTruthy();
    expect(result.getByText("48")).toBeTruthy();
    expect(result.getByText("156")).toBeTruthy();
    expect(result.getByText("22")).toBeTruthy();
    expect(result.getByText("89")).toBeTruthy();
  });

  it("fires Play Again and Home", async () => {
    const onPlayAgain = jest.fn();
    const onHome = jest.fn();
    const result = await render(
      <ResultsView stats={stats} onPlayAgain={onPlayAgain} onHome={onHome} />,
    );
    await act(async () => {
      fireEvent.press(result.getByTestId("play-again-button"));
      fireEvent.press(result.getByTestId("results-home-button"));
    });
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
