import { render } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { ComboIndicator } from "../../src/components/ComboIndicator";
import { EffectsLayer } from "../../src/components/effects/EffectsLayer";
import { PulseRing } from "../../src/components/effects/PulseRing";
import { RubbleSurface } from "../../src/components/RubbleSurface";
import { buildCuePlan, buildEffectPlan } from "../../src/ui/effects/eventEffects";

function flat(node: { props: Record<string, unknown> }): ViewStyle {
  return (StyleSheet.flatten(node.props.style as ViewStyle) ?? {}) as ViewStyle;
}

function hasScale(node: { props: Record<string, unknown> }): boolean {
  const transform = flat(node).transform;
  return Array.isArray(transform) && transform.some((entry) => "scale" in (entry as object));
}

const CLEAR_PLAN = buildEffectPlan(
  [
    { type: "linesCleared", rows: [0], columns: [] },
    { type: "scoreChanged", delta: 100, score: 100 },
  ],
  false,
);

const CLEAR_PLAN_REDUCED = buildEffectPlan(
  [
    { type: "linesCleared", rows: [0], columns: [] },
    { type: "scoreChanged", delta: 100, score: 100 },
  ],
  true,
);

describe("reduced motion in the effects layer", () => {
  it("settles cleared cells with a scale when motion is allowed", async () => {
    const result = await render(
      <EffectsLayer plan={CLEAR_PLAN} cellSize={38} reducedMotion={false} />,
    );
    const flashes = result.getAllByTestId(/^clear-flash-0-\d$/);
    expect(flashes).toHaveLength(8);
    expect(flashes.every(hasScale)).toBe(true);
  });

  it("binds no scale transform on any cleared cell under reduced motion", async () => {
    const result = await render(
      <EffectsLayer plan={CLEAR_PLAN_REDUCED} cellSize={38} reducedMotion />,
    );
    const flashes = result.getAllByTestId(/^clear-flash-0-\d$/);
    // The clear is still shown (an opacity flash), just without movement.
    expect(flashes).toHaveLength(8);
    expect(flashes.some(hasScale)).toBe(false);
  });

  it("still reports a revive as a wave of cells under reduced motion, without movement", async () => {
    const cells = [
      { row: 1, column: 1 },
      { row: 6, column: 2 },
    ];
    const result = await render(
      <EffectsLayer plan={buildCuePlan("revive", cells, true)} cellSize={38} reducedMotion />,
    );
    expect(result.getByTestId("revive-flash-1-1")).toBeTruthy();
    expect(result.getByTestId("revive-flash-6-2")).toBeTruthy();
    expect(hasScale(result.getByTestId("revive-flash-1-1"))).toBe(false);
  });

  it("renders nothing at all before the board has been measured", async () => {
    const result = await render(
      <EffectsLayer plan={CLEAR_PLAN} cellSize={0} reducedMotion={false} />,
    );
    expect(result.queryByTestId("effects-layer")).toBeNull();
  });
});

describe("PulseRing Android guard", () => {
  it("binds a scale transform with motion and none under reduced motion", async () => {
    const moving = await render(
      <PulseRing centerX={10} centerY={10} size={30} color="#fff" reducedMotion={false} />,
    );
    expect(flat(moving.getByTestId("pulse-ring")).transform).toBeDefined();

    // An identity transform would still promote this rounded view to an Android
    // hardware layer, so reduced motion must bind none at all.
    const reduced = await render(
      <PulseRing centerX={10} centerY={10} size={30} color="#fff" reducedMotion />,
    );
    expect(flat(reduced.getByTestId("pulse-ring")).transform).toBeUndefined();
  });
});

describe("ComboIndicator", () => {
  it("shows nothing at combo 0 and the multiplier above it", async () => {
    const none = await render(<ComboIndicator combo={0} />);
    expect(none.queryByTestId("combo-indicator")).toBeNull();

    const three = await render(<ComboIndicator combo={3} />);
    expect(three.getByText("x3")).toBeTruthy();
    expect(three.getByLabelText("Combo x3")).toBeTruthy();
  });

  it("binds an emphasis transform with motion and none under reduced motion", async () => {
    const moving = await render(<ComboIndicator combo={2} />);
    expect(flat(moving.getByTestId("combo-indicator")).transform).toBeDefined();

    const reduced = await render(<ComboIndicator combo={2} reducedMotion />);
    expect(flat(reduced.getByTestId("combo-indicator")).transform).toBeUndefined();
  });
});

describe("RubbleSurface Android guard", () => {
  it("never clips the rounded tile — the clip lives on an inner square view", async () => {
    const result = await render(<RubbleSurface size={40} row={0} column={0} testID="rub" />);

    // The rounded tile carries the corner radius but must not be clipped: rubble
    // appears on the same turns the board plays its shake transform, and a
    // rounded clipped view on a hardware layer renders black on Android.
    const tile = flat(result.getByTestId("rub"));
    expect(tile.borderRadius).toBeGreaterThan(0);
    expect(tile.overflow).not.toBe("hidden");

    // The cracks are still clipped — by a square view inset inside that radius.
    const clip = flat(result.getByTestId("rub-clip"));
    expect(clip.overflow).toBe("hidden");
    expect(clip.borderRadius).toBeUndefined();
  });
});
