import { BOLTS_SCORE_DIVISOR } from "../../config/balance";
import type { GameState } from "../../domain/gameTypes";
import type { PersistedProfile } from "../storage/schemas";

/** Bolts earned by a finished run (BUILD_SPEC.md §8.1):
 *  floor(score / 250) + successfully defused pieces. Pure — safe to call for
 *  display without settling. */
export function computeBoltsEarned(state: GameState): number {
  return Math.floor(state.score / BOLTS_SCORE_DIVISOR) + state.piecesDefused;
}

export type SettlementResult = {
  profile: PersistedProfile;
  boltsEarned: number;
};

/** Fold a finished run into the profile: bank Bolts, raise best score/combo,
 *  accumulate lifetime stats, and count the run. Pure and total — the caller
 *  guarantees each run is settled exactly once (idempotency lives in the hook,
 *  not here). Reads the finished GameState; profile/Bolts never live on it. */
export function settleRun(
  profile: PersistedProfile,
  state: GameState,
  now: number,
): SettlementResult {
  const boltsEarned = computeBoltsEarned(state);
  const nextProfile: PersistedProfile = {
    ...profile,
    bestScore: Math.max(profile.bestScore, state.score),
    bestCombo: Math.max(profile.bestCombo, state.bestCombo),
    bolts: profile.bolts + boltsEarned,
    totalRuns: profile.totalRuns + 1,
    piecesPlaced: profile.piecesPlaced + state.piecesPlaced,
    linesCleared: profile.linesCleared + state.linesCleared,
    piecesDefused: profile.piecesDefused + state.piecesDefused,
    explosions: profile.explosions + state.explosions,
    rubbleCleared: profile.rubbleCleared + state.rubbleCleared,
    revivesUsed: profile.revivesUsed + (state.reviveUsed ? 1 : 0),
    updatedAt: now,
  };
  return { profile: nextProfile, boltsEarned };
}

/** Stable identity for a run, so settlement can run exactly once even across
 *  remounts and repeated callbacks. Seed + start time uniquely name a run. */
export function runId(state: GameState): string {
  return `${state.seed}:${state.startedAt}`;
}
