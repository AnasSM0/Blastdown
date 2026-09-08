import { act, fireEvent, render } from "@testing-library/react-native";

import { ScoreHeader } from "../../src/components/ScoreHeader";
import { scoreMotionForImpact } from "../../src/components/ScoreHeader/ScoreHeader";
import type { ScoreImpact } from "../../src/ui/scoreImpact";

function impact(id: string, turn: number, level: 1 | 2 | 3, delta: number): ScoreImpact {
  return { id, turn, level, delta, reason: level === 1 ? "singleClear" : "multiClear" };
}

describe("ScoreHeader", () => {
  it("renders the best score label and both score values", async () => {
    const result = await render(
      <ScoreHeader score={1234} best={9876} combo={0} onPause={jest.fn()} />,
    );
    expect(result.getByText("BEST")).toBeTruthy();
    expect(result.getByText("9,876")).toBeTruthy();
    expect(result.getByText("1,234")).toBeTruthy();
  });

  it("renders a non-zero best from its prop with an accessible label", async () => {
    const result = await render(
      <ScoreHeader score={0} best={42_130} combo={0} onPause={jest.fn()} />,
    );
    const best = result.getByTestId("best-value");
    expect(best).toHaveTextContent("42,130");
    expect(best.props.accessibilityLabel).toBe("Best score 42,130");
  });

  it("keeps the score and best accessibility labels intact", async () => {
    const result = await render(
      <ScoreHeader score={555} best={9876} combo={0} onPause={jest.fn()} />,
    );
    expect(result.getByLabelText("Score 555")).toBeTruthy();
    expect(result.getByLabelText("Best score 9,876")).toBeTruthy();
    expect(result.getByLabelText("Pause")).toBeTruthy();
  });

  it("guards against overlap at large text scale (shrink-to-fit + capped scaling)", async () => {
    const result = await render(
      <ScoreHeader score={1234} best={9876} combo={0} onPause={jest.fn()} />,
    );
    const score = result.getByTestId("score-value");
    // The current score shrinks to fit its column and caps runaway OS scaling
    // rather than overflowing into the side columns.
    expect(score.props.numberOfLines).toBe(1);
    expect(score.props.adjustsFontSizeToFit).toBe(true);
    expect(score.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.5);
    // The best value stays on one line so it can't wrap into the score.
    expect(result.getByTestId("best-value").props.numberOfLines).toBe(1);
  });

  it("hides the combo indicator at combo 0", async () => {
    const result = await render(<ScoreHeader score={0} best={0} combo={0} onPause={jest.fn()} />);
    expect(result.queryByTestId("combo-indicator")).toBeNull();
  });

  it("shows the combo indicator when the combo is active", async () => {
    const result = await render(<ScoreHeader score={0} best={0} combo={2} onPause={jest.fn()} />);
    expect(result.getByTestId("combo-indicator")).toBeTruthy();
    expect(result.getByText("x2")).toBeTruthy();
  });

  it("fires onPause when the pause button is pressed", async () => {
    const onPause = jest.fn();
    const result = await render(<ScoreHeader score={0} best={0} combo={0} onPause={onPause} />);
    await fireEvent.press(result.getByTestId("pause-button"));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("scales the score impulse with the committed impact level", () => {
    expect(scoreMotionForImpact(2).scaleTo).toBeGreaterThan(scoreMotionForImpact(1).scaleTo);
    expect(scoreMotionForImpact(3).scaleTo).toBeGreaterThan(scoreMotionForImpact(2).scaleTo);
    expect(Math.abs(scoreMotionForImpact(3).lift)).toBeGreaterThan(
      Math.abs(scoreMotionForImpact(1).lift),
    );
  });

  it("keeps the newest score event authoritative after rapid animation completion", async () => {
    jest.useFakeTimers();
    const result = await render(
      <ScoreHeader score={0} best={0} combo={0} onPause={jest.fn()} reducedMotion={false} />,
    );
    await result.rerender(
      <ScoreHeader
        score={120}
        best={120}
        combo={1}
        impact={impact("first", 1, 1, 120)}
        onPause={jest.fn()}
        reducedMotion={false}
      />,
    );
    await result.rerender(
      <ScoreHeader
        score={440}
        best={440}
        combo={2}
        impact={impact("second", 2, 2, 320)}
        onPause={jest.fn()}
        reducedMotion={false}
      />,
    );

    expect(result.getByTestId("score-value").props.accessibilityHint).toBe("Increased by 320");
    await act(() => jest.advanceTimersByTime(5_000));
    expect(result.getByTestId("score-value").props.accessibilityHint).toBe("Increased by 320");
    jest.useRealTimers();
  });
});
