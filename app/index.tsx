import { useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { HomeScreenView } from "../src/components/HomeScreen";
import { useGameSession } from "../src/state/GameSessionProvider";
import { useProfile } from "../src/state/ProfileProvider";

export default function HomeScreen() {
  const router = useRouter();
  const { canContinue, startNewRun } = useGameSession();
  const { profile } = useProfile();

  const handlePlay = useCallback(() => {
    startNewRun();
    router.push("/game");
  }, [router, startNewRun]);

  const handleContinue = useCallback(() => {
    router.push("/game");
  }, [router]);

  return (
    <>
      <HomeScreenView
        bestScore={profile.bestScore}
        bolts={profile.bolts}
        canContinue={canContinue}
        onPlay={handlePlay}
        onContinue={handleContinue}
        onThemes={() => router.push("/themes")}
        onSettings={() => router.push("/settings")}
        onHowToPlay={() => router.push("/tutorial")}
        onPrivacy={() => {}}
      />
      <StatusBar style="light" />
    </>
  );
}
