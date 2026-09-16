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

export type RewardedActionOptions = {
  /** Optional critical persistence boundary. The game session supplies an
   * active-run flush so native ad UI never opens ahead of the latest snapshot. */
  beforeShow?: () => Promise<void>;
  /** Restore lifecycle resources after native rewarded UI resolves or throws. */
  afterShow?: () => void;
};

/** Wraps the injected `AdService` with the state-safety the run lifecycle
 *  needs: a single-flight guard (no overlapping or duplicate requests), and a
 *  once-only success callback that never fires on cancel/failure/unavailable.
 *  It applies no game rules — `onEarned` calls the pure domain API. */
export function useRewardedAction(options: RewardedActionOptions = {}): RewardedAction {
  const adService = useAdService();
  const { afterShow, beforeShow } = options;
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
      let restored = false;
      const restoreAfterShow = () => {
        if (restored) return;
        restored = true;
        try {
          afterShow?.();
        } catch (error) {
          reportCaught("reward", error, { placement, phase: "after_show" });
        }
      };
      try {
        await beforeShow?.();
        result = await adService.showRewarded(placement);
        // The native overlay has closed. Restore feedback before applying an
        // earned reward so its semantic success cue is not dropped by the
        // interruption gate.
        restoreAfterShow();
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
        restoreAfterShow();
        inFlightRef.current = false;
        if (mountedRef.current) {
          setPending(false);
        }
      }
      return result;
    },
    [adService, afterShow, beforeShow],
  );

  return { run, pending };
}
