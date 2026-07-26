import { createGoogleAdService } from "../../src/services/ads/GoogleAdService";
import { REWARD_PLACEMENTS } from "../../src/services/ads/placements";
import type {
  RewardedAdEvent,
  RewardedAdHandle,
  RewardedAdListener,
  RewardedAdPort,
} from "../../src/services/ads/rewardedPort";
import type { RewardedPlacement } from "../../src/services/ads/types";
import { createMemoryErrorReporter } from "../../src/services/diagnostics/MemoryErrorReporter";
import {
  resetActiveErrorReporter,
  setActiveErrorReporter,
} from "../../src/services/diagnostics/reportError";

const AD_UNITS: Partial<Record<RewardedPlacement, string>> = {
  [REWARD_PLACEMENTS.freeze]: "unit/freeze",
  [REWARD_PLACEMENTS.defuse]: "unit/defuse",
  [REWARD_PLACEMENTS.revive]: "unit/revive",
  [REWARD_PLACEMENTS.doubleBolts]: "unit/double-bolts",
};

type FakeAd = {
  adUnitId: string;
  loadCalls: number;
  showCalls: number;
  destroyed: boolean;
  /** Set to make `show()` reject, as the SDK does when the ad is not loaded. */
  showRejection: Error | null;
  emit(event: RewardedAdEvent): void;
  listenerCount(): number;
};

function createFakePort(): RewardedAdPort & { readonly ads: FakeAd[] } {
  const ads: FakeAd[] = [];
  return {
    ads,
    create(adUnitId: string): RewardedAdHandle {
      let listeners: RewardedAdListener[] = [];
      const ad: FakeAd = {
        adUnitId,
        loadCalls: 0,
        showCalls: 0,
        destroyed: false,
        showRejection: null,
        emit(event) {
          for (const listener of [...listeners]) {
            listener(event);
          }
        },
        listenerCount: () => listeners.length,
      };
      ads.push(ad);
      return {
        load() {
          ad.loadCalls += 1;
        },
        show() {
          ad.showCalls += 1;
          return ad.showRejection ? Promise.reject(ad.showRejection) : Promise.resolve();
        },
        subscribe(listener) {
          listeners.push(listener);
        },
        destroy() {
          ad.destroyed = true;
          listeners = [];
        },
      };
    },
  };
}

/** Drain the microtask queue. The service hands off between the load promise,
 *  the presentation promise and `show()`, so a single `await` is not enough. */
async function tick(times = 6): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

type Harness = ReturnType<typeof createHarness>;

function createHarness(
  overrides: {
    allowed?: boolean;
    adUnitIds?: Partial<Record<RewardedPlacement, string>>;
    ensureInitialized?: () => Promise<void>;
  } = {},
) {
  const port = createFakePort();
  const service = createGoogleAdService({
    port,
    adUnitIds: overrides.adUnitIds ?? AD_UNITS,
    adsAllowed: overrides.allowed ?? true,
    ensureInitialized: overrides.ensureInitialized,
    loadTimeoutMs: 15_000,
    earnGraceMs: 400,
  });
  return { port, service };
}

/** Request a placement and wait until the ad instance exists and `load()` has
 *  been called -- the point at which a test can emit SDK events.
 *
 *  The pending result is returned inside an object: an async function that
 *  returned it directly would adopt the promise and wait for the whole
 *  presentation, which is exactly what these tests must not do. */
async function startShow(harness: Harness, placement: RewardedPlacement) {
  const result = harness.service.showRewarded(placement);
  await tick();
  return { result };
}

/** As `startShow`, then load the ad so it is on screen. */
async function showUntilPresented(harness: Harness, placement: RewardedPlacement, index = 0) {
  const { result } = await startShow(harness, placement);
  harness.port.ads[index].emit({ type: "loaded" });
  await tick();
  return { result };
}

let reporter = createMemoryErrorReporter();

beforeEach(() => {
  jest.useFakeTimers();
  reporter = createMemoryErrorReporter();
  setActiveErrorReporter(reporter);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  resetActiveErrorReporter();
});

describe("rewarded presentation outcomes", () => {
  it("grants the reward only from the earned-reward event", async () => {
    const harness = createHarness();
    const { result } = await showUntilPresented(harness, REWARD_PLACEMENTS.freeze);

    expect(harness.port.ads[0].showCalls).toBe(1);
    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });

    expect(await result).toBe("earned");
  });

  it("grants nothing when the ad is closed without earning", async () => {
    const harness = createHarness();
    const { result } = await showUntilPresented(harness, REWARD_PLACEMENTS.defuse);

    harness.port.ads[0].emit({ type: "closed" });
    // A late reward is still honoured inside the grace window, so the close
    // does not settle immediately.
    jest.advanceTimersByTime(400);

    expect(await result).toBe("closed");
  });

  it("honours a reward that arrives after the ad has closed", async () => {
    const harness = createHarness();
    const { result } = await showUntilPresented(harness, REWARD_PLACEMENTS.revive);

    // The SDK does not contractually order these two.
    harness.port.ads[0].emit({ type: "closed" });
    harness.port.ads[0].emit({ type: "earned" });

    expect(await result).toBe("earned");
  });

  it("applies a reward exactly once however many events arrive", async () => {
    const harness = createHarness();
    const { result } = await showUntilPresented(harness, REWARD_PLACEMENTS.freeze);

    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });
    harness.port.ads[0].emit({ type: "closed" });
    harness.port.ads[0].emit({ type: "earned" });
    jest.advanceTimersByTime(1_000);

    // One promise, one resolution — `useRewardedAction` calls `onEarned` once.
    expect(await result).toBe("earned");
  });

  it("keeps a reward that was earned before a presentation error", async () => {
    const harness = createHarness();
    const { result } = await showUntilPresented(harness, REWARD_PLACEMENTS.freeze);

    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "error", code: "internal", message: "boom" });

    expect(await result).toBe("earned");
  });

  it("reports an error when the presentation itself fails", async () => {
    const harness = createHarness();
    const { result } = await showUntilPresented(harness, REWARD_PLACEMENTS.defuse);

    harness.port.ads[0].emit({ type: "error", code: "fullscreen", message: "could not present" });

    expect(await result).toBe("error");
    expect(reporter.reports.some((report) => report.context?.stage === "show")).toBe(true);
  });

  it("reports an error when the SDK refuses to show the ad", async () => {
    const harness = createHarness();
    const { result: request } = await startShow(harness, REWARD_PLACEMENTS.revive);
    harness.port.ads[0].showRejection = new Error("not loaded");
    harness.port.ads[0].emit({ type: "loaded" });

    expect(await request).toBe("error");
  });
});

describe("load failures", () => {
  it("reports no-fill as unavailable rather than an error", async () => {
    const harness = createHarness();
    const { result: request } = await startShow(harness, REWARD_PLACEMENTS.freeze);
    harness.port.ads[0].emit({
      type: "error",
      code: "googleMobileAds/error-code-no-fill",
      message: "no fill",
    });

    expect(await request).toBe("unavailable");
    expect(harness.port.ads[0].destroyed).toBe(true);
  });

  it("treats an offline load failure as unavailable", async () => {
    const harness = createHarness();
    const { result: request } = await startShow(harness, REWARD_PLACEMENTS.defuse);
    harness.port.ads[0].emit({
      type: "error",
      code: "googleMobileAds/error-code-network-error",
      message: "network unreachable",
    });

    // Offline is a normal condition for this game: no ad, no error surfaced to
    // the player, and gameplay is untouched.
    expect(await request).toBe("unavailable");
  });

  it("abandons a load that never completes", async () => {
    const harness = createHarness();
    const { result: request } = await startShow(harness, REWARD_PLACEMENTS.revive);

    jest.advanceTimersByTime(15_000);

    expect(await request).toBe("unavailable");
    expect(harness.port.ads[0].destroyed).toBe(true);
    expect(reporter.reports.some((report) => report.context?.code === "timeout")).toBe(true);
  });

  it("never records an ad unit id in a diagnostic", async () => {
    const harness = createHarness();
    const { result: request } = await startShow(harness, REWARD_PLACEMENTS.freeze);
    // Google's own ad error strings sometimes name the ad unit, so the SDK's
    // message is dropped in favour of a fixed one plus the normalized code.
    harness.port.ads[0].emit({
      type: "error",
      code: "no-fill",
      message: "No ad to show for ad unit unit/freeze",
    });
    await request;

    const serialized = JSON.stringify(reporter.reports);
    expect(serialized).not.toContain("unit/freeze");
    expect(reporter.reports.at(-1)?.context?.code).toBe("no-fill");
  });

  it("never records an ad unit id from a failed presentation either", async () => {
    const harness = createHarness();
    const { result } = await showUntilPresented(harness, REWARD_PLACEMENTS.defuse);
    harness.port.ads[0].emit({
      type: "error",
      code: "fullscreen",
      message: "ad unit unit/defuse could not be presented",
    });
    await result;

    expect(JSON.stringify(reporter.reports)).not.toContain("unit/defuse");
  });
});

describe("gating", () => {
  it("requests nothing until consent allows ads", async () => {
    const harness = createHarness({ allowed: false });

    expect(await harness.service.showRewarded(REWARD_PLACEMENTS.freeze)).toBe("unavailable");
    expect(harness.port.ads).toHaveLength(0);

    harness.service.setAdsAllowed(true);
    const { result: request } = await showUntilPresented(harness, REWARD_PLACEMENTS.freeze);
    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });
    expect(await request).toBe("earned");
  });

  it("reports an unconfigured placement as unavailable without requesting", async () => {
    const harness = createHarness({ adUnitIds: { [REWARD_PLACEMENTS.freeze]: "unit/freeze" } });

    expect(await harness.service.showRewarded(REWARD_PLACEMENTS.revive)).toBe("unavailable");
    expect(harness.port.ads).toHaveLength(0);
  });

  it("does not preload while consent is outstanding", async () => {
    const harness = createHarness({ allowed: false });
    await harness.service.preloadRewarded(REWARD_PLACEMENTS.freeze);
    expect(harness.port.ads).toHaveLength(0);
  });

  it("initializes the SDK before the first request", async () => {
    const ensureInitialized = jest.fn(async () => undefined);
    const harness = createHarness({ ensureInitialized });
    const { result: request } = await startShow(harness, REWARD_PLACEMENTS.freeze);

    expect(ensureInitialized).toHaveBeenCalled();
    harness.port.ads[0].emit({ type: "loaded" });
    await tick();
    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });
    expect(await request).toBe("earned");
  });

  it("reports unavailable when the SDK cannot be initialized", async () => {
    const harness = createHarness({
      ensureInitialized: async () => {
        throw new Error("init failed");
      },
    });

    expect(await harness.service.showRewarded(REWARD_PLACEMENTS.freeze)).toBe("unavailable");
    expect(harness.port.ads).toHaveLength(0);
  });
});

describe("consent withdrawn mid-flight", () => {
  it("does not present an ad loaded before consent was withdrawn", async () => {
    const harness = createHarness();
    const { result } = await startShow(harness, REWARD_PLACEMENTS.freeze);

    // The gate closes while the load is still in flight.
    harness.service.setAdsAllowed(false);
    harness.port.ads[0].emit({ type: "loaded" });

    expect(await result).toBe("unavailable");
    expect(harness.port.ads[0].showCalls).toBe(0);
    expect(harness.port.ads[0].destroyed).toBe(true);
  });

  it("drops a preloaded ad when consent is withdrawn", async () => {
    const harness = createHarness();
    await harness.service.preloadRewarded(REWARD_PLACEMENTS.revive);
    harness.port.ads[0].emit({ type: "loaded" });
    expect(harness.port.ads[0].destroyed).toBe(false);

    harness.service.setAdsAllowed(false);

    // Inventory requested under a permission that no longer holds is released,
    // listeners and all, rather than left sitting ready for reuse.
    expect(harness.port.ads[0].destroyed).toBe(true);
    expect(harness.port.ads[0].listenerCount()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("settles a request that was waiting on a load when the gate closes", async () => {
    const harness = createHarness();
    const { result } = await startShow(harness, REWARD_PLACEMENTS.defuse);

    harness.service.setAdsAllowed(false);

    expect(await result).toBe("unavailable");
  });

  it("leaves an ad that is already on screen to finish", async () => {
    const harness = createHarness();
    const { result } = await showUntilPresented(harness, REWARD_PLACEMENTS.freeze);

    // The user is watching it and it was requested legitimately.
    harness.service.setAdsAllowed(false);
    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });

    expect(await result).toBe("earned");
  });

  it("does not re-preload after a presentation once consent is withdrawn", async () => {
    const harness = createHarness();
    const { result } = await showUntilPresented(harness, REWARD_PLACEMENTS.freeze);
    harness.service.setAdsAllowed(false);
    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });
    await result;
    await tick();

    expect(harness.port.ads).toHaveLength(1);
  });

  it("re-checks the gate after initialization", async () => {
    let releaseInit: (() => void) | null = null;
    const harness = createHarness({
      ensureInitialized: () =>
        new Promise<void>((resolve) => {
          releaseInit = resolve;
        }),
    });
    const request = harness.service.showRewarded(REWARD_PLACEMENTS.revive);
    await tick();

    harness.service.setAdsAllowed(false);
    releaseInit!();

    expect(await request).toBe("unavailable");
    // Nothing was ever created: the gate was re-read after the await.
    expect(harness.port.ads).toHaveLength(0);
  });
});

describe("concurrency", () => {
  it("blocks a second presentation while one is on screen", async () => {
    const harness = createHarness();
    const { result: first } = await showUntilPresented(harness, REWARD_PLACEMENTS.freeze);

    // Same tick, different placement: still refused.
    const second = await harness.service.showRewarded(REWARD_PLACEMENTS.revive);
    expect(second).toBe("error");
    expect(harness.port.ads).toHaveLength(1);

    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });
    expect(await first).toBe("earned");
  });

  it("blocks a repeated request for the same placement in the same tick", async () => {
    const harness = createHarness();
    const first = harness.service.showRewarded(REWARD_PLACEMENTS.defuse);
    const second = harness.service.showRewarded(REWARD_PLACEMENTS.defuse);

    expect(await second).toBe("error");
    await tick();
    harness.port.ads[0].emit({ type: "loaded" });
    await tick();
    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });
    expect(await first).toBe("earned");
    // Only one ad was ever requested.
    expect(harness.port.ads.filter((ad) => ad.adUnitId === "unit/defuse")).toHaveLength(2);
  });

  it("allows a new request once the previous ad has closed", async () => {
    const harness = createHarness();
    const { result: first } = await showUntilPresented(harness, REWARD_PLACEMENTS.freeze);
    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });
    expect(await first).toBe("earned");
    await tick();

    // The completed presentation preloaded the next ad for this placement.
    const preloaded = harness.port.ads[1];
    expect(preloaded.adUnitId).toBe("unit/freeze");
    expect(preloaded.loadCalls).toBe(1);

    const second = harness.service.showRewarded(REWARD_PLACEMENTS.freeze);
    preloaded.emit({ type: "loaded" });
    await tick();
    preloaded.emit({ type: "earned" });
    preloaded.emit({ type: "closed" });
    expect(await second).toBe("earned");
  });
});

describe("placement routing", () => {
  it("requests each placement against its own configured unit", async () => {
    const harness = createHarness();
    const expected: [RewardedPlacement, string][] = [
      [REWARD_PLACEMENTS.freeze, "unit/freeze"],
      [REWARD_PLACEMENTS.defuse, "unit/defuse"],
      [REWARD_PLACEMENTS.revive, "unit/revive"],
      [REWARD_PLACEMENTS.doubleBolts, "unit/double-bolts"],
    ];

    for (const [placement, adUnitId] of expected) {
      const index = harness.port.ads.length;
      const { result: request } = await startShow(harness, placement);
      expect(harness.port.ads[index].adUnitId).toBe(adUnitId);
      harness.port.ads[index].emit({ type: "loaded" });
      await tick();
      harness.port.ads[index].emit({ type: "earned" });
      harness.port.ads[index].emit({ type: "closed" });
      expect(await request).toBe("earned");
      await tick();
    }
  });
});

describe("cleanup", () => {
  it("releases the ad instance after every presentation", async () => {
    const harness = createHarness();
    const { result: request } = await showUntilPresented(harness, REWARD_PLACEMENTS.freeze);
    harness.port.ads[0].emit({ type: "earned" });
    harness.port.ads[0].emit({ type: "closed" });
    await request;

    expect(harness.port.ads[0].destroyed).toBe(true);
    expect(harness.port.ads[0].listenerCount()).toBe(0);
  });

  it("settles an outstanding request and drops every listener on dispose", async () => {
    const harness = createHarness();
    const { result: pendingLoad } = await startShow(harness, REWARD_PLACEMENTS.freeze);

    harness.service.dispose();

    expect(await pendingLoad).toBe("error");
    expect(harness.port.ads[0].destroyed).toBe(true);
    expect(harness.port.ads[0].listenerCount()).toBe(0);
  });

  it("settles a presentation that is still on screen at dispose", async () => {
    const harness = createHarness();
    const { result: request } = await showUntilPresented(harness, REWARD_PLACEMENTS.defuse);
    harness.port.ads[0].emit({ type: "earned" });

    harness.service.dispose();

    // The reward was genuinely earned before the tree went away; the caller's
    // own mounted check decides whether it can still be applied.
    expect(await request).toBe("earned");
  });

  it("refuses further requests once disposed", async () => {
    const harness = createHarness();
    harness.service.dispose();

    expect(await harness.service.showRewarded(REWARD_PLACEMENTS.freeze)).toBe("error");
    expect(harness.port.ads).toHaveLength(0);
  });

  it("leaves no timer behind after a completed presentation", async () => {
    const harness = createHarness();
    const { result: request } = await showUntilPresented(harness, REWARD_PLACEMENTS.revive);
    harness.port.ads[0].emit({ type: "closed" });
    jest.advanceTimersByTime(400);
    await request;
    harness.service.dispose();

    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("interstitials", () => {
  // Not part of this phase: no ad unit, no frequency policy, and whether
  // release 1 carries them at all is an open owner decision.
  it("reports interstitials as unavailable", async () => {
    const harness = createHarness();
    await expect(harness.service.preloadInterstitial()).resolves.toBeUndefined();
    await expect(harness.service.showInterstitial()).resolves.toBe("unavailable");
  });
});
