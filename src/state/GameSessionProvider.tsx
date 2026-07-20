import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useGameController, type GameController } from "../hooks/useGameController";
import { useGamePersistence } from "../hooks/useGamePersistence";

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
};

const GameSessionContext = createContext<GameSession | null>(null);

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const controller = useGameController();
  const { hydrated, hasActiveRun, canContinue, startNewRun, clearActiveRun } =
    useGamePersistence(controller);

  const value = useMemo<GameSession>(
    () => ({
      controller,
      hydrated,
      hasActiveRun,
      canContinue,
      startNewRun,
      clearActiveRun,
    }),
    [controller, hydrated, hasActiveRun, canContinue, startNewRun, clearActiveRun],
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
