import { render } from "@testing-library/react-native";

import { RewardedActionBar } from "../../src/components/RewardedActionButton";

describe("RewardedActionBar", () => {
  it("renders inactive freeze and defuse controls", async () => {
    const result = await render(<RewardedActionBar />);
    expect(result.getByTestId("freeze-button")).toBeTruthy();
    expect(result.getByTestId("defuse-button")).toBeTruthy();
  });

  it("labels both controls for screen readers and marks them disabled", async () => {
    const result = await render(<RewardedActionBar />);
    expect(result.getByLabelText(/freeze timers/i).props.accessibilityState?.disabled).toBe(true);
    expect(result.getByLabelText(/defuse.*piece/i).props.accessibilityState?.disabled).toBe(true);
  });
});
