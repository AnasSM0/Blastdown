import type { AdService, InterstitialResult, RewardedPlacement, RewardedResult } from "./types";

/** Per-placement scripted outcomes for the mock. A single result repeats for
 *  every show; an array is consumed one entry per show (the last entry repeats
 *  once exhausted) so a test can, e.g., fail once then earn. */
export type MockRewardedScript = Partial<
  Record<RewardedPlacement, RewardedResult | RewardedResult[]>
>;

export type MockAdServiceConfig = {
  /** Default result for any placement without a script entry. */
  defaultRewarded?: RewardedResult;
  rewarded?: MockRewardedScript;
  interstitial?: InterstitialResult;
};

/** In-memory `AdService` for development and tests. Deterministic: no timers,
 *  no randomness, no network. Resolves `earned` by default so the happy path
 *  works out of the box; tests inject a config to exercise the cancel/failure/
 *  unavailable branches. Records every show for assertion. */
export function createMockAdService(config: MockAdServiceConfig = {}): AdService & {
  /** Placements shown so far, in call order — for test assertions. */
  readonly shown: RewardedPlacement[];
} {
  const defaultRewarded = config.defaultRewarded ?? "earned";
  const shown: RewardedPlacement[] = [];
  // Working copies of any array scripts, consumed as shows happen.
  const queues = new Map<RewardedPlacement, RewardedResult[]>();
  for (const [placement, outcome] of Object.entries(config.rewarded ?? {})) {
    if (Array.isArray(outcome)) {
      queues.set(placement as RewardedPlacement, [...outcome]);
    }
  }

  function nextRewarded(placement: RewardedPlacement): RewardedResult {
    const queue = queues.get(placement);
    if (queue && queue.length > 0) {
      // Keep the final scripted entry once the queue would empty.
      return queue.length === 1 ? queue[0] : (queue.shift() as RewardedResult);
    }
    const scripted = config.rewarded?.[placement];
    if (typeof scripted === "string") {
      return scripted;
    }
    return defaultRewarded;
  }

  return {
    shown,
    async preloadRewarded() {
      // No-op: the mock is always "loaded".
    },
    async showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
      shown.push(placement);
      return nextRewarded(placement);
    },
    async preloadInterstitial() {
      // No-op.
    },
    async showInterstitial(): Promise<InterstitialResult> {
      return config.interstitial ?? "shown";
    },
  };
}
