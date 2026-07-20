import { render } from "@testing-library/react-native";

import { TimerBadge } from "../../src/components/TimerBadge";
import { getTimerVisualState } from "../../src/ui/timerStates";

const mockReducedMotion = { value: false };
jest.mock("../../src/hooks/useReducedMotion", () => ({
  useReducedMotion: () => mockReducedMotion.value,
}));

describe("getTimerVisualState", () => {
  it("maps remaining turns to the spec display states", () => {
    expect(getTimerVisualState(7)).toBe("normal");
    expect(getTimerVisualState(5)).toBe("normal");
    expect(getTimerVisualState(4)).toBe("caution");
    expect(getTimerVisualState(3)).toBe("caution");
    expect(getTimerVisualState(2)).toBe("warning");
    expect(getTimerVisualState(1)).toBe("urgent");
  });
});

describe("TimerBadge", () => {
  it("always shows the numeric countdown", async () => {
    const result = await render(<TimerBadge remainingTurns={5} colorId="cyan" pieceId="p1" />);
    expect(result.getByText("5")).toBeTruthy();
  });

  it("labels itself for screen readers with the remaining moves", async () => {
    const result = await render(<TimerBadge remainingTurns={2} colorId="amber" pieceId="p1" />);
    expect(result.getByLabelText(/2 moves left/i)).toBeTruthy();
  });

  it("exposes its visual state for styling assertions", async () => {
    const urgent = await render(<TimerBadge remainingTurns={1} colorId="purple" pieceId="p1" />);
    expect(urgent.getByTestId("timer-badge-p1").props.accessibilityHint).toMatch(/urgent/i);
  });

  it("keeps the numeral legible under reduced motion (never pulse-only)", async () => {
    mockReducedMotion.value = true;
    const result = await render(<TimerBadge remainingTurns={1} colorId="purple" pieceId="p1" />);
    expect(result.getByText("1")).toBeTruthy();
    expect(result.getByTestId("timer-badge-p1").props.accessibilityHint).toMatch(/urgent/i);
    mockReducedMotion.value = false;
  });
});
