import { useCallback, useEffect, useRef, useState } from "react";

import type { GameEvent } from "../domain/events";
import {
  admitPraise,
  completePraise,
  createPraiseState,
  resetPraiseSession,
  resolvePraiseForTurn,
  type PraiseResult,
} from "../ui/praise";

type Args = { turn: number; events: readonly GameEvent[] };

export type PraiseCelebration = {
  current: PraiseResult | null;
  sessionId: number;
  complete: (id: string) => void;
  reset: () => void;
};

/** One-slot, generation-safe presentation controller for committed turn praise. */
export function usePraiseCelebration({ turn, events }: Args): PraiseCelebration {
  const [state, setState] = useState(() => createPraiseState());
  const lastTurnRef = useRef(turn);

  useEffect(() => {
    if (turn < lastTurnRef.current) {
      lastTurnRef.current = turn;
      setState(resetPraiseSession);
      return;
    }
    if (turn === lastTurnRef.current) {
      return;
    }
    lastTurnRef.current = turn;
    setState((current) =>
      admitPraise(current, resolvePraiseForTurn(events, { sessionId: current.sessionId, turn })),
    );
  }, [events, turn]);

  const complete = useCallback((id: string) => {
    setState((current) => completePraise(current, id));
  }, []);

  const reset = useCallback(() => {
    lastTurnRef.current = 0;
    setState(resetPraiseSession);
  }, []);

  return { current: state.active, sessionId: state.sessionId, complete, reset };
}
