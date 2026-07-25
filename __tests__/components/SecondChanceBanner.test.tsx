import { render } from "@testing-library/react-native";

import { SecondChanceBanner } from "../../src/components/modals/SecondChanceBanner";

describe("SecondChanceBanner", () => {
  it("renders the second-chance label and is announced", async () => {
    const result = await render(<SecondChanceBanner />);
    expect(result.getByTestId("second-chance-banner")).toBeTruthy();
    expect(result.getByText("SECOND CHANCE")).toBeTruthy();
    expect(result.getByLabelText(/second chance/i)).toBeTruthy();
  });

  it("appears at full opacity immediately under reduced motion (no fade)", async () => {
    const result = await render(<SecondChanceBanner reducedMotion />);
    // Only the small text pill fades — the full-screen box is a static,
    // transparent layout container, so animating it would promote the whole
    // screen to a compositing layer for a one-line banner.
    const label = result.getByText("SECOND CHANCE");
    const style = Array.isArray(label.props.style) ? label.props.style : [label.props.style];
    const opacity = style
      .flat(Infinity)
      .map((s) => s?.opacity)
      .find((v) => v !== undefined);
    expect(opacity?.__getValue?.() ?? opacity).toBe(1);

    const banner = result.getByTestId("second-chance-banner");
    const bannerStyle = Array.isArray(banner.props.style)
      ? banner.props.style
      : [banner.props.style];
    expect(
      bannerStyle
        .flat(Infinity)
        .map((s) => s?.opacity)
        .find((v) => v !== undefined),
    ).toBeUndefined();
  });
});
