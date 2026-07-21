import { render } from "@testing-library/react-native";

import { ReactorBackground } from "../../src/components/ReactorBackground";

describe("ReactorBackground", () => {
  it("renders the programmatic reactor surface", async () => {
    const result = await render(<ReactorBackground />);
    expect(result.getByTestId("reactor-background")).toBeTruthy();
  });

  it("never intercepts touches (sits purely behind gameplay)", async () => {
    const result = await render(<ReactorBackground />);
    expect(result.getByTestId("reactor-background").props.pointerEvents).toBe("none");
  });

  it("paints the theme's deep background base by default (Reactor navy)", async () => {
    const result = await render(<ReactorBackground />);
    const style = result.getByTestId("reactor-background").props.style;
    const flattened = Array.isArray(style) ? Object.assign({}, ...style) : style;
    // Default theme is Reactor; its Premium-aligned navy base.
    expect(flattened.backgroundColor).toBe("#070C16");
  });
});
