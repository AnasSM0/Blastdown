import type { RewardedResult } from "../ads/types";
import type { RewardResultOutcome } from "./types";

/** Normalize the ad service's `RewardedResult` into the analytics outcome
 *  vocabulary. The only rename is "error" → "failed"; everything else passes
 *  through so the funnel reads naturally (offer → earned/closed/unavailable/
 *  failed). Single source of this mapping so every placement logs identically. */
export function rewardOutcome(result: RewardedResult): RewardResultOutcome {
  return result === "error" ? "failed" : result;
}
