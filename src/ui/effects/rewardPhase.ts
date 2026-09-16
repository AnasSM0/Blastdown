import type { RewardedResult } from "../../services/ads/types";

/** The transient presentation state of the V1 Freeze and Defuse reward
 *  surfaces, so an outcome reads the same wherever it happens. Presentation
 *  only: it never gates or repeats a reward, which
 *  stays earn-only in `useRewardedAction`. */
export type RewardActionPhase =
  | "idle"
  | "pending"
  | "success"
  | "failure"
  | "cancelled"
  /** The ad was earned but the reward could not be applied — the run had
   *  already used it, or the domain rejected the action. Distinct from
   *  `failure` (the ad itself never delivered) and from `success` (which must
   *  only ever mean the reward actually landed). */
  | "unapplied";

/** How long an outcome (success/failure/cancelled) stays visible before it
 *  settles back to idle. */
export const REWARD_OUTCOME_MS = 1400;
export const REWARD_OUTCOME_REDUCED_MS = 700;

/** Map a rewarded-ad result to its presentation phase, given whether the
 *  reward's own effect actually applied.
 *
 *  `applied` matters because an earned ad is not the same thing as a granted
 *  reward: the run may already have used that reward, or the domain may reject
 *  the action outright. Reporting "success" off the ad result alone would tell
 *  the player they got something they did not get.
 *
 *  `unavailable` and `error` are both failures to the player: the reward did
 *  not happen and it wasn't their doing. `closed` is a deliberate dismissal, so
 *  it reads as cancelled rather than as something going wrong. */
export function phaseForResult(result: RewardedResult, applied = true): RewardActionPhase {
  if (result === "earned") {
    return applied ? "success" : "unapplied";
  }
  if (result === "closed") {
    return "cancelled";
  }
  return "failure";
}
