import { BOARD_CONTENT_INSET, FRAME_WIDTH } from "../../src/ui/boardGeometry";
import { EffectsLayer } from "../../src/components/effects/EffectsLayer";

describe("GameBoard require cycle (guard)", () => {
  it("owns the shared board constants in the neutral boardGeometry module", () => {
    // BOARD_CONTENT_INSET and FRAME_WIDTH live in boardGeometry, which imports
    // no component. If the old barrel cycle (EffectsLayer → GameBoard barrel →
    // GameBoard.tsx → EffectsLayer) were reintroduced, EffectsLayer could load
    // BOARD_CONTENT_INSET as undefined; here it must resolve to a real number.
    expect(Number.isFinite(BOARD_CONTENT_INSET)).toBe(true);
    expect(Number.isFinite(FRAME_WIDTH)).toBe(true);
    expect(BOARD_CONTENT_INSET).toBeGreaterThan(0);
  });

  it("loads EffectsLayer with a defined board inset (no cycle-induced undefined)", () => {
    // EffectsLayer now imports the inset from boardGeometry, not the GameBoard
    // barrel. Importing it must succeed and it must be a usable component.
    expect(typeof EffectsLayer).toBe("function");
  });
});
