import { EFFECT_HARNESS_SCENARIOS } from "../../src/dev/effectHarness";

describe("B-05 development harness coverage", () => {
  it("exposes deterministic magnitude, rapid, intersection, and Reduced Motion clears", () => {
    const ids = new Set(EFFECT_HARNESS_SCENARIOS.map((scenario) => scenario.id));
    for (const id of [
      "line-clear",
      "double-clear",
      "triple-clear",
      "overload-clear",
      "row-and-column",
      "rapid-clear-3",
      "reduced-motion-clear",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
