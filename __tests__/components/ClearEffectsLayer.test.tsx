import { render } from "@testing-library/react-native";
import { Animated } from "react-native";

import { EffectsLayer } from "../../src/components/effects/EffectsLayer";
import type { GameEvent } from "../../src/domain/events";
import { buildEffectPlan } from "../../src/ui/effects/eventEffects";
import { buildEffectScene } from "../../src/rendering/cinematic/effects/effectScene";
import { sceneGeometry } from "../../src/rendering/cinematic/geometry";
import { cinematicPalette } from "../../src/rendering/cinematic/palette";
import { resolveTheme } from "../../src/ui/themes";

function plan(rows: number[], columns: number[] = [], reducedMotion = false) {
  const events: GameEvent[] = [{ type: "linesCleared", rows, columns }];
  return buildEffectPlan(events, reducedMotion);
}

describe("fallback premium clear presentation", () => {
  it("coordinates row and column lanes through one shared clear clock", async () => {
    const timing = jest.spyOn(Animated, "timing");
    const result = await render(
      <EffectsLayer plan={plan([3], [4])} cellSize={38} reducedMotion={false} />,
    );

    expect(result.getByTestId("clear-lane-row-3")).toBeTruthy();
    expect(result.getByTestId("clear-lane-column-4")).toBeTruthy();
    expect(result.getByTestId("clear-sweep-row-3")).toBeTruthy();
    expect(result.getByTestId("clear-sweep-column-4")).toBeTruthy();
    expect(timing).toHaveBeenCalledTimes(1);
    timing.mockRestore();
  });

  it("renders an intersection cell once, with stronger coordinated emphasis", async () => {
    const result = await render(
      <EffectsLayer plan={plan([0], [0])} cellSize={38} reducedMotion={false} />,
    );
    expect(result.getAllByTestId("clear-flash-0-0")).toHaveLength(1);
    expect(result.getByTestId("clear-flash-0-0").props.accessibilityHint).toBe(
      "Row and column intersection",
    );
  });

  it("represents clear lanes on all four board edges", async () => {
    const result = await render(
      <EffectsLayer plan={plan([0, 7], [0, 7])} cellSize={38} reducedMotion={false} />,
    );

    for (const testID of [
      "clear-lane-row-0",
      "clear-lane-row-7",
      "clear-lane-column-0",
      "clear-lane-column-7",
    ]) {
      expect(result.getByTestId(testID)).toBeTruthy();
    }
  });

  it("keeps static lane and cell feedback but removes travelling sweeps in Reduced Motion", async () => {
    const result = await render(
      <EffectsLayer plan={plan([2], [6], true)} cellSize={38} reducedMotion />,
    );
    expect(result.getByTestId("clear-lane-row-2")).toBeTruthy();
    expect(result.getByTestId("clear-lane-column-6")).toBeTruthy();
    expect(result.queryAllByTestId(/^clear-sweep-/)).toHaveLength(0);
    expect(result.getAllByTestId(/^clear-flash-/).length).toBeGreaterThan(0);
  });

  it("gives fallback and cinematic renderers equivalent semantic geometry", async () => {
    const sharedPlan = plan([1], [6]);
    const fallback = await render(
      <EffectsLayer plan={sharedPlan} cellSize={38} reducedMotion={false} />,
    );
    const cinematic = buildEffectScene(
      sharedPlan,
      sceneGeometry(328, 8),
      cinematicPalette(resolveTheme(undefined)),
      false,
    );

    expect(fallback.getAllByTestId(/^clear-lane-/)).toHaveLength(cinematic.blooms.length);
    expect(fallback.getAllByTestId(/^clear-sweep-/)).toHaveLength(cinematic.sweeps.length);
    expect(fallback.getAllByTestId(/^clear-flash-/)).toHaveLength(cinematic.flashes.length);
  });
});
