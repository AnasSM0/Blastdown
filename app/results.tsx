import { useCallback, useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { BackHandler } from "react-native";

import { ResultsView } from "../src/components/ResultsScreen";
import { useAudio } from "../src/hooks/useAudio";
import { useEffectiveReducedMotion } from "../src/hooks/useEffectiveReducedMotion";
import { useHaptics } from "../src/hooks/useHaptics";
import { useRewardOutcome } from "../src/hooks/useRewardOutcome";
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
  const {
    controller,
    startNewRun,
    clearActiveRun,
    settleCurrentRun,
    doubleBoltsForCurrentRun,
    isCurrentRunDoubled,
  } = useGameSession();
  const { profile } = useProfile();
  const { track } = useAnalytics();
  const reward = useRewardedAction();
  const audio = useAudio();
  const haptics = useHaptics();
  const reducedMotion = useEffectiveReducedMotion();
  // Same transient success / cancelled / failure feedback the in-run rewards
  // use, so Double Bolts is never the one silent reward surface.
  const outcome = useRewardOutcome(reducedMotion);
  // Sourced from the session's own once-per-run guard rather than local state:
  // a local flag resets when Results remounts (Back, or Home and in again),
  // which would re-offer a reward that can no longer be applied and cost the
  // player an ad view for nothing.
  const doubled = isCurrentRunDoubled;
  const state = controller.state;
  const boltsEarned = computeBoltsEarned(state);
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

  const handleDoubleBolts = useCallback(() => {
    // Single-flight and once-per-run are enforced below and in the session;
    // this guard just avoids a needless ad request.
    if (reward.pending || doubled) {
      return;
    }
    audio.playSfx("button");
    track({ name: "double_bolts_offer" });
    outcome.begin();
    // Whether the reward's own effect actually landed. An earned ad is not the
    // same thing as a granted reward: the session applies the doubling exactly
    // once per run, so a second earn banks nothing — and must not be reported
    // as a success.
    let applied = false;
    void reward
      .run(REWARD_PLACEMENTS.doubleBolts, () => {
        if (doubleBoltsForCurrentRun()) {
          applied = true;
          haptics.success();
        }
      })
      .then((result) => {
        track({ name: "double_bolts_result", result: rewardOutcome(result) });
        outcome.settle(result, applied);
      });
  }, [audio, doubled, doubleBoltsForCurrentRun, haptics, outcome, reward, track]);

  const handlePlayAgain = useCallback(() => {
    if (routeTransitionRef.current) {
      return;
    }
    routeTransitionRef.current = true;
    startNewRun();
    router.replace("/game");
  }, [router, startNewRun]);

  const handleHome = useCallback(() => {
    if (routeTransitionRef.current) {
      return;
    }
    routeTransitionRef.current = true;
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
        boltsEarned={boltsEarned}
        doubleBolts={{
          amount: boltsEarned,
          onPress: handleDoubleBolts,
          pending: reward.pending,
          applied: doubled,
          phase: outcome.phase,
        }}
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
      />
      <StatusBar style="light" />
    </>
  );
}
