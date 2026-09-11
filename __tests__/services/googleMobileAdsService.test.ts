/* eslint-disable import/first */
jest.mock("react-native-google-mobile-ads", () => ({
  __esModule: true,
  default: () => ({ initialize: () => Promise.resolve() }),
  AdEventType: { CLOSED: "closed", ERROR: "error" },
  RewardedAdEventType: { EARNED_REWARD: "earned_reward", LOADED: "rewarded_loaded" },
  RewardedAd: { createForAdRequest: jest.fn() },
}));

import { AdEventType, RewardedAdEventType } from "react-native-google-mobile-ads";

import {
  createGoogleMobileAdsService,
  type GoogleMobileAdsSdk,
  type NativeRewardedAd,
} from "../../src/services/ads/GoogleMobileAdsService";

type Listener = Parameters<NativeRewardedAd["addAdEventsListener"]>[0];

function nativeAd() {
  const listeners = new Set<Listener>();
  const ad: NativeRewardedAd & { emit: (type: Parameters<Listener>[0]["type"]) => void } = {
    addAdEventsListener(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load: jest.fn(),
    removeAllListeners: jest.fn(() => listeners.clear()),
    show: jest.fn(() => Promise.resolve()),
    emit(type) {
      for (const listener of [...listeners]) listener({ type });
    },
  };
  return ad;
}

function harness() {
  const ads: ReturnType<typeof nativeAd>[] = [];
  const sdk: GoogleMobileAdsSdk = {
    initialize: jest.fn(() => Promise.resolve()),
    createRewarded: jest.fn(() => {
      const ad = nativeAd();
      ads.push(ad);
      return ad;
    }),
  };
  const service = createGoogleMobileAdsService(
    {
      rewarded_freeze: "freeze-unit",
      rewarded_defuse: "defuse-unit",
    },
    sdk,
  );
  return { ads, sdk, service };
}

async function emitLoaded(ads: ReturnType<typeof nativeAd>[]) {
  await Promise.resolve();
  await Promise.resolve();
  expect(ads).toHaveLength(1);
  ads[0].emit(RewardedAdEventType.LOADED);
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

describe("GoogleMobileAdsService", () => {
  it("returns unavailable without initializing when a unit ID is missing", async () => {
    const sdk: GoogleMobileAdsSdk = {
      initialize: jest.fn(() => Promise.resolve()),
      createRewarded: jest.fn(),
    };
    const service = createGoogleMobileAdsService(
      { rewarded_freeze: null, rewarded_defuse: null },
      sdk,
    );

    await expect(service.showRewarded("rewarded_freeze")).resolves.toBe("unavailable");
    expect(sdk.initialize).not.toHaveBeenCalled();
  });

  it("normalizes earned only after the native ad closes", async () => {
    const { ads, service } = harness();
    const shown = service.showRewarded("rewarded_freeze");
    await emitLoaded(ads);
    expect(ads[0].show).toHaveBeenCalledTimes(1);
    ads[0].emit(RewardedAdEventType.EARNED_REWARD);
    ads[0].emit(AdEventType.CLOSED);

    await expect(shown).resolves.toBe("earned");
  });

  it("returns closed without an earned event and error on load failure", async () => {
    const closedHarness = harness();
    const closed = closedHarness.service.showRewarded("rewarded_defuse");
    await emitLoaded(closedHarness.ads);
    closedHarness.ads[0].emit(AdEventType.CLOSED);
    await expect(closed).resolves.toBe("closed");

    const errorHarness = harness();
    const failed = errorHarness.service.showRewarded("rewarded_defuse");
    await Promise.resolve();
    await Promise.resolve();
    errorHarness.ads[0].emit(AdEventType.ERROR);
    await expect(failed).resolves.toBe("error");
  });

  it("reuses a bounded preloaded instance for the next show", async () => {
    const { ads, sdk, service } = harness();
    const preload = service.preloadRewarded("rewarded_freeze");
    await emitLoaded(ads);
    await preload;

    const shown = service.showRewarded("rewarded_freeze");
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    expect(sdk.createRewarded).toHaveBeenCalledTimes(1);
    ads[0].emit(AdEventType.CLOSED);
    await expect(shown).resolves.toBe("closed");
  });
});
