import { fireEvent, render } from "@testing-library/react-native";
import { Animated, Text } from "react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { PieceTray } from "../../src/components/PieceTray";
import { PressableFeedback } from "../../src/components/PressableFeedback";
import { RewardedActionBar } from "../../src/components/RewardedActionButton";
import { TimerBadge } from "../../src/components/TimerBadge";
import type { HandPiece } from "../../src/domain/gameTypes";
import { useAppearAnimation } from "../../src/hooks/useAppearAnimation";

function AppearProbe({ reducedMotion }: { reducedMotion: boolean }) {
  const style = useAppearAnimation(reducedMotion);
  return <Animated.View testID="appear" style={style} />;
}

function flat(node: { props: Record<string, unknown> }): ViewStyle {
  return (StyleSheet.flatten(node.props.style as ViewStyle) ?? {}) as ViewStyle;
}

function hasScale(transform: unknown): boolean {
  return Array.isArray(transform) && transform.some((entry) => "scale" in (entry as object));
}

describe("PressableFeedback", () => {
  it("forwards the press and fires onPress once", async () => {
    const onPress = jest.fn();
    const result = await render(
      <PressableFeedback onPress={onPress} testID="pf">
        <Text>tap</Text>
      </PressableFeedback>,
    );
    fireEvent.press(result.getByTestId("pf"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire onPress while disabled (no double-trigger on a dead control)", async () => {
    const onPress = jest.fn();
    const result = await render(
      <PressableFeedback onPress={onPress} disabled testID="pf">
        <Text>tap</Text>
      </PressableFeedback>,
    );
    fireEvent.press(result.getByTestId("pf"));
    fireEvent.press(result.getByTestId("pf"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("forwards accessibility props untouched", async () => {
    const result = await render(
      <PressableFeedback
        onPress={jest.fn()}
        testID="pf"
        accessibilityRole="button"
        accessibilityLabel="Do it"
        accessibilityState={{ disabled: false }}
      >
        <Text>tap</Text>
      </PressableFeedback>,
    );
    const node = result.getByTestId("pf");
    expect(node.props.accessibilityRole).toBe("button");
    expect(node.props.accessibilityLabel).toBe("Do it");
    expect(node.props.accessibilityState).toEqual({ disabled: false });
  });

  it("dim mode fades opacity and never binds a transform", async () => {
    const result = await render(
      <PressableFeedback onPress={jest.fn()} testID="pf">
        <Text>tap</Text>
      </PressableFeedback>,
    );
    const style = flat(result.getByTestId("pf"));
    expect(style.opacity).toBeDefined();
    expect(style.transform).toBeUndefined();
  });

  it("scale mode binds a scale transform with motion, and omits it under reduced motion", async () => {
    const moving = await render(
      <PressableFeedback onPress={jest.fn()} pressStyle="scale" reducedMotion={false} testID="pf">
        <Text>tap</Text>
      </PressableFeedback>,
    );
    expect(hasScale(flat(moving.getByTestId("pf")).transform)).toBe(true);

    const reduced = await render(
      <PressableFeedback onPress={jest.fn()} pressStyle="scale" reducedMotion testID="pf">
        <Text>tap</Text>
      </PressableFeedback>,
    );
    // No identity scale transform under reduced motion (Android layer guard).
    expect(hasScale(flat(reduced.getByTestId("pf")).transform)).toBe(false);
  });
});

describe("dock press feedback reduced-motion", () => {
  function bar(reducedMotion: boolean) {
    return render(
      <RewardedActionBar
        reducedMotion={reducedMotion}
        freeze={{
          label: "FREEZE",
          glyph: "❄",
          testID: "freeze-button",
          onPress: jest.fn(),
          disabled: false,
          active: false,
          placementsRemaining: 0,
        }}
        defuse={{
          label: "DEFUSE",
          glyph: "⚡",
          testID: "defuse-button",
          onPress: jest.fn(),
          disabled: false,
          selected: false,
        }}
      />,
    );
  }

  it("keeps the dock press scale off under reduced motion and on with motion", async () => {
    const reduced = await bar(true);
    expect(hasScale(flat(reduced.getByTestId("freeze-button")).transform)).toBe(false);

    const moving = await bar(false);
    expect(hasScale(flat(moving.getByTestId("freeze-button")).transform)).toBe(true);
  });

  it("does not trigger a pending dock action (guards double-spend)", async () => {
    const onPress = jest.fn();
    const result = await render(
      <RewardedActionBar
        freeze={{
          label: "FREEZE",
          glyph: "❄",
          testID: "freeze-button",
          onPress,
          disabled: true,
          phase: "pending",
          active: false,
          placementsRemaining: 0,
        }}
        defuse={{
          label: "DEFUSE",
          glyph: "⚡",
          testID: "defuse-button",
          onPress: jest.fn(),
          disabled: false,
          selected: false,
        }}
      />,
    );
    fireEvent.press(result.getByTestId("freeze-button"));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("selection and timer motion", () => {
  it("lifts the selected tray piece with motion and omits the lift under reduced motion", async () => {
    const hand: HandPiece[] = [{ handId: "hand-0-0", shapeId: "single", colorId: "cyan" }];
    const moving = await render(
      <PieceTray
        hand={hand}
        selectedHandId="hand-0-0"
        onSelect={jest.fn()}
        reducedMotion={false}
      />,
    );
    expect(hasScale(flat(moving.getByTestId("tray-piece-hand-0-0")).transform)).toBe(true);

    const reduced = await render(
      <PieceTray hand={hand} selectedHandId="hand-0-0" onSelect={jest.fn()} reducedMotion />,
    );
    expect(flat(reduced.getByTestId("tray-piece-hand-0-0")).transform).toBeUndefined();
  });

  it("keeps the timer badge transform present with motion and absent under reduced motion", async () => {
    const moving = await render(
      <TimerBadge pieceId="p" remainingTurns={2} colorId="cyan" reducedMotion={false} />,
    );
    expect(flat(moving.getByTestId("timer-badge-p")).transform).toBeDefined();

    const reduced = await render(
      <TimerBadge pieceId="q" remainingTurns={2} colorId="cyan" reducedMotion />,
    );
    expect(flat(reduced.getByTestId("timer-badge-q")).transform).toBeUndefined();
  });
});

describe("modal appear transition", () => {
  it("rises + fades with motion but resolves instantly (no transform) under reduced motion", async () => {
    const moving = await render(<AppearProbe reducedMotion={false} />);
    const movingStyle = flat(moving.getByTestId("appear"));
    expect(movingStyle.opacity).toBeDefined();
    expect(Array.isArray(movingStyle.transform)).toBe(true);

    const reduced = await render(<AppearProbe reducedMotion />);
    const reducedStyle = flat(reduced.getByTestId("appear"));
    expect(reducedStyle.opacity).toBe(1);
    expect(reducedStyle.transform).toBeUndefined();
  });
});
