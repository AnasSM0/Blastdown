import { useCallback, useEffect, useRef, useState } from "react";

import type { GameEvent } from "../domain/events";
import { buildEffectPlan, type EffectPlan } from "../ui/effects/eventEffects";

type UseEventAnimatorArgs = {
  /** The domain turn counter — increments once per applied placement. */
  turn: number;
  /** Events emitted by the placement that produced the current `turn`. */
  events: readonly GameEvent[];
  reducedMotion: boolean;
};

export type EventAnimator = {
  /** True while a required visual sequence (clear/defuse/explosion) plays;
   *  the screen locks input on this so rapid taps can't stack turns. */
  isAnimating: boolean;
  /** The plan for the sequence currently playing, or null when idle. */
  plan: EffectPlan | null;
  /** Increments each time a new sequence starts, so overlays remount cleanly
   *  instead of interpolating between two different turns' effects. */
  effectKey: number;
  /** Cancel any playing sequence and return to idle (restart/navigation). */
  reset: () => void;
};

/** Drives visual effects from the domain's own event stream. It never computes
 *  gameplay — it consumes `placePiece` output and schedules a purely cosmetic
 *  sequence, holding an input lock for its duration. Domain state stays
 *  authoritative and is applied by the controller independently of this hook. */
export function useEventAnimator({
  turn,
  events,
  reducedMotion,
}: UseEventAnimatorArgs): EventAnimator {
  const [isAnimating, setIsAnimating] = useState(false);
  const [plan, setPlan] = useState<EffectPlan | null>(null);
  const [effectKey, setEffectKey] = useState(0);

  const lastTurnRef = useRef(turn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest events, read inside the turn-triggered effect without making that
  // effect depend on array identity. Written in an effect (not during render)
  // and declared before the turn effect so it is current when that runs.
  const eventsRef = useRef(events);
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    eventsRef.current = events;
    reducedRef.current = reducedMotion;
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    lastTurnRef.current = 0;
    setIsAnimating(false);
    setPlan(null);
  }, [clearTimer]);

  useEffect(() => {
    // Only a forward turn is a new placement; a reset to 0 (restart) clears.
    if (turn <= lastTurnRef.current) {
      lastTurnRef.current = turn;
      return;
    }
    lastTurnRef.current = turn;

    const nextPlan = buildEffectPlan(eventsRef.current, reducedRef.current);
    if (!nextPlan.hasRequiredSequence) {
      // A plain placement: nothing to hold input for.
      setIsAnimating(false);
      setPlan(null);
      return;
    }

    clearTimer();
    setPlan(nextPlan);
    setEffectKey((key) => key + 1);
    setIsAnimating(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsAnimating(false);
      setPlan(null);
    }, nextPlan.durationMs);
  }, [turn, clearTimer]);

  // Cancel any pending sequence on unmount.
  useEffect(() => clearTimer, [clearTimer]);

  return { isAnimating, plan, effectKey, reset };
}
