import { useCallback, useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { HomeScreenView } from "../src/components/HomeScreen";
import { useEffectiveReducedMotion } from "../src/hooks/useEffectiveReducedMotion";
import { useGameSession } from "../src/state/GameSessionProvider";
import { useProfile } from "../src/state/ProfileProvider";

export default function HomeScreen() {
  const router = useRouter();
  const { hydrated, canContinue, startNewRun } = useGameSession();
  const { profile, loaded } = useProfile();
  const reducedMotion = useEffectiveReducedMotion();

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

  const handlePlay = useCallback(() => {
    if (!hydrated) {
      return;
    }
    startNewRun();
    router.push("/game");
  }, [hydrated, router, startNewRun]);

  const handleContinue = useCallback(() => {
    if (!hydrated || !canContinue) {
      return;
    }
    router.push("/game");
  }, [canContinue, hydrated, router]);

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
      <StatusBar style="light" />
    </>
  );
}
