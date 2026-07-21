import { useEffect, useRef } from "react";

import type { GameEvent } from "../domain/events";
import { useAnalytics } from "../services/analytics/AnalyticsServiceProvider";
import type { AnalyticsEvent } from "../services/analytics/types";

/** Turn-scoped gameplay events derived once per turn from the domain's own
 *  event stream — never inferred from board state. Mirrors `useGameAudio`'s
 *  dedup: each new turn is processed exactly once (keyed on the turn counter),
 *  so a remount or re-render can't re-log a placement. Selection and rejection
 *  are UI moments (no turn bump) and are logged imperatively by the screen, not
 *  here. Computes no gameplay. */
export function useGameAnalytics({
  turn,
  events,
}: {
  turn: number;
  events: readonly GameEvent[];
}): void {
  const { track } = useAnalytics();

  // Mirror latest events into a ref (written in an effect) so the turn effect
  // reads current data without re-subscribing per render.
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  });

  const lastTurnRef = useRef(turn);
  useEffect(() => {
    if (turn <= lastTurnRef.current) {
      lastTurnRef.current = turn;
      return;
    }
    lastTurnRef.current = turn;

    // Combo for this turn, read from whichever event carries it (so
    // piece_placed / line_clear are annotated with the resulting combo).
    let combo = 0;
    for (const event of eventsRef.current) {
      if (event.type === "comboChanged") {
        combo = event.combo;
      }
    }

    for (const event of eventsRef.current) {
      const analyticsEvent = toAnalyticsEvent(event, turn, combo);
      if (analyticsEvent) {
        track(analyticsEvent);
      }
    }
  }, [turn, track]);
}

/** Map a single domain event to its analytics event, or null if it carries no
 *  aggregate worth tracking (timers, score deltas, refills, freeze internals —
 *  those are noise or already summarized in run_end). */
function toAnalyticsEvent(event: GameEvent, turn: number, combo: number): AnalyticsEvent | null {
  switch (event.type) {
    case "piecePlaced":
      return { name: "piece_placed", turn, combo };
    case "linesCleared":
      return {
        name: "line_clear",
        lineCount: event.rows.length + event.columns.length,
        combo,
      };
    case "pieceDefused":
      return { name: "piece_defused", bonus: event.bonus };
    case "explosionStarted":
      return { name: "explosion" };
    case "rubbleCleared":
      return { name: "rubble_cleared", cellCount: event.cells.length };
    default:
      return null;
  }
}
