import { createMockAdService } from "../../src/services/ads/MockAdService";

describe("createMockAdService", () => {
  it("earns by default and records every show", async () => {
    const service = createMockAdService();
    expect(await service.showRewarded("rewarded_freeze")).toBe("earned");
    expect(await service.showRewarded("rewarded_defuse")).toBe("earned");
    expect(service.shown).toEqual(["rewarded_freeze", "rewarded_defuse"]);
  });

  it("honors a fixed per-placement result", async () => {
    const service = createMockAdService({ rewarded: { rewarded_revive: "closed" } });
    expect(await service.showRewarded("rewarded_revive")).toBe("closed");
    expect(await service.showRewarded("rewarded_revive")).toBe("closed");
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
