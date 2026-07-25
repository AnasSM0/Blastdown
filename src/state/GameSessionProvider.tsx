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
import { useGamePersistence } from "../hooks/useGamePersistence";
import { useAnalytics } from "../services/analytics/AnalyticsServiceProvider";
import {
  applyDoubleBolts,
  computeBoltsEarned,
  runId,
  settleRun,
} from "../services/profile/settlement";
import { useProfile } from "./ProfileProvider";

export type GameSession = {
  /** The single app-lifetime controller shared by Home and the game screen. */
  controller: GameController;
  /** True once persistence has restored (or confirmed no) saved run. */
  hydrated: boolean;
  /** True once the player has started a run this session. */
  hasActiveRun: boolean;
  /** True when a started run is still in progress (drives Continue). */
  canContinue: boolean;
  /** Begin a fresh seeded run and mark the session active. */
  startNewRun: () => void;
  /** Clear the saved run and mark the session inactive (End Run / settlement). */
  clearActiveRun: () => void;
  /** Settle the current finished run into the profile exactly once (best score,
   *  Bolts, cumulative stats). Idempotent per run across remount/Back/repeat
   *  calls. Returns the Bolts earned this run. */
  settleCurrentRun: () => number;
  /** Apply the mock "double Bolts" reward for the current run exactly once.
   *  Banks the run's Bolts a second time. Returns true if it applied, false if
   *  this run was already doubled (a duplicate can never double-charge). */
  doubleBoltsForCurrentRun: () => boolean;
  /** True once this run's Bolts have been doubled. Read-only view of the same
   *  once-per-run guard `doubleBoltsForCurrentRun` enforces — it grants nothing
   *  and changes no rule. Results needs it because its own local flag resets on
   *  remount, which would re-offer a reward that can no longer be applied and
   *  cost the player an ad view for nothing. */
  isCurrentRunDoubled: boolean;
};

const GameSessionContext = createContext<GameSession | null>(null);

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const controller = useGameController();
  const {
    hydrated,
    hasActiveRun,
    canContinue,
    startNewRun: startPersistedRun,
    clearActiveRun,
  } = useGamePersistence(controller);
  const { updateProfile } = useProfile();
  const { track } = useAnalytics();

  // App-lifetime guard so a run settles once even if Results remounts or Back
  // re-enters it. A new run has a new id and settles on its own.
  const settledRunIdRef = useRef<string | null>(null);
  // Separate once-per-run guard for the double-Bolts reward. The ref is the
  // synchronous gate (back-to-back calls in one tick must see it); the state
  // mirrors it so consumers can render from it without reading a ref in render.
  const doubledRunIdRef = useRef<string | null>(null);
  const [doubledRunId, setDoubledRunId] = useState<string | null>(null);

  // Begin a fresh run and log run_start once per start (Play / Play Again are
  // distinct, user-initiated starts, so each is its own event).
  const startNewRun = useCallback(() => {
    startPersistedRun();
    track({ name: "run_start" });
  }, [startPersistedRun, track]);

  const settleCurrentRun = useCallback((): number => {
    const state = controller.state;
    const id = runId(state);
    const boltsEarned = computeBoltsEarned(state);
    if (settledRunIdRef.current === id) {
      return boltsEarned;
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
      revived: state.reviveUsed,
      durationMs: Math.max(0, state.lastUpdatedAt - state.startedAt),
      boltsEarned,
    });
    return boltsEarned;
  }, [controller, track, updateProfile]);

  const doubleBoltsForCurrentRun = useCallback((): boolean => {
    const state = controller.state;
    const id = runId(state);
    if (doubledRunIdRef.current === id) {
      return false;
    }
    doubledRunIdRef.current = id;
    setDoubledRunId(id);
    updateProfile((profile) => applyDoubleBolts(profile, computeBoltsEarned(state)));
    return true;
  }, [controller, updateProfile]);

  // Derived, not stored: a new run has a new id, so the flag falls away with it
  // and never has to be cleared.
  const isCurrentRunDoubled = doubledRunId !== null && doubledRunId === runId(controller.state);

  const value = useMemo<GameSession>(
    () => ({
      controller,
      hydrated,
      hasActiveRun,
      canContinue,
      startNewRun,
      clearActiveRun,
      settleCurrentRun,
      doubleBoltsForCurrentRun,
      isCurrentRunDoubled,
    }),
    [
      controller,
      hydrated,
      hasActiveRun,
      canContinue,
      startNewRun,
      clearActiveRun,
      settleCurrentRun,
      doubleBoltsForCurrentRun,
      isCurrentRunDoubled,
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
