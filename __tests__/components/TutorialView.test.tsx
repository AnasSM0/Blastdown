import { render, userEvent } from "@testing-library/react-native";

import { TutorialView } from "../../src/components/Tutorial";

describe("TutorialView", () => {
  it("shows step 1 with the exact copy and no Skip until the placement is done", async () => {
    const result = await render(
      <TutorialView onComplete={jest.fn()} onSkip={jest.fn()} boardSize={328} />,
    );
    expect(result.getByTestId("tutorial-message")).toHaveTextContent(
      "Drag a block onto the board.",
    );
    expect(result.queryByTestId("tutorial-skip-button")).toBeNull();
    // Next is disabled until the player places the block.
    expect(result.getByTestId("tutorial-next-button").props.accessibilityState.disabled).toBe(true);
  });

  it("enables Next and Skip after the instructional placement, then advances", async () => {
    const user = userEvent.setup();
    const result = await render(
      <TutorialView onComplete={jest.fn()} onSkip={jest.fn()} boardSize={328} />,
    );

    await user.press(result.getByTestId("tray-piece-tut-1"));
    await user.press(result.getByTestId("cell-4-4"));

    expect(result.getByTestId("tutorial-skip-button")).toBeTruthy();
    expect(result.getByTestId("tutorial-next-button").props.accessibilityState.disabled).toBe(
      false,
    );

    await user.press(result.getByTestId("tutorial-next-button"));
    expect(result.getByTestId("tutorial-message")).toHaveTextContent(
      "Complete a row or column to clear it.",
    );
  });

  it("walks all six steps and finishes on Done", async () => {
    const onComplete = jest.fn();
    const user = userEvent.setup();
    const result = await render(
      <TutorialView onComplete={onComplete} onSkip={jest.fn()} boardSize={328} />,
    );

    await user.press(result.getByTestId("tray-piece-tut-1"));
    await user.press(result.getByTestId("cell-4-4"));

    const messages = [
      "Complete a row or column to clear it.",
      "Every placed piece has a countdown.",
      "Clear every cell before the timer reaches zero.",
      "Expired pieces create rubble.",
      "Complete its row or column to repair the board.",
    ];
    for (const message of messages) {
      await user.press(result.getByTestId("tutorial-next-button"));
      expect(result.getByTestId("tutorial-message")).toHaveTextContent(message);
    }
    // On the last step the primary button finishes.
    await user.press(result.getByTestId("tutorial-next-button"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("skips (after the placement) via onSkip", async () => {
    const onSkip = jest.fn();
    const user = userEvent.setup();
    const result = await render(
      <TutorialView onComplete={jest.fn()} onSkip={onSkip} boardSize={328} />,
    );
    await user.press(result.getByTestId("tray-piece-tut-1"));
    await user.press(result.getByTestId("cell-4-4"));
    await user.press(result.getByTestId("tutorial-skip-button"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
