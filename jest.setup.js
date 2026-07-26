/* global jest */
// Mocks the native gesture-handler module so components using GestureDetector
// render under jest without a native runtime.
require("react-native-gesture-handler/jestSetup");

// Official in-memory AsyncStorage mock so the storage seam imports cleanly
// under jest (tests inject the memory StorageService, but the module still
// resolves AsyncStorage at import time).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// The ad SDK is a TurboModule and cannot load under jest. Nothing in the test
// suite should reach it — consent and rewarded logic are tested through their
// injected ports (`ConsentPort`, `RewardedAdPort`), and the mock services back
// every screen test. This stub exists so an accidental import resolves to an
// inert module instead of exploding, and so it is obvious in a failure that the
// real SDK was reached: every call here rejects.
jest.mock("react-native-google-mobile-ads", () => {
  const unreachable = (name) => () =>
    Promise.reject(new Error(`react-native-google-mobile-ads.${name} is not available under jest`));
  return {
    __esModule: true,
    default: () => ({
      initialize: unreachable("initialize"),
      setRequestConfiguration: unreachable("setRequestConfiguration"),
    }),
    AdsConsent: {
      gatherConsent: unreachable("AdsConsent.gatherConsent"),
      showPrivacyOptionsForm: unreachable("AdsConsent.showPrivacyOptionsForm"),
      requestInfoUpdate: unreachable("AdsConsent.requestInfoUpdate"),
      reset: () => undefined,
    },
    AdsConsentStatus: {
      UNKNOWN: "UNKNOWN",
      REQUIRED: "REQUIRED",
      NOT_REQUIRED: "NOT_REQUIRED",
      OBTAINED: "OBTAINED",
    },
    AdsConsentPrivacyOptionsRequirementStatus: {
      UNKNOWN: "UNKNOWN",
      REQUIRED: "REQUIRED",
      NOT_REQUIRED: "NOT_REQUIRED",
    },
    AdsConsentDebugGeography: {
      DISABLED: 0,
      EEA: 1,
      NOT_EEA: 2,
      REGULATED_US_STATE: 3,
      OTHER: 4,
    },
    AdEventType: {
      LOADED: "loaded",
      ERROR: "error",
      OPENED: "opened",
      PAID: "paid",
      CLICKED: "clicked",
      CLOSED: "closed",
    },
    RewardedAdEventType: {
      LOADED: "rewarded_loaded",
      EARNED_REWARD: "rewarded_earned_reward",
    },
    RewardedAd: {
      createForAdRequest: () => {
        throw new Error("RewardedAd.createForAdRequest is not available under jest");
      },
    },
    TestIds: { REWARDED: "ca-app-pub-3940256099942544/5224354917" },
  };
});
