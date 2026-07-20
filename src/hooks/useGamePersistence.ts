import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { GameController } from "./useGameController";
import {
  createActiveRunPersister,
  loadActiveRun,
  type ActiveRunPersister,
} from "../services/storage/activeRunStorage";
import { useStorageService } from "../services/storage/StorageServiceProvider";

/** A run is resumable ("Continue") only while it is genuinely unfinished. */
function isUnfinished(status: string): boolean {
  return status === "playing";
}

export type GamePersistence = {
  /** True once the initial load has resolved (restored run or confirmed none).
   *  Guards the save effect so the fresh initial controller state never
   *  overwrites a saved run before it is read. */
  hydrated: boolean;
  /** True while a started run exists this session (drives Continue). */
  hasActiveRun: boolean;
  /** True only for a started, still-unfinished run. */
  canContinue: boolean;
  /** Begin a fresh run and mark the session active (replaces any saved run). */
  startNewRun: () => void;
  /** Clear the saved run and mark the session inactive (End Run / settlement). */
  clearActiveRun: () => void;
};

/** Wires a game controller to persistent active-run storage: restores a valid
 *  unfinished run on launch, saves after every state change once hydrated,
 *  clears on game over / End Run, and flushes on app background. All writes go
 *  through a serialized coalescing persister, so a stale async write can never
 *  overwrite a newer save. */
export function useGamePersistence(
  controller: GameController,
  options: { now?: () => number } = {},
): GamePersistence {
  const storage = useStorageService();
  const { state, hydrate, restart } = controller;

  const [hydrated, setHydrated] = useState(false);
  const [hasActiveRun, setHasActiveRun] = useState(false);

  // Lazily created once; storage identity is stable for the provider lifetime.
  const [persister] = useState<ActiveRunPersister>(() =>
    createActiveRunPersister(storage, options.now ?? Date.now),
  );

  // Latest state/active flag mirrored into refs (written in an effect, not
  // during render) so the AppState listener can flush the current run without
  // re-subscribing on every change.
  const stateRef = useRef(state);
  const activeRef = useRef(hasActiveRun);
  useEffect(() => {
    stateRef.current = state;
    activeRef.current = hasActiveRun;
  });

  // Restore once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadActiveRun(storage);
      if (cancelled) {
        return;
      }
      if (saved && isUnfinished(saved.state.status)) {
        hydrate(saved.state);
        setHasActiveRun(true);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // Storage/controller identity is stable for the provider's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every state change once hydrated and a run is active. An
  // unfinished run is saved; reaching game over clears it (settlement, which
  // also depends on game over, is layered on separately).
  useEffect(() => {
    if (!hydrated || !hasActiveRun) {
      return;
    }
    if (isUnfinished(state.status)) {
      void persister.save(state);
    } else {
      void persister.clear();
    }
  }, [hydrated, hasActiveRun, state, persister]);

  // Flush the current run when the app leaves the foreground.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if ((next === "background" || next === "inactive") && activeRef.current) {
        const current = stateRef.current;
        if (isUnfinished(current.status)) {
          void persister.save(current);
        }
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [persister]);

  const startNewRun = useCallback(() => {
    restart();
    setHasActiveRun(true);
  }, [restart]);

  const clearActiveRun = useCallback(() => {
    void persister.clear();
    setHasActiveRun(false);
  }, [persister]);

  const canContinue = hasActiveRun && isUnfinished(state.status);

  return { hydrated, hasActiveRun, canContinue, startNewRun, clearActiveRun };
}
