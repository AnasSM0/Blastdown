import { render } from "@testing-library/react-native";

import { RewardedActionBar } from "../../src/components/RewardedActionButton";
import { TimerBadge } from "../../src/components/TimerBadge";

function flatStyle(node: { props: Record<string, unknown> }): Record<string, unknown> {
  const style = node.props.style;
  const flat = Array.isArray(style) ? style.flat(Infinity) : [style];
  return Object.assign({}, ...flat.filter(Boolean));
}

describe("accessibility", () => {
  it("labels the rewarded actions and gives them >=44x44 targets", async () => {
    const result = await render(
      <RewardedActionBar
        freeze={{
          label: "FREEZE",
          glyph: "❄",
          testID: "freeze-button",
          onPress: jest.fn(),
          disabled: false,
          active: false,
          placementsRemaining: 0,
        }}
        defuse={{
          label: "DEFUSE",
          glyph: "⚡",
          testID: "defuse-button",
          onPress: jest.fn(),
          disabled: false,
          selected: false,
        }}
      />,
    );

    const freeze = result.getByTestId("freeze-button");
    const defuse = result.getByTestId("defuse-button");
    expect(freeze.props.accessibilityRole).toBe("button");
    expect(freeze.props.accessibilityLabel).toMatch(/freeze/i);
    expect(defuse.props.accessibilityLabel).toMatch(/defuse/i);

    // The dock cells are equal-width (flex) with minimum target dimensions, so
    // assert the reserved minimums clear the 44px accessibility floor.
    for (const button of [freeze, defuse]) {
      const style = flatStyle(button);
      expect(Number(style.minWidth)).toBeGreaterThanOrEqual(44);
      expect(Number(style.minHeight)).toBeGreaterThanOrEqual(44);
    }
  });

  it("keeps the timer numeral and state available to screen readers (never color alone)", async () => {
    const urgent = await render(<TimerBadge pieceId="p" remainingTurns={1} colorId="cyan" />);
    // The digit is present as text and the state is exposed as a hint.
    expect(urgent.getByText("1")).toBeTruthy();
    expect(urgent.getByTestId("timer-badge-p").props.accessibilityHint).toMatch(/urgent/i);
    expect(urgent.getByTestId("timer-badge-p").props.accessibilityLabel).toMatch(/1 moves? left/i);
  });
});
