import type { RewardedPlacement } from "./types";

/** Named, typed reward placements — the four the run/results lifecycle uses.
 *  Screens reference these instead of the raw string ids so a rename is a
 *  compile error, not a silent miss. `repair_blast` stays out (post-MVP). */
export const REWARD_PLACEMENTS = {
  freeze: "rewarded_freeze",
  defuse: "rewarded_defuse",
  revive: "rewarded_revive",
  doubleBolts: "rewarded_double_bolts",
} as const satisfies Record<string, RewardedPlacement>;

export type RewardPlacementKey = keyof typeof REWARD_PLACEMENTS;
