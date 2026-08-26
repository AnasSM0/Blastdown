import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { HomeScreenView } from "../src/components/HomeScreen";
import { RunConfirmationCard } from "../src/components/modals/RunConfirmationCard";
import { useEffectiveReducedMotion } from "../src/hooks/useEffectiveReducedMotion";
import { useGameSession } from "../src/state/GameSessionProvider";
import { useProfile } from "../src/state/ProfileProvider";

export default function HomeScreen() {
  const router = useRouter();
  const { hydrated, canContinue, startNewRun } = useGameSession();
  const { profile, loaded } = useProfile();
  const reducedMotion = useEffectiveReducedMotion();
  const [newGameConfirmation, setNewGameConfirmation] = useState<"closed" | "open">("closed");
  // Route replacement is asynchronous. This synchronous latch closes the gap
  // in which a second tap could start and persist a second session.
  const gameTransitionRef = useRef(false);

  // First run only: once the profile has loaded and shows the tutorial has
  // never been completed, send the player to it automatically. Guarded so it
  // fires once and never loops after completion returns here.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (loaded && !profile.tutorialCompleted && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace("/tutorial");
    }
  }, [loaded, profile.tutorialCompleted, router]);

  const openGame = useCallback(
    (mode: "new" | "continue") => {
      if (gameTransitionRef.current || !hydrated || (mode === "continue" && !canContinue)) {
        return;
      }
      gameTransitionRef.current = true;
      if (mode === "new") {
        startNewRun();
      }
      router.replace("/game");
    },
    [canContinue, hydrated, router, startNewRun],
  );

  const handlePlay = useCallback(() => {
    if (!hydrated || gameTransitionRef.current) {
      return;
    }
    if (canContinue) {
      setNewGameConfirmation("open");
      return;
    }
    openGame("new");
  }, [canContinue, hydrated, openGame]);

  const handleContinue = useCallback(() => {
    openGame("continue");
  }, [openGame]);

  const handleConfirmNewGame = useCallback(() => {
    if (gameTransitionRef.current) {
      return;
    }
    setNewGameConfirmation("closed");
    openGame("new");
  }, [openGame]);

  return (
    <>
      <HomeScreenView
        bestScore={profile.bestScore}
        bolts={profile.bolts}
        actionsEnabled={hydrated}
        canContinue={canContinue}
        onPlay={handlePlay}
        onContinue={handleContinue}
        onThemes={() => router.push("/themes")}
        onSettings={() => router.push("/settings")}
        onHowToPlay={() => router.push("/tutorial")}
        onPrivacy={() => {}}
        reducedMotion={reducedMotion}
      />
      {newGameConfirmation === "open" ? (
        <RunConfirmationCard
          kind="new-game"
          title="START A NEW GAME?"
          message="Your saved run will be replaced."
          confirmLabel="START NEW GAME"
          onConfirm={handleConfirmNewGame}
          onCancel={() => setNewGameConfirmation("closed")}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <StatusBar style="light" />
    </>
  );
}
