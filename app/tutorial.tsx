import { useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { TutorialView } from "../src/components/Tutorial";
import { useProfile } from "../src/state/ProfileProvider";

/** Tutorial route. Completion (finish or explicit skip) is the only thing that
 *  persists `tutorialCompleted`; merely opening or replaying it never does.
 *  The view uses its own isolated controller, so it never touches the saved
 *  active run. */
export default function TutorialScreen() {
  const router = useRouter();
  const { updateProfile } = useProfile();

  const finish = useCallback(() => {
    updateProfile((profile) =>
      profile.tutorialCompleted ? profile : { ...profile, tutorialCompleted: true },
    );
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router, updateProfile]);

  return (
    <>
      <TutorialView onComplete={finish} onSkip={finish} />
      <StatusBar style="light" />
    </>
  );
}
