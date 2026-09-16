/** The complete rewarded-placement catalog approved for V1. */
export type RewardedPlacement = "rewarded_freeze" | "rewarded_defuse";

/** Result of showing a rewarded ad (docs/ARCHITECTURE.md "Service adapters").
 *  Only `earned` may mutate game state; the other three are the cancel/failure/
 *  unavailable branches the run lifecycle must handle without changing state. */
export type RewardedResult = "earned" | "closed" | "unavailable" | "error";

/** Result of asking the SDK-owned consent layer to reopen privacy choices. */
export type PrivacyOptionsResult = "shown" | "not-required" | "error";

/** The seam every ad-dependent flow talks to. `MockAdService` backs
 *  development and tests; Google Mobile Ads backs production native builds.
 *  Nothing in `src/domain` may import this — rewards are applied by calling
 *  the pure domain APIs only after `earned`. */
export interface AdService {
  preloadRewarded(placement: RewardedPlacement): Promise<void>;
  showRewarded(placement: RewardedPlacement): Promise<RewardedResult>;
  showPrivacyOptions(): Promise<PrivacyOptionsResult>;
}
