import { fireEvent, render } from "@testing-library/react-native";

import { PauseOverlay } from "../../src/components/modals/PauseOverlay";

function props() {
  return { onResume: jest.fn(), onRestart: jest.fn(), onHome: jest.fn() };
}

describe("PauseOverlay", () => {
  it("fires resume, restart, and home", async () => {
    const p = props();
    const result = await render(<PauseOverlay {...p} />);
    await fireEvent.press(result.getByTestId("resume-button"));
    await fireEvent.press(result.getByTestId("pause-restart-button"));
    await fireEvent.press(result.getByTestId("pause-home-button"));
    expect(p.onResume).toHaveBeenCalledTimes(1);
    expect(p.onRestart).toHaveBeenCalledTimes(1);
    expect(p.onHome).toHaveBeenCalledTimes(1);
  });

  it("renders the sound/music/haptics rows as disabled placeholders", async () => {
    const result = await render(<PauseOverlay {...props()} />);
    expect(result.getByTestId("toggle-sound").props.disabled).toBe(true);
    expect(result.getByTestId("toggle-music").props.disabled).toBe(true);
    expect(result.getByTestId("toggle-haptics").props.disabled).toBe(true);
  });

  it("reflects the OS reduced-motion setting read-only", async () => {
    const result = await render(<PauseOverlay {...props()} reducedMotion />);
    const toggle = result.getByTestId("toggle-reduced-motion");
    expect(toggle.props.value).toBe(true);
    expect(toggle.props.disabled).toBe(true);
  });

  it("is announced as Paused", async () => {
    const result = await render(<PauseOverlay {...props()} />);
    expect(result.getByLabelText(/paused/i)).toBeTruthy();
  });
});
