import { useCallback, useMemo, useRef, useState } from "react";

import type { GameState } from "../domain/gameTypes";
import type { GameEvent } from "../domain/events";
import type { CellPosition } from "../domain/placement";
import { createInitialGameState, placePiece } from "../domain/game";
import { getPlacementPreview, type PlacementPreview } from "../domain/selectors";

export type GameControllerOptions = {
  /** Seed for the first run. Later restarts derive a fresh seed via `nextSeed`. */
  seed?: string;
  /** Clock, injectable for tests. */
  now?: () => number;
  /** Seed factory for restarts, injectable for tests. */
  nextSeed?: () => string;
};

export type GameController = {
  state: GameState;
  selectedHandId: string | null;
  lastEvents: GameEvent[];
  selectPiece: (handId: string) => void;
  clearSelection: () => void;
  previewAt: (origin: CellPosition) => PlacementPreview | null;
  placeAt: (origin: CellPosition) => boolean;
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

  const [state, setState] = useState<GameState>(() =>
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
    restart,
  };
}
