import { useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { HomeScreenView } from "../src/components/HomeScreen";
import { useGameSession } from "../src/state/GameSessionProvider";

export default function HomeScreen() {
  const router = useRouter();
  const { canContinue, startNewRun } = useGameSession();

  const handlePlay = useCallback(() => {
    startNewRun();
    router.push("/game");
  }, [router, startNewRun]);

  const handleContinue = useCallback(() => {
    router.push("/game");
  }, [router]);

  return (
    <>
      {/* Best score and Bolts are persisted in Phase 5; stubbed at 0 until
          StorageService lands (docs/TASKS.md 3.1). */}
      <HomeScreenView
        bestScore={0}
        bolts={0}
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
