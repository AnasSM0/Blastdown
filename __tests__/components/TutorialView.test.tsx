import { act, render, userEvent, waitFor } from "@testing-library/react-native";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { TutorialView } from "../../src/components/Tutorial";

const STEP_1_DROP = { absoluteX: 24, absoluteY: 78 };
const STEP_2_TARGET_DROP = { absoluteX: 305, absoluteY: 194 };

async function completeStep1ByTap(
  result: Awaited<ReturnType<typeof render>>,
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.press(result.getByTestId("tray-piece-tut-1"));
  await user.press(result.getByTestId("cell-4-4"));
}

describe("TutorialView", () => {
  it("shows step 1 with the exact copy and no Skip until the placement is done", async () => {
    const result = await render(
      <TutorialView onComplete={jest.fn()} onSkip={jest.fn()} boardSize={328} />,
    );
    expect(result.getByTestId("tutorial-message")).toHaveTextContent(
      "Drag a block onto the board.",
    );
    expect(result.queryByTestId("tutorial-skip-button")).toBeNull();
    expect(result.getByTestId("reactor-background")).toBeTruthy();
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

  it("places step 1 by drag through the production gesture pathway", async () => {
    const result = await render(
      <TutorialView onComplete={jest.fn()} onSkip={jest.fn()} boardSize={328} />,
    );

    const gesture = getByGestureTestId("tray-drag-tut-1");
    await act(() => fireGestureHandler(gesture, [STEP_1_DROP]));
    await act(() => fireGestureHandler(gesture, [STEP_1_DROP]));

    expect(result.getByTestId("block-0-0")).toBeTruthy();
    expect(result.queryByTestId("tray-piece-tut-1")).toBeNull();
    expect(result.getAllByTestId(/^timer-badge-/)).toHaveLength(1);
    expect(result.getByTestId("tutorial-next-button").props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it("requires and accepts tap placement on step 2", async () => {
    const user = userEvent.setup();
    const result = await render(
      <TutorialView onComplete={jest.fn()} onSkip={jest.fn()} boardSize={328} />,
    );
    await completeStep1ByTap(result, user);
    await user.press(result.getByTestId("tutorial-next-button"));
    expect(result.getByTestId("tutorial-next-button").props.accessibilityState.disabled).toBe(true);
    await user.press(result.getByTestId("tray-piece-tut-2"));
    await user.press(result.getByTestId("cell-3-7"));
    expect(result.getByTestId("tutorial-next-button").props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it("requires and accepts drag placement on step 2", async () => {
    const user = userEvent.setup();
    const result = await render(
      <TutorialView onComplete={jest.fn()} onSkip={jest.fn()} boardSize={328} />,
    );
    await completeStep1ByTap(result, user);
    await user.press(result.getByTestId("tutorial-next-button"));
    await waitFor(() => expect(getByGestureTestId("tray-drag-tut-2")).toBeTruthy());
    await act(() =>
      fireGestureHandler(getByGestureTestId("tray-drag-tut-2"), [STEP_2_TARGET_DROP]),
    );
    expect(result.queryByTestId("tray-piece-tut-2")).toBeNull();
    expect(result.getByTestId("tutorial-next-button").props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it("rejects a disallowed step 2 drag without advancing", async () => {
    const user = userEvent.setup();
    const result = await render(
      <TutorialView onComplete={jest.fn()} onSkip={jest.fn()} boardSize={328} />,
    );
    await completeStep1ByTap(result, user);
    await user.press(result.getByTestId("tutorial-next-button"));
    await waitFor(() => expect(getByGestureTestId("tray-drag-tut-2")).toBeTruthy());
    await act(() => fireGestureHandler(getByGestureTestId("tray-drag-tut-2"), [STEP_1_DROP]));
    expect(result.getByTestId("tray-piece-tut-2")).toBeTruthy();
    expect(result.getByTestId("tutorial-next-button").props.accessibilityState.disabled).toBe(true);
  });

  it("cancels an outside tutorial drop without advancing", async () => {
    const result = await render(
      <TutorialView onComplete={jest.fn()} onSkip={jest.fn()} boardSize={328} />,
    );
    await act(() =>
      fireGestureHandler(getByGestureTestId("tray-drag-tut-1"), [
        { absoluteX: 500, absoluteY: 500 },
      ]),
    );
    expect(result.getByTestId("tray-piece-tut-1")).toBeTruthy();
    expect(result.getByTestId("tutorial-next-button").props.accessibilityState.disabled).toBe(true);
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
    await user.press(result.getByTestId("tutorial-next-button"));
    expect(result.getByTestId("tutorial-message")).toHaveTextContent(messages[0]);
    await user.press(result.getByTestId("tray-piece-tut-2"));
    await user.press(result.getByTestId("cell-3-7"));
    for (const message of messages.slice(1)) {
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
