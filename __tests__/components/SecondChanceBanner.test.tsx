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
    const banner = result.getByTestId("second-chance-banner");
    // Animated opacity resolves to 1 with no timing when reduced motion is on.
    const style = Array.isArray(banner.props.style) ? banner.props.style : [banner.props.style];
    const opacity = style.map((s) => s?.opacity).find((v) => v !== undefined);
    expect(opacity?.__getValue?.() ?? opacity).toBe(1);
  });
});
