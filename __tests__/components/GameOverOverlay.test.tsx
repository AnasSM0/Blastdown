import { act, fireEvent, render } from "@testing-library/react-native";

import { GameOverOverlay } from "../../src/components/modals/GameOverOverlay";

function baseProps() {
  return {
    score: 4321,
    reviveAvailable: true,
    onRevive: jest.fn(),
    onEndRun: jest.fn(),
  };
}

describe("GameOverOverlay", () => {
  it("shows the final score and both actions while revive is available", async () => {
    const result = await render(<GameOverOverlay {...baseProps()} />);
    expect(result.getByText(/run over/i)).toBeTruthy();
    expect(result.getByText("4,321")).toBeTruthy();
    expect(result.getByTestId("revive-button")).toBeTruthy();
    expect(result.getByTestId("end-run-button")).toBeTruthy();
  });

  it("hides the revive action once the revive is spent", async () => {
    const result = await render(<GameOverOverlay {...baseProps()} reviveAvailable={false} />);
    expect(result.queryByTestId("revive-button")).toBeNull();
    expect(result.getByTestId("end-run-button")).toBeTruthy();
  });

  it("fires onRevive and onEndRun when pressed", async () => {
    const props = baseProps();
    const result = await render(<GameOverOverlay {...props} />);
    await act(async () => {
      fireEvent.press(result.getByTestId("revive-button"));
    });
    await act(async () => {
      fireEvent.press(result.getByTestId("end-run-button"));
    });
    expect(props.onRevive).toHaveBeenCalledTimes(1);
    expect(props.onEndRun).toHaveBeenCalledTimes(1);
  });

  it("disables actions and ignores presses while busy", async () => {
    const props = baseProps();
    const result = await render(<GameOverOverlay {...props} busy />);
    expect(result.getByTestId("revive-button").props.accessibilityState?.disabled).toBe(true);
    await act(async () => {
      fireEvent.press(result.getByTestId("revive-button"));
      fireEvent.press(result.getByTestId("end-run-button"));
    });
    expect(props.onRevive).not.toHaveBeenCalled();
    expect(props.onEndRun).not.toHaveBeenCalled();
  });

  it("is announced to screen readers", async () => {
    const result = await render(<GameOverOverlay {...baseProps()} />);
    expect(result.getByLabelText(/run over/i)).toBeTruthy();
  });
});
