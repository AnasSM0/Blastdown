/** The rewarded ad placements BlastDown offers (BUILD_SPEC.md §11.2). Only the
 *  in-run and end-of-run rewards are wired for the mock lifecycle; repair-blast
 *  stays behind a post-MVP flag (§6.18) and double-bolts waits on a currency
 *  field the domain does not yet expose. */
export type RewardedPlacement =
  | "rewarded_revive"
  | "rewarded_freeze"
  | "rewarded_defuse"
  | "rewarded_double_bolts"
  | "rewarded_repair_blast";

/** Result of showing a rewarded ad (docs/ARCHITECTURE.md "Service adapters").
 *  Only `earned` may mutate game state; the other three are the cancel/failure/
 *  unavailable branches the run lifecycle must handle without changing state. */
export type RewardedResult = "earned" | "closed" | "unavailable" | "error";

/** Result of showing an interstitial. Present for contract parity with the
 *  real ad service; unused by the mock run lifecycle. */
export type InterstitialResult = "shown" | "unavailable" | "error";

/** The seam every ad-dependent flow talks to. `MockAdService` backs
 *  development and tests; the Google Mobile Ads implementation lands with the
 *  real-ads phase. Nothing in `src/domain` may import this — rewards are
 *  applied by calling the pure domain APIs only after `earned`. */
export interface AdService {
  preloadRewarded(placement: RewardedPlacement): Promise<void>;
  showRewarded(placement: RewardedPlacement): Promise<RewardedResult>;
  preloadInterstitial(): Promise<void>;
  showInterstitial(): Promise<InterstitialResult>;
  /** Whether ads may be requested at all, as decided by the consent lifecycle.
   *  Pushed in rather than read out so the service holds no reference to the
   *  consent seam. Optional: an implementation with no real ad network (the
   *  mock) is never gated. */
  setAdsAllowed?(allowed: boolean): void;
  /** Release listeners, timers and any loaded ad instance, and settle anything
   *  a caller is still awaiting. Optional: an implementation holding no native
   *  resources (the mock) has nothing to release. Called when the provider that
   *  owns the service unmounts. */
  dispose?(): void;
}
