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
  it("renders the run's real statistics, best score, and Bolts earned", async () => {
    const result = await render(
      <ResultsView
        stats={stats}
        bestScore={20000}
        boltsEarned={212}
        onPlayAgain={jest.fn()}
        onHome={jest.fn()}
      />,
    );
    expect(result.getByTestId("results-score").props.children).toBe("14,200");
    expect(result.getByTestId("results-best").props.children).toEqual(["BEST: ", "20,000"]);
    expect(result.getByText("+212")).toBeTruthy();
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
      <ResultsView
        stats={stats}
        bestScore={0}
        boltsEarned={0}
        onPlayAgain={onPlayAgain}
        onHome={onHome}
      />,
    );
    await fireEvent.press(result.getByTestId("play-again-button"));
    await fireEvent.press(result.getByTestId("results-home-button"));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
