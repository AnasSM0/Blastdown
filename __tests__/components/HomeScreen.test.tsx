import type { ComponentProps } from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { HomeScreenView } from "../../src/components/HomeScreen";

function viewProps(overrides: Partial<ComponentProps<typeof HomeScreenView>> = {}) {
  return {
    bestScore: 14200,
    canContinue: false,
    onPlay: jest.fn(),
    onContinue: jest.fn(),
    onSettings: jest.fn(),
    onHowToPlay: jest.fn(),
    onPrivacy: jest.fn(),
    ...overrides,
  };
}

describe("HomeScreenView", () => {
  it("renders the wordmark, Play, and best score without legacy economy UI", async () => {
    const result = await render(<HomeScreenView {...viewProps()} />);
    expect(result.getByText("BlastDown")).toBeTruthy();
    expect(result.getByTestId("play-button")).toBeTruthy();
    expect(result.getByTestId("best-score")).toBeTruthy();
    expect(result.getByText("14,200")).toBeTruthy();
    expect(result.queryByTestId("bolts-balance")).toBeNull();
    expect(result.queryByTestId("themes-button")).toBeNull();
  });

  it("does not render a leaderboard / RANKS button", async () => {
    const result = await render(<HomeScreenView {...viewProps()} />);
    expect(result.queryByText(/rank/i)).toBeNull();
    expect(result.queryByTestId("ranks-button")).toBeNull();
    expect(result.queryByTestId("leaderboard-button")).toBeNull();
  });

  it("hides Continue with no active run and shows it otherwise", async () => {
    const withoutRun = await render(<HomeScreenView {...viewProps({ canContinue: false })} />);
    expect(withoutRun.queryByTestId("continue-button")).toBeNull();

    const onContinue = jest.fn();
    const withRun = await render(
      <HomeScreenView {...viewProps({ canContinue: true, onContinue })} />,
    );
    await fireEvent.press(withRun.getByTestId("continue-button"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("fires each V1 menu action", async () => {
    const props = viewProps();
    const result = await render(<HomeScreenView {...props} />);
    await fireEvent.press(result.getByTestId("play-button"));
    await fireEvent.press(result.getByTestId("settings-button"));
    await fireEvent.press(result.getByTestId("how-to-play-button"));
    expect(props.onPlay).toHaveBeenCalledTimes(1);
    expect(props.onSettings).toHaveBeenCalledTimes(1);
    expect(props.onHowToPlay).toHaveBeenCalledTimes(1);
  });
});
