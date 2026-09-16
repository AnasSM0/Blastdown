import { useCallback, useRef, useState } from "react";

import type { GameState } from "../domain/gameTypes";
import type { GameEvent } from "../domain/events";
import type { CellPosition } from "../domain/placement";
import {
  activateFreeze as domainActivateFreeze,
  applyRevive as domainApplyRevive,
  applyRewardedDefuse as domainApplyRewardedDefuse,
  createInitialGameState,
  placePiece,
} from "../domain/game";
import { getPlacementPrediction, type PlacementPreview } from "../domain/selectors";

export type GameControllerOptions = {
  /** Seed for the first run. Later restarts derive a fresh seed via `nextSeed`. */
  seed?: string;
  /** Clock, injectable for tests. */
  now?: () => number;
  /** Seed factory for restarts, injectable for tests. */
  nextSeed?: () => string;
  /** Test seam: start from a crafted GameState instead of a fresh run. */
  initialState?: GameState;
};

/** Immutable identity captured when a drag begins. A hand id alone is not
 * enough: refill and restart can reuse the same slot-shaped id. The generation
 * rejects a previous run, while the revision rejects a move that was prepared
 * against an older authoritative state in the same run. */
export type PlacementIntent = Readonly<{
  sessionGeneration: number;
  stateRevision: number;
  handId: string;
}>;

export type GameController = {
  state: GameState;
  /** Monotonic run identity used by presentation to invalidate stale motion. */
  sessionGeneration: number;
  selectedHandId: string | null;
  lastEvents: GameEvent[];
  selectPiece: (handId: string) => void;
  clearSelection: () => void;
  previewAt: (origin: CellPosition) => PlacementPreview | null;
  placeAt: (origin: CellPosition) => boolean;
  /** Preview an explicit hand piece at an origin, independent of tap
   *  selection — used by the drag interaction while a finger is down. */
  previewFor: (intent: PlacementIntent | string, origin: CellPosition) => PlacementPreview | null;
  /** Capture the exact run/state/piece identity a gesture will later commit. */
  createPlacementIntent: (handId: string) => PlacementIntent | null;
  /** Place an explicit hand piece, independent of tap selection. Returns
   *  false (without mutating state) if the intent is stale, the piece is gone,
   *  or the move is invalid. Passing a hand id is retained for immediate
   *  non-gesture callers; gestures must pass their captured intent. */
  place: (intent: PlacementIntent | string, origin: CellPosition) => boolean;
  /** Apply the rewarded freeze via the domain. Returns false (no mutation) if
   *  the domain rejects it (already active, cap reached, not playing). Callers
   *  must only invoke this after a reward is earned. */
  activateFreeze: () => boolean;
  /** Apply the rewarded defuse to the domain-selected lowest-timer piece. */
  defuse: () => boolean;
  /** @deprecated Dormant compatibility seam; V1 has no Revive production flow. */
  revive: () => boolean;
  /** Replace the current run with a restored GameState (persistence rehydrate).
   *  Clears selection and events; does not emit any domain events. */
  hydrate: (state: GameState) => void;
  restart: () => void;
};

function defaultSeed(): string {
  return `run-${Date.now()}`;
}

/** UI-facing controller around the pure domain engine. Holds no gameplay
 *  rules — every decision is delegated to src/domain/. */
export function useGameController(options: GameControllerOptions = {}): GameController {
  const nowRef = useRef(options.now ?? Date.now);
  const nextSeedRef = useRef(options.nextSeed ?? defaultSeed);

  const [state, setState] = useState<GameState>(
    () =>
      options.initialState ??
      createInitialGameState(
        options.seed ?? (options.nextSeed ?? defaultSeed)(),
        (options.now ?? Date.now)(),
      ),
  );
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [sessionGeneration, setSessionGeneration] = useState(0);

  // React state is the render snapshot. These refs are the synchronous
  // authoritative snapshot used by imperative event handlers in the interval
  // before React commits a rerender. Updating them before setState closes the
  // duplicate-call window without adding a timer or delaying the next action.
  const stateRef = useRef(state);
  const selectedHandIdRef = useRef<string | null>(null);
  const sessionGenerationRef = useRef(0);
  const stateRevisionRef = useRef(0);
  const transactionRef = useRef(false);

  const clearSelection = useCallback(() => {
    selectedHandIdRef.current = null;
    setSelectedHandId(null);
  }, []);

  const selectPiece = useCallback((handId: string) => {
    const currentState = stateRef.current;
    if (
      currentState.status !== "playing" ||
      !currentState.hand.some((piece) => piece.handId === handId)
    ) {
      return;
    }
    const next = selectedHandIdRef.current === handId ? null : handId;
    selectedHandIdRef.current = next;
    setSelectedHandId(next);
  }, []);

  const commit = useCallback((nextState: GameState, events: GameEvent[]) => {
    stateRef.current = nextState;
    stateRevisionRef.current += 1;
    selectedHandIdRef.current = null;
    setState(nextState);
    setLastEvents(events);
    setSelectedHandId(null);
  }, []);

  const createPlacementIntent = useCallback((handId: string): PlacementIntent | null => {
    const currentState = stateRef.current;
    if (
      currentState.status !== "playing" ||
      !currentState.hand.some((piece) => piece.handId === handId)
    ) {
      return null;
    }
    return {
      sessionGeneration: sessionGenerationRef.current,
      stateRevision: stateRevisionRef.current,
      handId,
    };
  }, []);

  const commitPlacement = useCallback(
    (intent: PlacementIntent, origin: CellPosition): boolean => {
      if (
        transactionRef.current ||
        intent.sessionGeneration !== sessionGenerationRef.current ||
        intent.stateRevision !== stateRevisionRef.current
      ) {
        return false;
      }

      const currentState = stateRef.current;
      if (!currentState.hand.some((piece) => piece.handId === intent.handId)) {
        return false;
      }

      transactionRef.current = true;
      try {
        const result = placePiece(currentState, intent.handId, origin, nowRef.current());
        if (!result.ok) {
          return false;
        }
        commit(result.state, result.events);
        return true;
      } finally {
        // The pure domain transaction is synchronous. Release immediately after
        // its authoritative commit; the next legitimate placement need not wait
        // for a render, animation, or debounce window.
        transactionRef.current = false;
      }
    },
    [commit],
  );

  const previewAt = useCallback((origin: CellPosition): PlacementPreview | null => {
    const handId = selectedHandIdRef.current;
    if (handId === null) {
      return null;
    }
    return getPlacementPrediction(stateRef.current, handId, origin);
  }, []);

  const placeAt = useCallback(
    (origin: CellPosition): boolean => {
      const handId = selectedHandIdRef.current;
      if (handId === null) {
        return false;
      }
      const intent = createPlacementIntent(handId);
      return intent === null ? false : commitPlacement(intent, origin);
    },
    [commitPlacement, createPlacementIntent],
  );

  const previewFor = useCallback(
    (intentOrHandId: PlacementIntent | string, origin: CellPosition): PlacementPreview | null => {
      if (
        typeof intentOrHandId !== "string" &&
        (intentOrHandId.sessionGeneration !== sessionGenerationRef.current ||
          intentOrHandId.stateRevision !== stateRevisionRef.current)
      ) {
        return null;
      }
      const handId = typeof intentOrHandId === "string" ? intentOrHandId : intentOrHandId.handId;
      return getPlacementPrediction(stateRef.current, handId, origin);
    },
    [],
  );

  const place = useCallback(
    (intentOrHandId: PlacementIntent | string, origin: CellPosition): boolean => {
      const intent =
        typeof intentOrHandId === "string" ? createPlacementIntent(intentOrHandId) : intentOrHandId;
      return intent === null ? false : commitPlacement(intent, origin);
    },
    [commitPlacement, createPlacementIntent],
  );

  const applyTurn = useCallback(
    (run: (state: GameState, now: number) => ReturnType<typeof placePiece>): boolean => {
      if (transactionRef.current) {
        return false;
      }
      transactionRef.current = true;
      try {
        const result = run(stateRef.current, nowRef.current());
        if (!result.ok) {
          return false;
        }
        commit(result.state, result.events);
        return true;
      } finally {
        transactionRef.current = false;
      }
    },
    [commit],
  );

  const activateFreeze = useCallback(() => applyTurn(domainActivateFreeze), [applyTurn]);

  const defuse = useCallback(() => applyTurn(domainApplyRewardedDefuse), [applyTurn]);

  const revive = useCallback(() => applyTurn(domainApplyRevive), [applyTurn]);

  const hydrate = useCallback((restored: GameState) => {
    stateRef.current = restored;
    stateRevisionRef.current += 1;
    selectedHandIdRef.current = null;
    setState(restored);
    setSelectedHandId(null);
    setLastEvents([]);
  }, []);

  const restart = useCallback(() => {
    const nextState = createInitialGameState(nextSeedRef.current(), nowRef.current());
    sessionGenerationRef.current += 1;
    setSessionGeneration(sessionGenerationRef.current);
    stateRevisionRef.current = 0;
    stateRef.current = nextState;
    selectedHandIdRef.current = null;
    setState(nextState);
    setSelectedHandId(null);
    setLastEvents([]);
  }, []);

  return {
    state,
    sessionGeneration,
    selectedHandId,
    lastEvents,
    selectPiece,
    clearSelection,
    previewAt,
    placeAt,
    previewFor,
    createPlacementIntent,
    place,
    activateFreeze,
    defuse,
    revive,
    hydrate,
    restart,
  };
}
