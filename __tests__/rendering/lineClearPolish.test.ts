import { buildEffectScene } from "../../src/rendering/cinematic/effects/effectScene";
import { sceneGeometry } from "../../src/rendering/cinematic/geometry";
import { cinematicPalette } from "../../src/rendering/cinematic/palette";
import type { GameEvent } from "../../src/domain/events";
import { buildEffectPlan } from "../../src/ui/effects/eventEffects";
import { resolveTheme } from "../../src/ui/themes";

const geometry = sceneGeometry(328, 8);
const palette = cinematicPalette(resolveTheme(undefined));

function scene(rows: number[], columns: number[] = [], reducedMotion = false) {
  const events: GameEvent[] = [{ type: "linesCleared", rows, columns }];
  return buildEffectScene(buildEffectPlan(events, reducedMotion), geometry, palette, reducedMotion);
}

describe("cinematic premium clear presentation", () => {
  it("starts directional sweeps after the immediate impact phase", () => {
    const row = scene([2]);
    const column = scene([], [5]);
    expect(row.sweeps[0]).toMatchObject({ orientation: "row", delayMs: 80 });
    expect(column.sweeps[0]).toMatchObject({ orientation: "column", delayMs: 80 });
  });

  it("escalates bloom and board impulse with clear magnitude", () => {
    const single = scene([0]);
    const double = scene([0, 1]);
    const triple = scene([0, 1, 2]);
    const overload = scene([0, 1, 2, 3]);
    expect(single.blooms.length).toBeGreaterThan(0);
    expect(double.blooms[0].peak).toBeGreaterThan(single.blooms[0].peak);
    expect(triple.blooms[0].peak).toBeGreaterThan(double.blooms[0].peak);
    expect(overload.blooms[0].peak).toBeGreaterThan(triple.blooms[0].peak);
    expect([single.shake, double.shake, triple.shake, overload.shake]).toEqual([0, 2, 4, 6]);
  });

  it("uses one release flash per participating cell and strengthens intersections", () => {
    const coordinated = scene([0], [0]);
    const intersection = coordinated.flashes.filter((flash) => flash.key === "clear-0-0");
    const ordinary = coordinated.flashes.find((flash) => flash.key === "clear-0-1");
    expect(intersection).toHaveLength(1);
    expect(intersection[0].peak).toBeGreaterThan(ordinary?.peak ?? 0);
  });

  it("retains non-travelling geometry under Reduced Motion", () => {
    const reduced = scene([1], [6], true);
    expect(reduced.sweeps).toEqual([]);
    expect(reduced.shake).toBe(0);
    expect(reduced.blooms).toHaveLength(2);
    expect(reduced.flashes.length).toBeGreaterThan(0);
  });
});
