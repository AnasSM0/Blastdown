import { fireEvent, render } from "@testing-library/react-native";

import { GameOverOverlay } from "../../src/components/modals/GameOverOverlay";

function baseProps() {
  return {
    score: 4321,
    onEndRun: jest.fn(),
  };
}

describe("GameOverOverlay", () => {
  it("shows the final score and only the canonical end-run action", async () => {
    const result = await render(<GameOverOverlay {...baseProps()} />);
    expect(result.getByText(/run over/i)).toBeTruthy();
    expect(result.getByText("4,321")).toBeTruthy();
    expect(result.queryByTestId("revive-button")).toBeNull();
    expect(result.getByTestId("end-run-button")).toBeTruthy();
  });

  it("never exposes rewarded Revive", async () => {
    const result = await render(<GameOverOverlay {...baseProps()} />);
    expect(result.queryByTestId("revive-button")).toBeNull();
    expect(result.getByTestId("end-run-button")).toBeTruthy();
  });

  it("fires End Run without offering Revive", async () => {
    const props = baseProps();
    const result = await render(<GameOverOverlay {...props} />);
    await fireEvent.press(result.getByTestId("end-run-button"));
    expect(props.onEndRun).toHaveBeenCalledTimes(1);
  });

  it("does not expose a reward-pending state", async () => {
    const props = baseProps();
    const result = await render(<GameOverOverlay {...props} />);
    expect(result.queryByTestId("revive-button")).toBeNull();
    expect(result.queryByTestId("revive-outcome")).toBeNull();
  });

  it("is announced to screen readers", async () => {
    const result = await render(<GameOverOverlay {...baseProps()} />);
    expect(result.getByLabelText(/run over/i)).toBeTruthy();
  });
});
