import { useCallback, useMemo, useRef, useState } from "react";

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
import { getPlacementPreview, type PlacementPreview } from "../domain/selectors";

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

export type GameController = {
  state: GameState;
  selectedHandId: string | null;
  lastEvents: GameEvent[];
  selectPiece: (handId: string) => void;
  clearSelection: () => void;
  previewAt: (origin: CellPosition) => PlacementPreview | null;
  placeAt: (origin: CellPosition) => boolean;
  /** Preview an explicit hand piece at an origin, independent of tap
   *  selection — used by the drag interaction while a finger is down. */
  previewFor: (handId: string, origin: CellPosition) => PlacementPreview | null;
  /** Place an explicit hand piece, independent of tap selection. Returns
   *  false (without mutating state) if the piece is gone or the move is
   *  invalid, which also makes a duplicated gesture-end a no-op. */
  place: (handId: string, origin: CellPosition) => boolean;
  /** Apply the rewarded freeze via the domain. Returns false (no mutation) if
   *  the domain rejects it (already active, cap reached, not playing). Callers
   *  must only invoke this after a reward is earned. */
  activateFreeze: () => boolean;
  /** Apply the rewarded defuse to the domain-selected lowest-timer piece. */
  defuse: () => boolean;
  /** Apply the one-per-run rewarded revive from the game-over state. */
  revive: () => boolean;
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

  const selectPiece = useCallback((handId: string) => {
    setSelectedHandId((current) => (current === handId ? null : handId));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedHandId(null);
  }, []);

  const selectedShapeId = useMemo(() => {
    if (selectedHandId === null) {
      return null;
    }
    return state.hand.find((piece) => piece.handId === selectedHandId)?.shapeId ?? null;
  }, [selectedHandId, state.hand]);

  const previewAt = useCallback(
    (origin: CellPosition): PlacementPreview | null => {
      if (selectedShapeId === null) {
        return null;
      }
      return getPlacementPreview(state, selectedShapeId, origin);
    },
    [selectedShapeId, state],
  );

  const placeAt = useCallback(
    (origin: CellPosition): boolean => {
      if (selectedHandId === null) {
        return false;
      }
      const result = placePiece(state, selectedHandId, origin, nowRef.current());
      if (!result.ok) {
        return false;
      }
      setState(result.state);
      setLastEvents(result.events);
      setSelectedHandId(null);
      return true;
    },
    [selectedHandId, state],
  );

  const previewFor = useCallback(
    (handId: string, origin: CellPosition): PlacementPreview | null => {
      const shapeId = state.hand.find((piece) => piece.handId === handId)?.shapeId ?? null;
      if (shapeId === null) {
        return null;
      }
      return getPlacementPreview(state, shapeId, origin);
    },
    [state],
  );

  const place = useCallback(
    (handId: string, origin: CellPosition): boolean => {
      const result = placePiece(state, handId, origin, nowRef.current());
      if (!result.ok) {
        return false;
      }
      setState(result.state);
      setLastEvents(result.events);
      setSelectedHandId(null);
      return true;
    },
    [state],
  );

  const applyTurn = useCallback(
    (run: (state: GameState, now: number) => ReturnType<typeof placePiece>): boolean => {
      const result = run(state, nowRef.current());
      if (!result.ok) {
        return false;
      }
      setState(result.state);
      setLastEvents(result.events);
      setSelectedHandId(null);
      return true;
    },
    [state],
  );

  const activateFreeze = useCallback(() => applyTurn(domainActivateFreeze), [applyTurn]);

  const defuse = useCallback(() => applyTurn(domainApplyRewardedDefuse), [applyTurn]);

  const revive = useCallback(() => applyTurn(domainApplyRevive), [applyTurn]);

  const restart = useCallback(() => {
    setState(createInitialGameState(nextSeedRef.current(), nowRef.current()));
    setSelectedHandId(null);
    setLastEvents([]);
  }, []);

  return {
    state,
    selectedHandId,
    lastEvents,
    selectPiece,
    clearSelection,
    previewAt,
    placeAt,
    previewFor,
    place,
    activateFreeze,
    defuse,
    revive,
    restart,
  };
}
