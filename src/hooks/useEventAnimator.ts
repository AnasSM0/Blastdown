import { useCallback, useEffect, useRef, useState } from "react";

import type { GameEvent } from "../domain/events";
import type { GridCell } from "../domain/gameTypes";
import type { CellPosition } from "../domain/placement";
import {
  buildCuePlan,
  buildEffectPlan,
  type EffectCueKind,
  type EffectPlan,
} from "../ui/effects/eventEffects";

type Grid = readonly (readonly GridCell[])[];

type UseEventAnimatorArgs = {
  /** The domain turn counter — increments once per applied placement. */
  turn: number;
  /** Events emitted by the placement that produced the current `turn`. */
  events: readonly GameEvent[];
  /** The current authoritative grid. The hook keeps the previous turn's grid so
   *  a defused piece's footprint can be resolved (the event carries only an id). */
  grid: Grid;
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
  /** Play an out-of-turn cue (rewarded defuse / revive). Those actions don't
   *  advance the turn counter, so they can't come from the event stream; the
   *  caller supplies the cells it read from authoritative state before applying
   *  the action. Never locks input, and is ignored while a required sequence is
   *  playing so it can't cut one short. */
  playCue: (kind: EffectCueKind, cells: readonly CellPosition[]) => void;
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
  grid,
  reducedMotion,
}: UseEventAnimatorArgs): EventAnimator {
  const [isAnimating, setIsAnimating] = useState(false);
  const [plan, setPlan] = useState<EffectPlan | null>(null);
  const [effectKey, setEffectKey] = useState(0);

  const lastTurnRef = useRef(turn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `isAnimating` for synchronous reads (a cue fired in the same tick
  // as a placement must see the lock before React re-renders).
  const animatingRef = useRef(false);
  // Latest events/grid, read inside the turn-triggered effect without making
  // that effect depend on array identity. Written in an effect (not during
  // render) and declared before the turn effect so it is current when that runs.
  const eventsRef = useRef(events);
  const reducedRef = useRef(reducedMotion);
  const latestGridRef = useRef(grid);
  // The grid as it stood BEFORE the turn being animated. Advanced only inside
  // the turn effect, after that turn's plan is built, so it always trails
  // `latestGridRef` by exactly one turn even though both are written per render.
  const preTurnGridRef = useRef(grid);
  useEffect(() => {
    eventsRef.current = events;
    reducedRef.current = reducedMotion;
    latestGridRef.current = grid;
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    animatingRef.current = false;
    setIsAnimating(false);
    setPlan(null);
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    lastTurnRef.current = 0;
    preTurnGridRef.current = latestGridRef.current;
    stop();
  }, [clearTimer, stop]);

  const playCue = useCallback(
    (kind: EffectCueKind, cells: readonly CellPosition[]) => {
      // A required turn sequence owns the overlay and the input lock; a cue must
      // never replace its plan or end it early.
      if (animatingRef.current || cells.length === 0) {
        return;
      }
      const cuePlan = buildCuePlan(kind, cells, reducedRef.current);
      clearTimer();
      setPlan(cuePlan);
      setEffectKey((key) => key + 1);
      // Deliberately no input lock: the board has already been defused/restored
      // and must stay usable while the cue plays.
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setPlan(null);
      }, cuePlan.durationMs);
    },
    [clearTimer],
  );

  useEffect(() => {
    // Only a forward turn is a new placement; a reset to 0 (restart) clears.
    if (turn <= lastTurnRef.current) {
      lastTurnRef.current = turn;
      preTurnGridRef.current = latestGridRef.current;
      return;
    }
    lastTurnRef.current = turn;

    const nextPlan = buildEffectPlan(eventsRef.current, reducedRef.current, {
      previousGrid: preTurnGridRef.current,
    });
    preTurnGridRef.current = latestGridRef.current;

    if (!nextPlan.hasRequiredSequence) {
      // A plain placement: nothing to hold input for. Any cue still on screen is
      // dropped so a stale overlay can't outlive the move that superseded it.
      clearTimer();
      stop();
      return;
    }

    clearTimer();
    setPlan(nextPlan);
    setEffectKey((key) => key + 1);
    animatingRef.current = true;
    setIsAnimating(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      stop();
    }, nextPlan.durationMs);
  }, [turn, clearTimer, stop]);

  // Cancel any pending sequence on unmount.
  useEffect(() => clearTimer, [clearTimer]);

  return { isAnimating, plan, effectKey, playCue, reset };
}
