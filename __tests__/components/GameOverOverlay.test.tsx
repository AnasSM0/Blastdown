import { fireEvent, render } from "@testing-library/react-native";

import { GameOverOverlay } from "../../src/components/modals/GameOverOverlay";

describe("GameOverOverlay", () => {
  it("shows the final score and a restart action", async () => {
    const result = await render(<GameOverOverlay score={4321} onRestart={jest.fn()} />);
    expect(result.getByText(/game over/i)).toBeTruthy();
    expect(result.getByText("4,321")).toBeTruthy();
    expect(result.getByTestId("restart-button")).toBeTruthy();
  });

  it("fires onRestart when pressed", async () => {
    const onRestart = jest.fn();
    const result = await render(<GameOverOverlay score={0} onRestart={onRestart} />);
    fireEvent.press(result.getByTestId("restart-button"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("is announced to screen readers as an alert", async () => {
    const result = await render(<GameOverOverlay score={10} onRestart={jest.fn()} />);
    expect(result.getByLabelText(/game over/i)).toBeTruthy();
  });
});
