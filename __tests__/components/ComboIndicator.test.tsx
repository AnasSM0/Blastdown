import { render } from "@testing-library/react-native";
import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";

import { ComboIndicator } from "../../src/components/ComboIndicator";
import { resolveTheme } from "../../src/ui/themes";

// Outside a ThemeProvider useTheme() resolves to the Reactor default palette.
const reactor = resolveTheme(undefined);

describe("ComboIndicator", () => {
  it("renders nothing when there is no combo", async () => {
    const result = await render(<ComboIndicator combo={0} />);
    expect(result.queryByTestId("combo-indicator")).toBeNull();
  });

  it("shows the multiplier with an accessible label", async () => {
    const result = await render(<ComboIndicator combo={3} />);
    expect(result.getByText("x3")).toBeTruthy();
    expect(result.getByLabelText("Combo x3")).toBeTruthy();
  });

  it("draws the pill and text from the theme score token, not a hardcoded hue (P1-9)", async () => {
    const result = await render(<ComboIndicator combo={2} />);
    const pill = StyleSheet.flatten(result.getByTestId("combo-indicator").props.style as ViewStyle);
    const text = StyleSheet.flatten(result.getByText("x2").props.style as TextStyle);
    // Both the border and the numeral come from theme.score (per-theme), which
    // differs from the old hardcoded amber block color.
    expect(pill.borderColor).toBe(reactor.score);
    expect(text.color).toBe(reactor.score);
  });
});
