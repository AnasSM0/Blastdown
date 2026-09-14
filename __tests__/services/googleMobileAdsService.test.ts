/* eslint-disable import/first */
jest.mock("react-native-google-mobile-ads", () => ({
  __esModule: true,
  default: () => ({ initialize: () => Promise.resolve() }),
  AdEventType: { CLOSED: "closed", ERROR: "error" },
  AdsConsent: {
    gatherConsent: jest.fn(async () => ({ canRequestAds: true })),
    requestInfoUpdate: jest.fn(async () => ({ privacyOptionsRequirementStatus: "required" })),
    showPrivacyOptionsForm: jest.fn(async () => ({})),
  },
  AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: "required" },
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
    gatherConsent: jest.fn(() => Promise.resolve(true)),
    initialize: jest.fn(() => Promise.resolve()),
    createRewarded: jest.fn(() => {
      const ad = nativeAd();
      ads.push(ad);
      return ad;
    }),
    showPrivacyOptions: jest.fn(() => Promise.resolve("shown")),
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
  for (let index = 0; index < 20 && ads.length === 0; index += 1) await Promise.resolve();
  expect(ads).toHaveLength(1);
  ads[0].emit(RewardedAdEventType.LOADED);
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

describe("GoogleMobileAdsService", () => {
  it("returns unavailable without initializing when a unit ID is missing", async () => {
    const sdk: GoogleMobileAdsSdk = {
      gatherConsent: jest.fn(() => Promise.resolve(true)),
      initialize: jest.fn(() => Promise.resolve()),
      createRewarded: jest.fn(),
      showPrivacyOptions: jest.fn(() => Promise.resolve("not-required")),
    };
    const service = createGoogleMobileAdsService(
      { rewarded_freeze: null, rewarded_defuse: null },
      sdk,
    );

    await expect(service.showRewarded("rewarded_freeze")).resolves.toBe("unavailable");
    expect(sdk.initialize).not.toHaveBeenCalled();
  });

  it("fails closed when UMP does not authorize ad requests", async () => {
    const { sdk, service } = harness();
    jest.mocked(sdk.gatherConsent).mockResolvedValue(false);

    await expect(service.showRewarded("rewarded_freeze")).resolves.toBe("error");
    expect(sdk.initialize).not.toHaveBeenCalled();
    expect(sdk.createRewarded).not.toHaveBeenCalled();
  });

  it("delegates privacy choices to UMP and rechecks eligibility afterward", async () => {
    const { ads, sdk, service } = harness();
    const preload = service.preloadRewarded("rewarded_freeze");
    await emitLoaded(ads);
    await preload;

    await expect(service.showPrivacyOptions()).resolves.toBe("shown");
    expect(sdk.showPrivacyOptions).toHaveBeenCalledTimes(1);

    const secondPreload = service.preloadRewarded("rewarded_defuse");
    for (let index = 0; index < 20 && ads.length < 2; index += 1) await Promise.resolve();
    expect(sdk.gatherConsent).toHaveBeenCalledTimes(2);
    const secondAd = ads[1];
    secondAd.emit(RewardedAdEventType.LOADED);
    await secondPreload;
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
    for (let index = 0; index < 20 && errorHarness.ads.length === 0; index += 1) {
      await Promise.resolve();
    }
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
