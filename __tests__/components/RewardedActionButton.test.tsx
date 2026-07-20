import { act, fireEvent, render } from "@testing-library/react-native";

import { RewardedActionBar } from "../../src/components/RewardedActionButton";

describe("RewardedActionBar", () => {
  it("renders freeze and defuse controls and fires their presses", async () => {
    const onFreeze = jest.fn();
    const onDefuse = jest.fn();
    const result = await render(
      <RewardedActionBar
        freeze={{ onPress: onFreeze, disabled: false, active: false, placementsRemaining: 0 }}
        defuse={{ onPress: onDefuse, disabled: false, selected: false }}
      />,
    );
    await act(async () => {
      fireEvent.press(result.getByTestId("freeze-button"));
      fireEvent.press(result.getByTestId("defuse-button"));
    });
    expect(onFreeze).toHaveBeenCalledTimes(1);
    expect(onDefuse).toHaveBeenCalledTimes(1);
  });

  it("shows the remaining-placements label while freeze is active", async () => {
    const result = await render(
      <RewardedActionBar
        freeze={{ onPress: jest.fn(), disabled: true, active: true, placementsRemaining: 2 }}
        defuse={{ onPress: jest.fn(), disabled: false, selected: false }}
      />,
    );
    expect(result.getByTestId("freeze-moves-label").props.children).toEqual([2, " ", "MOVES"]);
  });

  it("singularizes the label at one remaining placement", async () => {
    const result = await render(
      <RewardedActionBar
        freeze={{ onPress: jest.fn(), disabled: true, active: true, placementsRemaining: 1 }}
        defuse={{ onPress: jest.fn(), disabled: false, selected: false }}
      />,
    );
    expect(result.getByTestId("freeze-moves-label").props.children).toEqual([1, " ", "MOVE"]);
  });

  it("marks controls disabled for screen readers and ignores presses", async () => {
    const onFreeze = jest.fn();
    const result = await render(
      <RewardedActionBar
        freeze={{ onPress: onFreeze, disabled: true, active: false, placementsRemaining: 0 }}
        defuse={{ onPress: jest.fn(), disabled: true, selected: false }}
      />,
    );
    expect(result.getByLabelText(/freeze timers/i).props.accessibilityState?.disabled).toBe(true);
    expect(result.getByLabelText(/defuse.*piece/i).props.accessibilityState?.disabled).toBe(true);
    await act(async () => {
      fireEvent.press(result.getByTestId("freeze-button"));
    });
    expect(onFreeze).not.toHaveBeenCalled();
  });
});
