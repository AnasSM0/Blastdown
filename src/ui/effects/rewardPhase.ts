import type { RewardedResult } from "../../services/ads/types";

/** The transient presentation state of a rewarded action. Shared by every
 *  reward surface — the Freeze and Defuse dock buttons, the game-over Revive,
 *  and the results-screen Double Bolts — so an outcome reads the same wherever
 *  it happens. Presentation only: it never gates or repeats a reward, which
 *  stays earn-only in `useRewardedAction`. */
export type RewardActionPhase = "idle" | "pending" | "success" | "failure" | "cancelled";

/** How long an outcome (success/failure/cancelled) stays visible before it
 *  settles back to idle. */
export const REWARD_OUTCOME_MS = 1400;
export const REWARD_OUTCOME_REDUCED_MS = 700;

/** Map a rewarded-ad result to its presentation phase. `unavailable` and
 *  `error` are both failures to the player: the reward did not happen and it
 *  wasn't their doing. `closed` is a deliberate dismissal, so it reads as
 *  cancelled rather than as something going wrong. */
export function phaseForResult(result: RewardedResult): RewardActionPhase {
  if (result === "earned") {
    return "success";
  }
  if (result === "closed") {
    return "cancelled";
  }
  return "failure";
}
