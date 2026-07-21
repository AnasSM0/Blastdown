import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { ResultsView } from "../src/components/ResultsScreen";
import { useRewardedAction } from "../src/hooks/useRewardedAction";
import { REWARD_PLACEMENTS } from "../src/services/ads";
import { rewardOutcome, useAnalytics } from "../src/services/analytics";
import { computeBoltsEarned } from "../src/services/profile/settlement";
import { useProfile } from "../src/state/ProfileProvider";
import { useGameSession } from "../src/state/GameSessionProvider";

/** End-of-run results route. Settles the finished run into the profile exactly
 *  once (best score, Bolts, cumulative stats), then shows the run's stats plus
 *  the settled best score and Bolts earned. Offers a mock "double Bolts"
 *  rewarded action that banks the run's Bolts a second time — applied at most
 *  once per run (session guard + single-flight ad request). */
export default function ResultsScreen() {
  const router = useRouter();
  const { controller, startNewRun, settleCurrentRun, doubleBoltsForCurrentRun } = useGameSession();
  const { profile } = useProfile();
  const { track } = useAnalytics();
  const reward = useRewardedAction();
  const [doubled, setDoubled] = useState(false);
  const state = controller.state;
  const boltsEarned = computeBoltsEarned(state);

  // Settle on mount. The session guards against a second settlement (remount /
  // Back), so this is safe to call unconditionally. results_view is logged once
  // here too (guarded by the same ref) so a remount can't re-log it.
  const settledRef = useRef(false);
  useEffect(() => {
    if (!settledRef.current) {
      settledRef.current = true;
      settleCurrentRun();
      track({ name: "results_view" });
    }
  }, [settleCurrentRun, track]);

  const handleDoubleBolts = useCallback(() => {
    // Single-flight and once-per-run are enforced below and in the session;
    // this guard just avoids a needless ad request.
    if (reward.pending || doubled) {
      return;
    }
    track({ name: "double_bolts_offer" });
    void reward
      .run(REWARD_PLACEMENTS.doubleBolts, () => {
        // The session applies the doubling exactly once per run; reflect it in
        // the button state only when it actually applied.
        if (doubleBoltsForCurrentRun()) {
          setDoubled(true);
        }
      })
      .then((result) => track({ name: "double_bolts_result", result: rewardOutcome(result) }));
  }, [doubled, doubleBoltsForCurrentRun, reward, track]);

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
        boltsEarned={boltsEarned}
        doubleBolts={{
          amount: boltsEarned,
          onPress: handleDoubleBolts,
          pending: reward.pending,
          applied: doubled,
        }}
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
      />
      <StatusBar style="light" />
    </>
  );
}
