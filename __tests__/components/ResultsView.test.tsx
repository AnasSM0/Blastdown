import { fireEvent, render } from "@testing-library/react-native";

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
  it("renders the run's V1 statistics and best score without legacy rewards", async () => {
    const result = await render(
      <ResultsView stats={stats} bestScore={20000} onPlayAgain={jest.fn()} onHome={jest.fn()} />,
    );
    expect(result.getByTestId("results-score").props.children).toBe("14,200");
    expect(result.getByTestId("results-best").props.children).toEqual(["BEST: ", "20,000"]);
    expect(result.queryByText(/bolts/i)).toBeNull();
    expect(result.queryByTestId("double-bolts-button")).toBeNull();
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
      <ResultsView stats={stats} bestScore={0} onPlayAgain={onPlayAgain} onHome={onHome} />,
    );
    await fireEvent.press(result.getByTestId("play-again-button"));
    await fireEvent.press(result.getByTestId("results-home-button"));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
