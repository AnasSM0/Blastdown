import { useCallback, useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { BackHandler } from "react-native";

import { ResultsView } from "../src/components/ResultsScreen";
import { useEffectiveReducedMotion } from "../src/hooks/useEffectiveReducedMotion";
import { useAnalytics } from "../src/services/analytics";
import { recordPlaytestAction } from "../src/services/playtest/signal";
import { useProfile } from "../src/state/ProfileProvider";
import { useGameSession } from "../src/state/GameSessionProvider";

/** End-of-run results route. Settles the finished run exactly once, clears the
 *  resumable snapshot, and exposes only canonical Play Again and Home exits. */
export default function ResultsScreen() {
  const router = useRouter();
  const { controller, startNewRun, clearActiveRun, settleCurrentRun } = useGameSession();
  const { profile } = useProfile();
  const { track } = useAnalytics();
  const reducedMotion = useEffectiveReducedMotion();
  const state = controller.state;
  const routeTransitionRef = useRef(false);

  // Settle on mount. The session guards against a second settlement (remount /
  // Back), so this is safe to call unconditionally. results_view is logged once
  // here too (guarded by the same ref) so a remount can't re-log it.
  const settledRef = useRef(false);
  useEffect(() => {
    if (!settledRef.current) {
      settledRef.current = true;
      clearActiveRun();
      settleCurrentRun();
      track({ name: "results_view" });
    }
  }, [clearActiveRun, settleCurrentRun, track]);

  const handlePlayAgain = useCallback(() => {
    if (routeTransitionRef.current) {
      return;
    }
    routeTransitionRef.current = true;
    recordPlaytestAction("play_again");
    startNewRun();
    router.replace("/game");
  }, [router, startNewRun]);

  const handleHome = useCallback(() => {
    if (routeTransitionRef.current) {
      return;
    }
    routeTransitionRef.current = true;
    recordPlaytestAction("results_home");
    router.replace("/");
  }, [router]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleHome();
      return true;
    });
    return () => subscription.remove();
  }, [handleHome]);

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
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
        reducedMotion={reducedMotion}
      />
      <StatusBar style="light" />
    </>
  );
}
