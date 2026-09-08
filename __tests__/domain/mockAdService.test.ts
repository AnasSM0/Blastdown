import { createMockAdService } from "../../src/services/ads/MockAdService";
import { REWARD_PLACEMENTS } from "../../src/services/ads/placements";

describe("createMockAdService", () => {
  it("publishes only the two approved V1 rewarded placements", () => {
    expect(REWARD_PLACEMENTS).toEqual({
      freeze: "rewarded_freeze",
      defuse: "rewarded_defuse",
    });
  });

  it("does not expose an interstitial production contract", () => {
    const service = createMockAdService();
    expect("preloadInterstitial" in service).toBe(false);
    expect("showInterstitial" in service).toBe(false);
  });

  it("earns by default and records every show", async () => {
    const service = createMockAdService();
    expect(await service.showRewarded("rewarded_freeze")).toBe("earned");
    expect(await service.showRewarded("rewarded_defuse")).toBe("earned");
    expect(service.shown).toEqual(["rewarded_freeze", "rewarded_defuse"]);
  });

  it("honors a fixed per-placement result", async () => {
    const service = createMockAdService({ rewarded: { rewarded_freeze: "closed" } });
    expect(await service.showRewarded("rewarded_freeze")).toBe("closed");
    expect(await service.showRewarded("rewarded_freeze")).toBe("closed");
  });

  it("uses defaultRewarded for unscripted placements", async () => {
    const service = createMockAdService({ defaultRewarded: "unavailable" });
    expect(await service.showRewarded("rewarded_freeze")).toBe("unavailable");
  });

  it("consumes a scripted queue then repeats the last entry", async () => {
    const service = createMockAdService({
      rewarded: { rewarded_defuse: ["error", "earned"] },
    });
    expect(await service.showRewarded("rewarded_defuse")).toBe("error");
    expect(await service.showRewarded("rewarded_defuse")).toBe("earned");
    expect(await service.showRewarded("rewarded_defuse")).toBe("earned");
  });
});
