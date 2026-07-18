import { fireEvent, render } from "@testing-library/react-native";

import { ScoreHeader } from "../../src/components/ScoreHeader";

describe("ScoreHeader", () => {
  it("renders the best score label and both score values", async () => {
    const result = await render(
      <ScoreHeader score={1234} best={9876} combo={0} onPause={jest.fn()} />,
    );
    expect(result.getByText("BEST")).toBeTruthy();
    expect(result.getByText("9,876")).toBeTruthy();
    expect(result.getByText("1,234")).toBeTruthy();
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
    fireEvent.press(result.getByTestId("pause-button"));
    expect(onPause).toHaveBeenCalledTimes(1);
  });
});
