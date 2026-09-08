import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useGameController, type GameController } from "../hooks/useGameController";
import { useGamePersistence, type HydrationState } from "../hooks/useGamePersistence";
import { useAnalytics } from "../services/analytics/AnalyticsServiceProvider";
import { runId, settleRun } from "../services/profile/settlement";
import { useProfile } from "./ProfileProvider";

export type GameSession = {
  /** The single app-lifetime controller shared by Home and the game screen. */
  controller: GameController;
  /** Explicit active-run persistence decision lifecycle. */
  hydrationState: HydrationState;
  /** True once persistence has restored (or confirmed no) saved run. */
  hydrated: boolean;
  /** True once the player has started a run this session. */
  hasActiveRun: boolean;
  /** True when a started run is still in progress (drives Continue). */
  canContinue: boolean;
  /** Monotonic app-lifetime identity for transient UI isolation. Hydrating an
   * existing run preserves it; every deliberate fresh run increments it. */
  sessionGeneration: number;
  /** Begin a fresh seeded run and mark the session active. */
  startNewRun: () => void;
  /** Clear the saved run and mark the session inactive (End Run / settlement). */
  clearActiveRun: () => void;
  /** Await the newest authoritative active-run snapshot before a critical
   * lifecycle transition such as opening rewarded native UI. */
  flushActiveRun: () => Promise<void>;
  /** Settle the current finished run into the profile exactly once (best score
   *  and cumulative V1 stats). Idempotent across remount/Back/repeat calls. */
  settleCurrentRun: () => void;
};

const GameSessionContext = createContext<GameSession | null>(null);

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const controller = useGameController();
  const {
    hydrationState,
    hydrated,
    hasActiveRun,
    canContinue,
    startNewRun: startPersistedRun,
    clearActiveRun,
    flushActiveRun,
  } = useGamePersistence(controller);
  const { updateProfile } = useProfile();
  const { track } = useAnalytics();

  // App-lifetime guard so a run settles once even if Results remounts or Back
  // re-enters it. A new run has a new id and settles on its own.
  const settledRunIdRef = useRef<string | null>(null);
  const sessionGenerationRef = useRef(0);
  const [sessionGeneration, setSessionGeneration] = useState(0);

  // Begin a fresh run and log run_start once per start (Play / Play Again are
  // distinct, user-initiated starts, so each is its own event).
  const startNewRun = useCallback(() => {
    const nextGeneration = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = nextGeneration;
    setSessionGeneration(nextGeneration);
    startPersistedRun();
    track({ name: "run_start" });
  }, [startPersistedRun, track]);

  const settleCurrentRun = useCallback((): void => {
    const state = controller.state;
    const id = runId(state);
    if (settledRunIdRef.current === id) {
      return;
    }
    settledRunIdRef.current = id;
    updateProfile((profile) => settleRun(profile, state, Date.now()).profile);
    // run_end fires from the same once-per-run guard as settlement, so restart /
    // Back / remount can never double-log the terminal event.
    track({
      name: "run_end",
      score: state.score,
      turn: state.turn,
      bestCombo: state.bestCombo,
      linesCleared: state.linesCleared,
      piecesPlaced: state.piecesPlaced,
      piecesDefused: state.piecesDefused,
      explosions: state.explosions,
      rubbleCleared: state.rubbleCleared,
      durationMs: Math.max(0, state.lastUpdatedAt - state.startedAt),
    });
  }, [controller, track, updateProfile]);

  const value = useMemo<GameSession>(
    () => ({
      controller,
      hydrationState,
      hydrated,
      hasActiveRun,
      canContinue,
      sessionGeneration,
      startNewRun,
      clearActiveRun,
      flushActiveRun,
      settleCurrentRun,
    }),
    [
      controller,
      hydrationState,
      hydrated,
      hasActiveRun,
      canContinue,
      sessionGeneration,
      startNewRun,
      clearActiveRun,
      flushActiveRun,
      settleCurrentRun,
    ],
  );

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession(): GameSession {
  const session = useContext(GameSessionContext);
  if (!session) {
    throw new Error("useGameSession must be used within a GameSessionProvider");
  }
  return session;
}
