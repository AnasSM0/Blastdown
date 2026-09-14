/* eslint-disable import/first */
const mockCreateGoogleMobileAdsService = jest.fn(() => ({
  preloadRewarded: jest.fn(async () => {}),
  showRewarded: jest.fn(async () => "unavailable" as const),
  showPrivacyOptions: jest.fn(async () => "not-required" as const),
}));

jest.mock("react-native-google-mobile-ads", () => ({
  __esModule: true,
  default: () => ({ initialize: () => Promise.resolve() }),
  AdEventType: { CLOSED: "closed", ERROR: "error" },
  RewardedAdEventType: { EARNED_REWARD: "earned_reward", LOADED: "rewarded_loaded" },
  RewardedAd: { createForAdRequest: jest.fn() },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        appEnv: "production",
        adMobRewardedUnitIds: {
          rewarded_freeze: null,
          rewarded_defuse: "defuse-unit",
        },
      },
    },
  },
}));

jest.mock("react-native", () => ({ Platform: { OS: "android" } }));

jest.mock("../../src/services/ads/GoogleMobileAdsService", () => ({
  createGoogleMobileAdsService: mockCreateGoogleMobileAdsService,
}));

import { createDefaultAdService } from "../../src/services/ads/defaultAdService";

describe("default production ad service", () => {
  it("selects the native service and preserves null unit IDs", async () => {
    const service = createDefaultAdService();

    expect(mockCreateGoogleMobileAdsService).toHaveBeenCalledWith({
      rewarded_freeze: null,
      rewarded_defuse: "defuse-unit",
    });
    await expect(service.showRewarded("rewarded_freeze")).resolves.toBe("unavailable");
  });
});
