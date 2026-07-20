import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

import { useGameController, type GameController } from "../hooks/useGameController";
import { useGamePersistence } from "../hooks/useGamePersistence";
import { computeBoltsEarned, runId, settleRun } from "../services/profile/settlement";
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
};

const GameSessionContext = createContext<GameSession | null>(null);

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const controller = useGameController();
  const { hydrated, hasActiveRun, canContinue, startNewRun, clearActiveRun } =
    useGamePersistence(controller);
  const { updateProfile } = useProfile();

  // App-lifetime guard so a run settles once even if Results remounts or Back
  // re-enters it. A new run has a new id and settles on its own.
  const settledRunIdRef = useRef<string | null>(null);

  const settleCurrentRun = useCallback((): number => {
    const state = controller.state;
    const id = runId(state);
    const boltsEarned = computeBoltsEarned(state);
    if (settledRunIdRef.current === id) {
      return boltsEarned;
    }
    settledRunIdRef.current = id;
    updateProfile((profile) => settleRun(profile, state, Date.now()).profile);
    return boltsEarned;
  }, [controller, updateProfile]);

  const value = useMemo<GameSession>(
    () => ({
      controller,
      hydrated,
      hasActiveRun,
      canContinue,
      startNewRun,
      clearActiveRun,
      settleCurrentRun,
    }),
    [
      controller,
      hydrated,
      hasActiveRun,
      canContinue,
      startNewRun,
      clearActiveRun,
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
