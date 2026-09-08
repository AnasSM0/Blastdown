import { BOLTS_SCORE_DIVISOR } from "../../config/balance";
import type { GameState } from "../../domain/gameTypes";
import type { PersistedProfile } from "../storage/schemas";

/** @deprecated Dormant post-V1 economy helper; production settlement ignores it.
 * Bolts earned by a finished run (historical BUILD_SPEC.md §8.1):
 *  floor(score / 250) + successfully defused pieces. Pure — safe to call for
 *  display without settling. */
export function computeBoltsEarned(state: GameState): number {
  return Math.floor(state.score / BOLTS_SCORE_DIVISOR) + state.piecesDefused;
}

export type SettlementResult = {
  profile: PersistedProfile;
};

/** Fold a finished run into the V1 profile statistics. Deprecated progression
 *  fields are preserved byte-for-byte for backward compatibility but are not
 *  earned, consumed, or required by current product behavior. */
export function settleRun(
  profile: PersistedProfile,
  state: GameState,
  now: number,
): SettlementResult {
  const nextProfile: PersistedProfile = {
    ...profile,
    bestScore: Math.max(profile.bestScore, state.score),
    bestCombo: Math.max(profile.bestCombo, state.bestCombo),
    totalRuns: profile.totalRuns + 1,
    piecesPlaced: profile.piecesPlaced + state.piecesPlaced,
    linesCleared: profile.linesCleared + state.linesCleared,
    piecesDefused: profile.piecesDefused + state.piecesDefused,
    explosions: profile.explosions + state.explosions,
    rubbleCleared: profile.rubbleCleared + state.rubbleCleared,
    updatedAt: now,
  };
  return { profile: nextProfile };
}

/** @deprecated Dormant post-V1 economy helper; no V1 session calls it.
 * Apply a mock "double Bolts" reward to a profile: bank the run's Bolts a
 *  second time (the base amount was already banked by `settleRun`). Pure and
 *  total; `boltsEarned` is clamped at 0 so it can never reduce a balance. The
 *  once-per-run guarantee (no repeated doubling) lives in the session, not
 *  here. */
export function applyDoubleBolts(profile: PersistedProfile, boltsEarned: number): PersistedProfile {
  return { ...profile, bolts: profile.bolts + Math.max(0, boltsEarned) };
}

/** Stable identity for a run, so settlement can run exactly once even across
 *  remounts and repeated callbacks. Seed + start time uniquely name a run. */
export function runId(state: GameState): string {
  return `${state.seed}:${state.startedAt}`;
}
