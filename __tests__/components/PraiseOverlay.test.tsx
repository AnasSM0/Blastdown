import { act, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { PraiseOverlay, praiseMotionForTier } from "../../src/components/PraiseOverlay";
import type { PraiseResult } from "../../src/ui/praise";

const praise: PraiseResult = {
  id: "praise:1:4:naturalDefuse:CLUTCH!",
  sessionId: 1,
  turn: 4,
  tier: 3,
  text: "CLUTCH!",
  reason: "naturalDefuse",
};

describe("PraiseOverlay", () => {
  it("keeps reduced-motion praise readable without scale, skew, or rotation", async () => {
    const result = await render(
      <PraiseOverlay praise={praise} reducedMotion onComplete={jest.fn()} />,
    );
    const style = StyleSheet.flatten(result.getByTestId("praise-text").props.style);
    expect(result.getByText("CLUTCH!")).toBeTruthy();
    expect(style.transform).toBeUndefined();
    expect(style.opacity).toBeDefined();
  });

  it("uses stronger motion and longer readable timing for higher tiers", () => {
    expect(praiseMotionForTier(1).totalMs).toBeGreaterThanOrEqual(600);
    expect(praiseMotionForTier(1).totalMs).toBeLessThanOrEqual(750);
    expect(praiseMotionForTier(2).totalMs).toBeGreaterThanOrEqual(750);
    expect(praiseMotionForTier(2).totalMs).toBeLessThanOrEqual(900);
    expect(praiseMotionForTier(3).totalMs).toBeGreaterThanOrEqual(900);
    expect(praiseMotionForTier(3).totalMs).toBeLessThanOrEqual(1100);
    expect(praiseMotionForTier(3).startScale).toBeGreaterThan(praiseMotionForTier(1).startScale);
  });

  it("renders energetic motion without intercepting board input", async () => {
    const result = await render(
      <PraiseOverlay praise={praise} reducedMotion={false} onComplete={jest.fn()} />,
    );
    const overlay = result.getByTestId("praise-overlay");
    const style = StyleSheet.flatten(result.getByTestId("praise-text").props.style);
    expect(overlay.props.pointerEvents).toBe("none");
    expect(style.transform).toEqual(
      expect.arrayContaining([expect.objectContaining({ skewX: "-7deg" })]),
    );
  });

  it("completes with the mounted phrase identity after its tier duration", async () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    const result = await render(
      <PraiseOverlay praise={praise} reducedMotion={false} onComplete={onComplete} />,
    );
    await act(() => jest.advanceTimersByTime(praiseMotionForTier(3).totalMs));
    expect(onComplete).toHaveBeenCalledWith(praise.id);
    await result.unmount();
    jest.useRealTimers();
  });
});
