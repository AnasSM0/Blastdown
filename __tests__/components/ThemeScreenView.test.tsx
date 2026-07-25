import { fireEvent, render } from "@testing-library/react-native";

import { ThemeScreenView } from "../../src/components/ThemeScreen";
import { THEMES } from "../../src/ui/themes";

const baseProps = {
  themes: THEMES,
  selectedThemeId: "neon-reactor",
  unlockedThemeIds: ["neon-reactor"],
  bolts: 600,
  pendingThemeId: null as string | null,
  onSelect: jest.fn(),
  onConfirmPurchase: jest.fn(),
  onCancelPurchase: jest.fn(),
  onBack: jest.fn(),
};

describe("ThemeScreenView", () => {
  it("renders Selected, Owned, Locked, and Insufficient states", async () => {
    const result = await render(
      <ThemeScreenView {...baseProps} unlockedThemeIds={["neon-reactor", "arctic"]} bolts={600} />,
    );
    expect(result.getByTestId("theme-state-neon-reactor")).toHaveTextContent("SELECTED");
    expect(result.getByTestId("theme-state-arctic")).toHaveTextContent("OWNED");
    // Magma (500) affordable at 600 Bolts -> locked price; Void (750) not.
    expect(result.getByTestId("theme-state-magma")).toHaveTextContent(/500/);
    expect(result.getByTestId("theme-state-void")).toHaveTextContent(/NOT ENOUGH/);
  });

  it("shows the current Bolt balance in the header", async () => {
    const result = await render(<ThemeScreenView {...baseProps} bolts={1250} />);
    expect(result.getByTestId("themes-bolts")).toHaveTextContent(/1,250/);
  });

  it("calls onSelect for any tile tap", async () => {
    const onSelect = jest.fn();
    const result = await render(<ThemeScreenView {...baseProps} onSelect={onSelect} />);
    await fireEvent.press(result.getByTestId("theme-tile-magma"));
    expect(onSelect).toHaveBeenCalledWith("magma");
  });

  it("renders the purchase panel with buy enabled when affordable", async () => {
    const onConfirm = jest.fn();
    const result = await render(
      <ThemeScreenView
        {...baseProps}
        bolts={600}
        pendingThemeId="magma"
        onConfirmPurchase={onConfirm}
      />,
    );
    expect(result.getByTestId("theme-purchase-panel")).toBeTruthy();
    expect(result.queryByTestId("theme-purchase-insufficient")).toBeNull();
    await fireEvent.press(result.getByTestId("theme-purchase-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("magma");
  });

  it("disables buy and shows a message when the balance is insufficient", async () => {
    const onConfirm = jest.fn();
    const result = await render(
      <ThemeScreenView
        {...baseProps}
        bolts={100}
        pendingThemeId="void"
        onConfirmPurchase={onConfirm}
      />,
    );
    expect(result.getByTestId("theme-purchase-insufficient")).toBeTruthy();
    const buy = result.getByTestId("theme-purchase-confirm");
    expect(buy.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(buy);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
