import { render } from "@testing-library/react-native";
import { Animated } from "react-native";

import { EffectStack } from "../../src/components/effects/EffectStack";
import type { GameEvent } from "../../src/domain/events";
import { buildEffectScene } from "../../src/rendering/cinematic/effects/effectScene";
import { sceneGeometry } from "../../src/rendering/cinematic/geometry";
import { cinematicPalette } from "../../src/rendering/cinematic/palette";
import type { EffectSequence } from "../../src/ui/effects/effectQueue";
import {
  buildEffectPlan,
  identifyExplosionPresentation,
  MAX_BOARD_PARTICLES,
} from "../../src/ui/effects/eventEffects";
import { resolveTheme } from "../../src/ui/themes";

function sequence(id: string, turn: number, count: number): EffectSequence {
  const cells = Array.from({ length: count }, (_, index) => ({
    row: Math.floor(index / 8),
    column: index % 8,
  }));
  const events: GameEvent[] = [
    {
      type: "explosionStarted",
      explosionId: `explosion-${turn}`,
      pieceId: `piece-${turn}`,
      sourceCells: [{ row: cells[0].row, column: cells[0].column }],
    },
    { type: "rubbleCreated", explosionId: `explosion-${turn}`, cells },
  ];
  const plan = buildEffectPlan(events, false);
  return {
    id,
    sessionGeneration: 1,
    turn,
    priority: "critical",
    plan,
    explosion: identifyExplosionPresentation(plan.explosion, id, 1, turn),
  };
}

describe("fallback B-06 explosion presentation", () => {
  it("uses one shared native clock for flash, shockwave, fragments, and rubble settle", async () => {
    const timing = jest.spyOn(Animated, "timing");
    const view = await render(
      <EffectStack sequences={[sequence("s1:t1", 1, 6)]} cellSize={38} reducedMotion={false} />,
    );

    expect(view.getByTestId("explosion-presentation")).toBeTruthy();
    expect(timing).toHaveBeenCalledTimes(1);
    timing.mockRestore();
  });

  it("caps fragments across concurrent explosion turns at the board-wide budget", async () => {
    const view = await render(
      <EffectStack
        sequences={[sequence("s1:t1", 1, 24), sequence("s1:t2", 2, 24)]}
        cellSize={38}
        reducedMotion={false}
      />,
    );

    expect(view.getAllByTestId("burst-cell")).toHaveLength(MAX_BOARD_PARTICLES);
  });

  it("charges the board budget only for fragments an earlier effect can draw", async () => {
    const view = await render(
      <EffectStack
        sequences={[sequence("s1:t1", 1, 1), sequence("s1:t2", 2, 24)]}
        cellSize={38}
        reducedMotion={false}
      />,
    );

    expect(view.getAllByTestId("burst-cell")).toHaveLength(25);
  });

  it("keeps fallback and cinematic semantic counts equivalent", async () => {
    const shared = sequence("s1:t4", 4, 5);
    const fallback = await render(
      <EffectStack sequences={[shared]} cellSize={38} reducedMotion={false} />,
    );
    const cinematic = buildEffectScene(
      shared.plan,
      sceneGeometry(328, 8),
      cinematicPalette(resolveTheme(undefined)),
      false,
      shared.explosion,
      MAX_BOARD_PARTICLES,
    );

    expect(fallback.getAllByTestId(/^explosion-shockwave-/)).toHaveLength(
      cinematic.shockwaves.length,
    );
    expect(fallback.getAllByTestId(/^rubble-impact-/)).toHaveLength(cinematic.rubbleImpacts.length);
    expect(fallback.getAllByTestId("burst-cell")).toHaveLength(cinematic.bursts.length);
  });
});
