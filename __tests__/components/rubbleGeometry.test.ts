import { getRubbleGeometry } from "../../src/components/RubbleSurface/rubbleGeometry";

describe("getRubbleGeometry (P1-6)", () => {
  it("is deterministic — the same cell always yields the same damage", () => {
    expect(getRubbleGeometry(3, 5)).toEqual(getRubbleGeometry(3, 5));
    expect(getRubbleGeometry(0, 0)).toEqual(getRubbleGeometry(0, 0));
  });

  it("varies the layout across cells", () => {
    const layouts = new Set<string>();
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        layouts.add(JSON.stringify(getRubbleGeometry(row, column).cracks));
      }
    }
    // More than one distinct crack layout appears across the board.
    expect(layouts.size).toBeGreaterThan(1);
  });

  it("gives every cell two or three cracks with exactly one fissure", () => {
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        const { cracks } = getRubbleGeometry(row, column);
        expect(cracks.length).toBeGreaterThanOrEqual(2);
        expect(cracks.length).toBeLessThanOrEqual(3);
        expect(cracks.filter((crack) => crack.fissure)).toHaveLength(1);
      }
    }
  });

  it("keeps all crack anchors within the cell bounds (0–100%)", () => {
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        const { cracks, facets } = getRubbleGeometry(row, column);
        for (const crack of cracks) {
          expect(crack.topPct).toBeGreaterThanOrEqual(0);
          expect(crack.topPct).toBeLessThanOrEqual(100);
          expect(crack.leftPct).toBeGreaterThanOrEqual(0);
          expect(crack.leftPct).toBeLessThanOrEqual(100);
        }
        for (const facet of facets) {
          expect(facet.topPct).toBeGreaterThanOrEqual(0);
          expect(facet.leftPct).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
