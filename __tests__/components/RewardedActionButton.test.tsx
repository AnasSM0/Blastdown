import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import {
  RewardedActionBar,
  type RewardedActionBarProps,
} from "../../src/components/RewardedActionButton";

function freezeAction(
  overrides: Partial<RewardedActionBarProps["freeze"]> = {},
): RewardedActionBarProps["freeze"] {
  return {
    label: "FREEZE",
    glyph: "❄",
    onPress: jest.fn(),
    disabled: false,
    active: false,
    placementsRemaining: 0,
    testID: "freeze-button",
    ...overrides,
  };
}

function defuseAction(
  overrides: Partial<RewardedActionBarProps["defuse"]> = {},
): RewardedActionBarProps["defuse"] {
  return {
    label: "DEFUSE",
    glyph: "⚡",
    onPress: jest.fn(),
    disabled: false,
    selected: false,
    testID: "defuse-button",
    ...overrides,
  };
}

describe("RewardedActionBar", () => {
  it("renders one dock with both equal-width, accessible action cells", async () => {
    const result = await render(
      <RewardedActionBar freeze={freezeAction()} defuse={defuseAction()} />,
    );

    expect(result.getByTestId("rewarded-action-bar")).toBeTruthy();
    expect(result.getByTestId("power-dock-spine")).toBeTruthy();
    expect(result.getByText("FREEZE")).toBeTruthy();
    expect(result.getByText("DEFUSE")).toBeTruthy();
    expect(result.getByTestId("freeze-button").props.accessibilityRole).toBe("button");
    expect(result.getByTestId("defuse-button").props.accessibilityRole).toBe("button");
    expect(result.getByLabelText(/freeze/i)).toBeTruthy();
    expect(result.getByLabelText(/defuse.*piece/i)).toBeTruthy();

    const freezeStyle = StyleSheet.flatten(result.getByTestId("freeze-button").props.style);
    const defuseStyle = StyleSheet.flatten(result.getByTestId("defuse-button").props.style);
    expect(freezeStyle.flex).toBe(1);
    expect(defuseStyle.flex).toBe(1);
    expect(freezeStyle.minWidth).toBeGreaterThanOrEqual(48);
    expect(freezeStyle.minHeight).toBeGreaterThanOrEqual(48);
  });

  it("labels rule-unavailable actions as locked without relying on color", async () => {
    const result = await render(
      <RewardedActionBar
        freeze={freezeAction({ disabled: true, unavailable: true })}
        defuse={defuseAction()}
      />,
    );
    expect(result.getByTestId("freeze-button-caption")).toHaveTextContent("LOCKED");
    expect(result.getByTestId("freeze-button").props.accessibilityState.disabled).toBe(true);
  });

  it("fires both callbacks while the actions are available", async () => {
    const onFreeze = jest.fn();
    const onDefuse = jest.fn();
    const result = await render(
      <RewardedActionBar
        freeze={freezeAction({ onPress: onFreeze })}
        defuse={defuseAction({ onPress: onDefuse })}
      />,
    );

    await act(async () => {
      await fireEvent.press(result.getByTestId("freeze-button"));
      await fireEvent.press(result.getByTestId("defuse-button"));
    });

    expect(onFreeze).toHaveBeenCalledTimes(1);
    expect(onDefuse).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["disabled", { disabled: true }],
    ["unavailable", { disabled: true, unavailable: true }],
    ["pending", { phase: "pending" as const }],
  ])("does not fire when %s", async (_name, overrides) => {
    const onFreeze = jest.fn();
    const result = await render(
      <RewardedActionBar
        freeze={freezeAction({ onPress: onFreeze, ...overrides })}
        defuse={defuseAction()}
      />,
    );

    await fireEvent.press(result.getByTestId("freeze-button"));

    expect(onFreeze).not.toHaveBeenCalled();
  });

  it("shows the exact plural moves children only while freeze is active", async () => {
    const active = await render(
      <RewardedActionBar
        freeze={freezeAction({ active: true, placementsRemaining: 2 })}
        defuse={defuseAction()}
      />,
    );
    expect(active.getByTestId("freeze-moves-label").props.children).toEqual([2, " ", "MOVES"]);
    expect(active.getByLabelText("Freeze active, 2 placements left")).toBeTruthy();

    const idle = await render(
      <RewardedActionBar freeze={freezeAction()} defuse={defuseAction()} />,
    );
    expect(idle.queryByTestId("freeze-moves-label")).toBeNull();
  });

  it("singularizes the active freeze caption with exact children", async () => {
    const result = await render(
      <RewardedActionBar
        freeze={freezeAction({ active: true, placementsRemaining: 1 })}
        defuse={defuseAction()}
      />,
    );

    expect(result.getByTestId("freeze-moves-label").props.children).toEqual([1, " ", "MOVE"]);
  });

  it("renders distinct non-color cues for all eight required states", async () => {
    const available = await render(
      <RewardedActionBar freeze={freezeAction({ rewarded: true })} defuse={defuseAction()} />,
    );
    expect(available.getByTestId("freeze-button-reward")).toBeTruthy();
    expect(available.getByTestId("freeze-button-caption").props.children).toBe("");

    const unavailable = await render(
      <RewardedActionBar
        freeze={freezeAction({ disabled: true, unavailable: true })}
        defuse={defuseAction()}
      />,
    );
    expect(unavailable.getByTestId("freeze-button-caption").props.children).toBe("LOCKED");
    expect(
      StyleSheet.flatten(unavailable.getByTestId("freeze-button").props.style).borderStyle,
    ).toBe("dashed");

    const disabled = await render(
      <RewardedActionBar freeze={freezeAction({ disabled: true })} defuse={defuseAction()} />,
    );
    expect(disabled.getByTestId("freeze-button-caption").props.children).toBe("");
    expect(StyleSheet.flatten(disabled.getByTestId("freeze-button").props.style).opacity).toBe(0.4);
    expect(disabled.getByTestId("freeze-button").props.accessibilityState).toEqual({
      disabled: true,
    });

    const pending = await render(
      <RewardedActionBar freeze={freezeAction({ phase: "pending" })} defuse={defuseAction()} />,
    );
    expect(pending.getByTestId("freeze-button-caption").props.children).toBe("…");

    const success = await render(
      <RewardedActionBar freeze={freezeAction({ phase: "success" })} defuse={defuseAction()} />,
    );
    expect(success.getByTestId("freeze-button-caption").props.children).toBe("✓ DONE");

    const failure = await render(
      <RewardedActionBar freeze={freezeAction({ phase: "failure" })} defuse={defuseAction()} />,
    );
    expect(failure.getByTestId("freeze-button-caption").props.children).toBe("AD FAILED");

    const cancelled = await render(
      <RewardedActionBar freeze={freezeAction({ phase: "cancelled" })} defuse={defuseAction()} />,
    );
    expect(cancelled.getByTestId("freeze-button-caption").props.children).toBe("CANCELLED");

    const active = await render(
      <RewardedActionBar
        freeze={freezeAction({ active: true, placementsRemaining: 3 })}
        defuse={defuseAction()}
      />,
    );
    expect(active.getByTestId("freeze-moves-label").props.children).toEqual([3, " ", "MOVES"]);
  });

  it("uses selected as a non-color cue for the defuse highlight", async () => {
    const result = await render(
      <RewardedActionBar freeze={freezeAction()} defuse={defuseAction({ selected: true })} />,
    );

    expect(result.getByTestId("defuse-button-caption").props.children).toBe("SELECTED");
    expect(StyleSheet.flatten(result.getByTestId("defuse-button").props.style).borderWidth).toBe(2);
  });

  it("shows the reward indicator only for available rewarded actions", async () => {
    const active = await render(
      <RewardedActionBar
        freeze={freezeAction({ rewarded: true, active: true, placementsRemaining: 2 })}
        defuse={defuseAction()}
      />,
    );
    expect(active.queryByTestId("freeze-button-reward")).toBeNull();

    const pending = await render(
      <RewardedActionBar
        freeze={freezeAction({ rewarded: true, phase: "pending" })}
        defuse={defuseAction()}
      />,
    );
    expect(pending.queryByTestId("freeze-button-reward")).toBeNull();
  });

  it("keeps accessibility disabled state tied to the supplied disabled prop", async () => {
    const result = await render(
      <RewardedActionBar
        freeze={freezeAction({ disabled: true })}
        defuse={defuseAction({ disabled: true })}
      />,
    );

    expect(result.getByLabelText(/freeze/i).props.accessibilityState).toEqual({ disabled: true });
    expect(result.getByLabelText(/defuse.*piece/i).props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it("never clips a transformed action slot with overflow hidden", async () => {
    const result = await render(
      <RewardedActionBar freeze={freezeAction()} defuse={defuseAction()} />,
    );

    // The dock action carries a scale press transform (Phase 2), so the Android
    // guard is not "no transform" but "no overflow:hidden on a transformed,
    // rounded surface" — the combination that black-renders. The action has no
    // elevation, so a transient scale is safe as long as it is never clipped.
    for (const testID of ["freeze-button", "defuse-button"]) {
      const style = StyleSheet.flatten(result.getByTestId(testID).props.style);
      expect(style.overflow).not.toBe("hidden");
    }
  });
});
