import { useCallback, useEffect, useRef, useState } from "react";

import type { RewardedResult } from "../services/ads/types";
import {
  phaseForResult,
  REWARD_OUTCOME_MS,
  REWARD_OUTCOME_REDUCED_MS,
  type RewardActionPhase,
} from "../ui/effects/rewardPhase";
import { useFeedback } from "./useFeedback";

export type RewardOutcome = {
  /** Current transient phase for this action's control. */
  phase: RewardActionPhase;
  /** Enter the pending state — call when the ad request goes out. */
  begin: () => void;
  /** Record the resolved result: sets the outcome phase, plays the shared
   *  non-success feedback, and schedules the return to idle. Safe to call after
   *  unmount (it becomes a no-op).
   *
   *  `applied` must say whether the reward's own effect actually landed — an
   *  earned ad is not the same thing as a granted reward (the run may already
   *  have used it, or the domain may reject the action). Pass the result of the
   *  guarded mutation, never `true` by assumption. */
  settle: (result: RewardedResult, applied?: boolean) => void;
  /** Drop any outcome and pending timer (restart / leaving the screen). */
  reset: () => void;
};

/** One rewarded action's transient outcome feedback, shared by the V1 Freeze
 *  and Defuse surfaces.
 *
 *  Success feedback stays with the caller — only it knows which cue the earned
 *  reward deserves — but the *non-success* outcomes are handled here so no
 *  surface can quietly omit them: a failed or unavailable ad gets one warning
 *  haptic and the `invalid` cue, and a player-dismissed ad stays silent (they
 *  chose it; a failure noise would misreport their own action).
 *
 *  Feedback fires exactly once per settle, from the resolution of a single
 *  in-flight request, so a replayed effect or a remounted screen cannot
 *  duplicate it. It applies no game rules and grants nothing. */
export function useRewardOutcome(reducedMotion = false): RewardOutcome {
  const feedback = useFeedback();
  const [phase, setPhase] = useState<RewardActionPhase>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    if (mountedRef.current) {
      setPhase("idle");
    }
  }, [clearTimer]);

  const begin = useCallback(() => {
    clearTimer();
    if (mountedRef.current) {
      setPhase("pending");
    }
  }, [clearTimer]);

  const settle = useCallback(
    (result: RewardedResult, applied = true) => {
      // A request that resolves after the screen is gone must not touch state
      // or fire feedback into a dead tree.
      if (!mountedRef.current) {
        return;
      }
      const next = phaseForResult(result, applied);
      // Both non-success outcomes that aren't the player's own doing get the
      // same restrained warning. An earned-but-unapplied reward counts: the
      // player watched an ad and got nothing, which they must not learn from a
      // success cue.
      if (next === "failure" || next === "unapplied") {
        feedback.emit("rewardFailure");
      }
      clearTimer();
      setPhase(next);
      timerRef.current = setTimeout(
        () => {
          timerRef.current = null;
          if (mountedRef.current) {
            setPhase("idle");
          }
        },
        reducedMotion ? REWARD_OUTCOME_REDUCED_MS : REWARD_OUTCOME_MS,
      );
    },
    [clearTimer, feedback, reducedMotion],
  );

  return { phase, begin, settle, reset };
}
