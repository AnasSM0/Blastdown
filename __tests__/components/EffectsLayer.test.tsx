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

  it("shows the numeric bonus while semantic defuse copy belongs to praise", async () => {
    const plan = planFor([
      { type: "linesCleared", rows: [2], columns: [] },
      { type: "pieceDefused", pieceId: "piece-2", bonus: 95, remainingTurns: 3 },
      { type: "scoreChanged", delta: 120, score: 120 },
    ]);
    const result = await render(<EffectsLayer plan={plan} cellSize={40} reducedMotion={false} />);
    expect(result.getByText("+95")).toBeTruthy();
    expect(result.queryByText(/DEFUSED/)).toBeNull();
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

  it("bursts once per event-provided explosion cell and shows the penalty", async () => {
    const plan = planFor([
      { type: "explosionStarted", explosionId: "e-1", pieceId: "piece-1" },
      { type: "explosionStarted", explosionId: "e-2", pieceId: "piece-2" },
      {
        type: "rubbleCreated",
        explosionId: "e-1",
        cells: [
          { row: 1, column: 1 },
          { row: 1, column: 2 },
        ],
      },
      { type: "rubbleCreated", explosionId: "e-2", cells: [{ row: 5, column: 5 }] },
      { type: "scoreChanged", delta: -100, score: 0 },
      { type: "comboChanged", combo: 0 },
    ]);
    const result = await render(<EffectsLayer plan={plan} cellSize={40} reducedMotion={false} />);
    // Three event-provided rubble cells across two explosions.
    expect(result.getAllByTestId("burst-cell")).toHaveLength(3);
    expect(result.getByText("-100")).toBeTruthy();
  });

  it("omits bursts and shake visuals under reduced motion but keeps the penalty", async () => {
    const plan = planFor(
      [
        { type: "explosionStarted", explosionId: "e-1", pieceId: "piece-1" },
        { type: "rubbleCreated", explosionId: "e-1", cells: [{ row: 2, column: 2 }] },
        { type: "scoreChanged", delta: -50, score: 0 },
      ],
      true,
    );
    const result = await render(<EffectsLayer plan={plan} cellSize={40} reducedMotion />);
    expect(result.queryAllByTestId("burst-cell")).toHaveLength(0);
    expect(result.getByText("-50")).toBeTruthy();
  });
});
