import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { GameController } from "./useGameController";
import { reportCaught } from "../services/diagnostics/reportError";
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

/** The persister reports an operation failure exactly once. React effects and
 *  event handlers still attach a rejection handler so a handled persistence
 *  failure never becomes an unhandled promise rejection. */
function ignoreReportedFailure(operation: Promise<void>): void {
  void operation.catch(() => {
    // createActiveRunPersister already reported this operation once.
  });
}

export type HydrationState = "pending" | "hydrated";

export type GamePersistence = {
  /** Explicit initial-read lifecycle. A failed read still settles to hydrated,
   *  meaning "the decision is complete", not "a saved run was found". */
  hydrationState: HydrationState;
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
  /** Await an authoritative save of the current run at a lifecycle boundary.
   * Storage failures are already reported and do not block the caller. */
  flushActiveRun: () => Promise<void>;
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

  const [hydrationState, setHydrationState] = useState<HydrationState>("pending");
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const hydrationResolvedRef = useRef(false);
  const hydrationGenerationRef = useRef(0);
  const hydrated = hydrationState === "hydrated";

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

  const completeHydration = useCallback(() => {
    if (hydrationResolvedRef.current) {
      return;
    }
    hydrationResolvedRef.current = true;
    setHydrationState("hydrated");
  }, []);

  // Restore once per hook lifecycle. The generation guard invalidates a late
  // callback after unmount or after a fresh run deliberately supersedes the
  // pending read.
  useEffect(() => {
    const generation = hydrationGenerationRef.current + 1;
    hydrationGenerationRef.current = generation;
    let mounted = true;
    const isCurrent = () =>
      mounted && hydrationGenerationRef.current === generation && !hydrationResolvedRef.current;

    void (async () => {
      try {
        const saved = await loadActiveRun(storage);
        if (!isCurrent()) {
          return;
        }
        if (saved && isUnfinished(saved.state.status)) {
          hydrate(saved.state);
          setHasActiveRun(true);
        } else if (saved) {
          // A structurally valid but completed/non-resumable run is stale
          // active-run data. Remove only that record and continue to Home.
          ignoreReportedFailure(persister.clear());
        }
      } catch (error) {
        if (isCurrent()) {
          reportCaught("persistence", error, { operation: "load_active_run" });
        }
      } finally {
        if (mounted && hydrationGenerationRef.current === generation) {
          completeHydration();
        }
      }
    })();

    return () => {
      mounted = false;
      hydrationGenerationRef.current += 1;
    };
  }, [completeHydration, hydrate, persister, storage]);

  // Persist on every state change once hydrated and a run is active. An
  // unfinished run is saved; reaching game over clears it (settlement, which
  // also depends on game over, is layered on separately).
  useEffect(() => {
    if (!hydrated || !hasActiveRun) {
      return;
    }
    if (isUnfinished(state.status)) {
      ignoreReportedFailure(persister.save(state));
    } else {
      ignoreReportedFailure(persister.clear());
    }
  }, [hydrated, hasActiveRun, state, persister]);

  // Flush the current run when the app leaves the foreground.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if ((next === "background" || next === "inactive") && activeRef.current) {
        const current = stateRef.current;
        if (isUnfinished(current.status)) {
          // AppState cannot keep Android alive, but this starts an explicit
          // authoritative flush and observes its failure. Device process-kill
          // durability still requires physical QA.
          ignoreReportedFailure(persister.save(current).then(() => persister.flush()));
        }
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [persister]);

  const startNewRun = useCallback(() => {
    if (!hydrationResolvedRef.current) {
      // A programmatic/stale Home action is allowed to choose New Run
      // deterministically. It completes the decision and invalidates the
      // pending read so that saved state can never overwrite the fresh run.
      hydrationGenerationRef.current += 1;
      completeHydration();
    }
    restart();
    setHasActiveRun(true);
  }, [completeHydration, restart]);

  const clearActiveRun = useCallback(() => {
    ignoreReportedFailure(persister.clear());
    setHasActiveRun(false);
  }, [persister]);

  const flushActiveRun = useCallback(async (): Promise<void> => {
    try {
      if (hasActiveRun && isUnfinished(state.status)) {
        // Enqueue the state from this committed render, then await the whole
        // drain. A newer operation queued before the drain finishes is included.
        await persister.save(state);
      } else {
        await persister.flush();
      }
    } catch {
      // The persister reports each failed operation exactly once. Lifecycle
      // callers must remain usable after the attempted durability boundary.
    }
  }, [hasActiveRun, persister, state]);

  const canContinue = hasActiveRun && isUnfinished(state.status);

  return {
    hydrationState,
    hydrated,
    hasActiveRun,
    canContinue,
    startNewRun,
    clearActiveRun,
    flushActiveRun,
  };
}
