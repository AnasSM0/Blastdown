import Constants from "expo-constants";
import { Platform } from "react-native";

import type { RewardedUnitIds } from "./GoogleMobileAdsService";
import { createMockAdService } from "./MockAdService";
import type { AdService, RewardedPlacement } from "./types";

const EMPTY_UNIT_IDS: RewardedUnitIds = {
  rewarded_freeze: null,
  rewarded_defuse: null,
};

function readUnitIds(value: unknown): RewardedUnitIds {
  if (!value || typeof value !== "object") return EMPTY_UNIT_IDS;
  const candidate = value as Partial<Record<RewardedPlacement, unknown>>;
  return {
    rewarded_freeze:
      typeof candidate.rewarded_freeze === "string" ? candidate.rewarded_freeze : null,
    rewarded_defuse:
      typeof candidate.rewarded_defuse === "string" ? candidate.rewarded_defuse : null,
  };
}

function createUnavailableAdService(): AdService {
  return {
    async preloadRewarded() {},
    async showRewarded() {
      return "unavailable";
    },
  };
}

/** Selects the real native adapter only for production. Development and tests
 * keep their deterministic mock; unsupported production platforms fail closed. */
export function createDefaultAdService(): AdService {
  const extra = Constants.expoConfig?.extra;
  if (extra?.appEnv !== "production") return createMockAdService();
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return createUnavailableAdService();
  }
  // Keep native module evaluation out of development/test provider trees while
  // retaining a static Metro-reachable production module path.
  const googleMobileAds =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./GoogleMobileAdsService") as typeof import("./GoogleMobileAdsService");
  const { createGoogleMobileAdsService } = googleMobileAds;
  return createGoogleMobileAdsService(readUnitIds(extra.adMobRewardedUnitIds));
}
