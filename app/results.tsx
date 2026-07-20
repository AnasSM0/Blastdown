import { useCallback, useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { ResultsView } from "../src/components/ResultsScreen";
import { computeBoltsEarned } from "../src/services/profile/settlement";
import { useProfile } from "../src/state/ProfileProvider";
import { useGameSession } from "../src/state/GameSessionProvider";

/** End-of-run results route. Settles the finished run into the profile exactly
 *  once (best score, Bolts, cumulative stats), then shows the run's stats plus
 *  the settled best score and Bolts earned. */
export default function ResultsScreen() {
  const router = useRouter();
  const { controller, startNewRun, settleCurrentRun } = useGameSession();
  const { profile } = useProfile();
  const state = controller.state;

  // Settle on mount. The session guards against a second settlement (remount /
  // Back), so this is safe to call unconditionally.
  const settledRef = useRef(false);
  useEffect(() => {
    if (!settledRef.current) {
      settledRef.current = true;
      settleCurrentRun();
    }
  }, [settleCurrentRun]);

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
        bestScore={profile.bestScore}
        boltsEarned={computeBoltsEarned(state)}
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
      />
      <StatusBar style="light" />
    </>
  );
}
