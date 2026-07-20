import { fireEvent, render } from "@testing-library/react-native";

import { ThemeScreenView } from "../../src/components/ThemeScreen";
import { THEMES } from "../../src/ui/themes";

describe("ThemeScreenView", () => {
  it("renders a tile for every theme and marks the selected one", async () => {
    const result = await render(
      <ThemeScreenView
        themes={THEMES}
        selectedThemeId="neon-reactor"
        onSelect={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    for (const theme of THEMES) {
      expect(result.getByTestId(`theme-tile-${theme.id}`)).toBeTruthy();
    }
    expect(result.getByTestId("theme-selected-neon-reactor")).toBeTruthy();
    expect(result.queryByTestId("theme-selected-arctic")).toBeNull();
  });

  it("selects a theme on tap", async () => {
    const onSelect = jest.fn();
    const result = await render(
      <ThemeScreenView
        themes={THEMES}
        selectedThemeId="neon-reactor"
        onSelect={onSelect}
        onBack={jest.fn()}
      />,
    );
    fireEvent.press(result.getByTestId("theme-tile-magma"));
    expect(onSelect).toHaveBeenCalledWith("magma");
  });

  it("shows Bolt prices on locked themes and marks Reactor included", async () => {
    const result = await render(
      <ThemeScreenView
        themes={THEMES}
        selectedThemeId="neon-reactor"
        onSelect={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    expect(result.getByTestId("theme-price-arctic")).toBeTruthy();
    expect(result.queryByTestId("theme-price-neon-reactor")).toBeNull();
  });
});
