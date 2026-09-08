import { getPulseConfig } from "../../src/ui/timerPulse";

describe("getPulseConfig", () => {
  it("pulses the urgent and warning states when motion is allowed", () => {
    expect(getPulseConfig("urgent", false)).toEqual({ scaleTo: 1.18, halfCycleMs: 250 });
    expect(getPulseConfig("warning", false)).toEqual({ scaleTo: 1.1, halfCycleMs: 400 });
  });

  it("keeps the calm states static", () => {
    expect(getPulseConfig("normal", false)).toBeNull();
    expect(getPulseConfig("caution", false)).toBeNull();
  });

  it("disables every pulse under reduced motion", () => {
    expect(getPulseConfig("urgent", true)).toBeNull();
    expect(getPulseConfig("warning", true)).toBeNull();
    expect(getPulseConfig("caution", true)).toBeNull();
    expect(getPulseConfig("normal", true)).toBeNull();
  });
});
