import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { useGameController, type GameController } from "../hooks/useGameController";

export type GameSession = {
  /** The single app-lifetime controller shared by Home and the game screen. */
  controller: GameController;
  /** True once the player has started a run this app session (drives whether
   *  Home offers "Continue"). Persistence across cold starts is Phase 5. */
  hasActiveRun: boolean;
  /** True when a started run is still in progress (not game over). */
  canContinue: boolean;
  /** Begin a fresh seeded run and mark the session active. */
  startNewRun: () => void;
};

const GameSessionContext = createContext<GameSession | null>(null);

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const controller = useGameController();
  const [hasActiveRun, setHasActiveRun] = useState(false);

  const startNewRun = useCallback(() => {
    controller.restart();
    setHasActiveRun(true);
  }, [controller]);

  const value = useMemo<GameSession>(
    () => ({
      controller,
      hasActiveRun,
      canContinue: hasActiveRun && controller.state.status !== "gameOver",
      startNewRun,
    }),
    [controller, hasActiveRun, startNewRun],
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
