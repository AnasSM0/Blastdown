import { useEffect, useRef } from "react";

import type { GameEvent } from "../domain/events";
import { useHaptics } from "./useHaptics";

const URGENT_REMAINING = new Set([1, 2]);

/** Fires a restrained urgent haptic as a timed piece crosses the countdown-2
 *  and countdown-1 thresholds, driven by the domain's `timerWarning` events —
 *  never inferred from board state. Each (piece, threshold) transition buzzes
 *  exactly once: processing is keyed on the turn counter (no per-render spam)
 *  and deduped per piece+threshold, and the dedupe set resets on restart.
 *  Honors the persisted haptics setting via useHaptics. */
export function useTimerHaptics({
  turn,
  events,
}: {
  turn: number;
  events: readonly GameEvent[];
}): void {
  const haptics = useHaptics();
  const eventsRef = useRef(events);
  const hapticsRef = useRef(haptics);
  useEffect(() => {
    eventsRef.current = events;
    hapticsRef.current = haptics;
  });

  const lastTurnRef = useRef(turn);
  const warnedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (turn <= lastTurnRef.current) {
      // A backward turn means a fresh run (restart) — forget prior warnings.
      if (turn < lastTurnRef.current) {
        warnedRef.current.clear();
      }
      lastTurnRef.current = turn;
      return;
    }
    lastTurnRef.current = turn;
    for (const event of eventsRef.current) {
      if (event.type === "timerWarning" && URGENT_REMAINING.has(event.remainingTurns)) {
        const key = `${event.pieceId}:${event.remainingTurns}`;
        if (!warnedRef.current.has(key)) {
          warnedRef.current.add(key);
          hapticsRef.current.timerUrgent();
        }
      }
    }
  }, [turn]);
}
