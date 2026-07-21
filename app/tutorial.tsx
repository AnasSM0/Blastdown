import { useCallback, useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { TutorialView } from "../src/components/Tutorial";
import { useAnalytics } from "../src/services/analytics";
import { useProfile } from "../src/state/ProfileProvider";

/** Tutorial route. Completion (finish or explicit skip) is the only thing that
 *  persists `tutorialCompleted`; merely opening or replaying it never does.
 *  The view uses its own isolated controller, so it never touches the saved
 *  active run. Emits tutorial_start on entry, tutorial_step on each advance,
 *  and tutorial_complete / tutorial_skip on exit. */
export default function TutorialScreen() {
  const router = useRouter();
  const { updateProfile } = useProfile();
  const { track } = useAnalytics();

  // Latest step viewed, so a skip logs which step it happened on.
  const currentStepRef = useRef(1);

  useEffect(() => {
    track({ name: "tutorial_start" });
  }, [track]);

  const persistCompletion = useCallback(() => {
    updateProfile((profile) =>
      profile.tutorialCompleted ? profile : { ...profile, tutorialCompleted: true },
    );
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router, updateProfile]);

  const handleComplete = useCallback(() => {
    track({ name: "tutorial_complete" });
    persistCompletion();
  }, [persistCompletion, track]);

  const handleSkip = useCallback(() => {
    track({ name: "tutorial_skip", step: currentStepRef.current });
    persistCompletion();
  }, [persistCompletion, track]);

  const handleStepChange = useCallback(
    (stepId: number) => {
      currentStepRef.current = stepId;
      track({ name: "tutorial_step", step: stepId });
    },
    [track],
  );

  return (
    <>
      <TutorialView
        onComplete={handleComplete}
        onSkip={handleSkip}
        onStepChange={handleStepChange}
      />
      <StatusBar style="light" />
    </>
  );
}
