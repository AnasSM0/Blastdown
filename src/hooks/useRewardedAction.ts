import { useCallback, useEffect, useRef, useState } from "react";

import { useAdService } from "../services/ads/AdServiceProvider";
import type { RewardedPlacement, RewardedResult } from "../services/ads/types";
import { reportCaught } from "../services/diagnostics/reportError";

export type RewardedAction = {
  /** Show the rewarded ad for `placement`. On `earned` — and only then —
   *  `onEarned` runs exactly once. Returns the result so callers can branch
   *  their UI (retry on `error`, hide on `unavailable`, etc.). While a request
   *  is in flight a second call is ignored and resolves to `"error"` so the
   *  caller treats the duplicate as a no-op. */
  run: (placement: RewardedPlacement, onEarned: () => void) => Promise<RewardedResult>;
  /** True while an ad request is outstanding — screens lock conflicting input
   *  on this so a reward can't be requested twice or overlap a placement. */
  pending: boolean;
};

/** Wraps the injected `AdService` with the state-safety the run lifecycle
 *  needs: a single-flight guard (no overlapping or duplicate requests), and a
 *  once-only success callback that never fires on cancel/failure/unavailable.
 *  It applies no game rules — `onEarned` calls the pure domain API. */
export function useRewardedAction(): RewardedAction {
  const adService = useAdService();
  const [pending, setPending] = useState(false);
  // The single-flight gate. A ref (not `pending`) so back-to-back synchronous
  // calls in the same tick still see the guard before React re-renders.
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (placement: RewardedPlacement, onEarned: () => void): Promise<RewardedResult> => {
      if (inFlightRef.current) {
        return "error";
      }
      inFlightRef.current = true;
      setPending(true);
      let result: RewardedResult = "error";
      try {
        result = await adService.showRewarded(placement);
        // Only a genuine earn mutates, and only if we're still mounted so a
        // reward that resolves after navigation can't touch a dead tree.
        if (result === "earned" && mountedRef.current) {
          onEarned();
        }
      } catch (error) {
        // Ad SDK failure: treated as "error" (no reward), reported for
        // diagnostics. The placement id is a safe enumerated value.
        reportCaught("reward", error, { placement });
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setPending(false);
        }
      }
      return result;
    },
    [adService],
  );

  return { run, pending };
}
