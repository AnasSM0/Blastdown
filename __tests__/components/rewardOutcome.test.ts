import { phaseForResult } from "../../src/ui/effects/rewardPhase";

describe("phaseForResult", () => {
  it("reports success only when the reward actually applied", () => {
    expect(phaseForResult("earned", true)).toBe("success");
    // An earned ad is not a granted reward: the run may already have used it,
    // or the domain may reject the action. Reporting success here would tell
    // the player they got something they did not get.
    expect(phaseForResult("earned", false)).toBe("unapplied");
  });

  it("defaults to success for an earned ad only when applied is not stated", () => {
    // The default exists so existing callers stay compiling; every caller in the
    // app passes the real result of its guarded mutation.
    expect(phaseForResult("earned")).toBe("success");
  });

  it("treats a dismissal as cancelled and everything else as a failure", () => {
    expect(phaseForResult("closed")).toBe("cancelled");
    expect(phaseForResult("unavailable")).toBe("failure");
    expect(phaseForResult("error")).toBe("failure");
  });

  it("never reports success for a non-earned result, whatever applied says", () => {
    for (const result of ["closed", "unavailable", "error"] as const) {
      expect(phaseForResult(result, true)).not.toBe("success");
      expect(phaseForResult(result, false)).not.toBe("success");
    }
  });
});
