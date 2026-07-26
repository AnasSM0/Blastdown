/** `GoogleRewardedAdPort` and `AdsRuntimeProvider` are deliberately absent from
 *  this barrel: they reach the ad SDK, and re-exporting them here would pull the
 *  native module into every consumer of the ads seam. `app/_layout.tsx` imports
 *  `AdsRuntimeProvider` directly. */
export { AdServiceProvider, useAdService } from "./AdServiceProvider";
export {
  createMockAdService,
  type MockAdServiceConfig,
  type MockRewardedScript,
} from "./MockAdService";
export {
  createGoogleAdService,
  type GoogleAdService,
  type GoogleAdServiceOptions,
} from "./GoogleAdService";
export { isNoAdAvailableCode } from "./rewardedPort";
export type {
  RewardedAdEvent,
  RewardedAdHandle,
  RewardedAdListener,
  RewardedAdPort,
} from "./rewardedPort";
export { REWARD_PLACEMENTS, type RewardPlacementKey } from "./placements";
export type { AdService, InterstitialResult, RewardedPlacement, RewardedResult } from "./types";
