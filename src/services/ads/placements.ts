import type { RewardedPlacement } from "./types";

/** Named, typed reward placements for the complete V1 catalog. */
export const REWARD_PLACEMENTS = {
  freeze: "rewarded_freeze",
  defuse: "rewarded_defuse",
} as const satisfies Record<string, RewardedPlacement>;

export type RewardPlacementKey = keyof typeof REWARD_PLACEMENTS;
