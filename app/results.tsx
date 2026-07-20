import { useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { ResultsView } from "../src/components/ResultsScreen";
import { useGameSession } from "../src/state/GameSessionProvider";

/** End-of-run results route. Reads the finished run's stats from the shared
 *  session controller and offers Play Again (fresh run) or Home. */
export default function ResultsScreen() {
  const router = useRouter();
  const { controller, startNewRun } = useGameSession();
  const state = controller.state;

  const handlePlayAgain = useCallback(() => {
    startNewRun();
    router.replace("/game");
  }, [router, startNewRun]);

  const handleHome = useCallback(() => {
    router.replace("/");
  }, [router]);

  return (
    <>
      <ResultsView
        stats={{
          score: state.score,
          bestCombo: state.bestCombo,
          linesCleared: state.linesCleared,
          piecesPlaced: state.piecesPlaced,
          piecesDefused: state.piecesDefused,
          explosions: state.explosions,
          rubbleCleared: state.rubbleCleared,
        }}
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
      />
      <StatusBar style="light" />
    </>
  );
}
