import { render } from "@testing-library/react-native";

import { EffectsLayer } from "../../src/components/effects/EffectsLayer";
import { buildEffectPlan } from "../../src/ui/effects/eventEffects";
import type { GameEvent } from "../../src/domain/events";

function planFor(events: GameEvent[], reduced = false) {
  return buildEffectPlan(events, reduced);
}

describe("EffectsLayer", () => {
  it("renders a flash for every cleared cell", async () => {
    const plan = planFor([{ type: "linesCleared", rows: [0], columns: [] }]);
    const result = await render(<EffectsLayer plan={plan} cellSize={40} reducedMotion={false} />);
    expect(result.getByTestId("effects-layer")).toBeTruthy();
  });

  it("shows a DEFUSED bonus when a piece is defused with the clear", async () => {
    const plan = planFor([
      { type: "linesCleared", rows: [2], columns: [] },
      { type: "pieceDefused", pieceId: "piece-2", bonus: 95 },
      { type: "scoreChanged", delta: 120, score: 120 },
    ]);
    const result = await render(<EffectsLayer plan={plan} cellSize={40} reducedMotion={false} />);
    expect(result.getByText("DEFUSED +95")).toBeTruthy();
  });

  it("shows a positive score float for a plain clear (no defuse)", async () => {
    const plan = planFor([
      { type: "linesCleared", rows: [3], columns: [] },
      { type: "scoreChanged", delta: 40, score: 40 },
    ]);
    const result = await render(<EffectsLayer plan={plan} cellSize={40} reducedMotion={false} />);
    expect(result.getByText("+40")).toBeTruthy();
  });

  it("still renders under reduced motion", async () => {
    const plan = planFor([{ type: "linesCleared", rows: [0], columns: [1] }], true);
    const result = await render(<EffectsLayer plan={plan} cellSize={40} reducedMotion />);
    expect(result.getByTestId("effects-layer")).toBeTruthy();
  });
});
