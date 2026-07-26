import { useCallback, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { SettingsView } from "../src/components/SettingsScreen";
import { useAnalytics } from "../src/services/analytics";
import { isPrivacyOptionsRequired, useOptionalConsent } from "../src/services/consent";
import { useSettings } from "../src/state/SettingsProvider";
import { resolveTheme } from "../src/ui/themes";
import type { PersistedSettings } from "../src/services/storage/schemas";

/** Settings route: persisted toggles wired to the SettingsProvider, plus
 *  navigation to Themes and tutorial replay. Also the app's privacy options
 *  entry point, shown only when UMP reports that one is required. */
export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();
  const { track } = useAnalytics();
  // Optional: the route also renders in trees without a consent provider (tests,
  // and any build where the lifecycle is not mounted). No provider means no
  // privacy entry point, which is the correct default — the row appears only on
  // UMP's say-so.
  const consent = useOptionalConsent();
  const [privacyOptionsPending, setPrivacyOptionsPending] = useState(false);

  const handleToggle = useCallback(
    (key: "soundEnabled" | "musicEnabled" | "hapticsEnabled" | "reducedMotion", value: boolean) => {
      const patch: Partial<PersistedSettings> =
        key === "reducedMotion" ? { reducedMotionOverride: value } : { [key]: value };
      updateSettings(patch);
      // Setting name is an enumerated key; value is coerced to 0/1 — no free text.
      track({ name: "settings_changed", setting: key, value: value ? 1 : 0 });
    },
    [track, updateSettings],
  );

  const handlePrivacyOptions = useCallback(() => {
    if (!consent || privacyOptionsPending) {
      return;
    }
    setPrivacyOptionsPending(true);
    // The form is presented natively; the pending flag only stops a second press
    // queueing a second form. A failure is reported and reflected in the consent
    // state — the row stays available so the user can try again.
    void consent.openPrivacyOptions().finally(() => setPrivacyOptionsPending(false));
  }, [consent, privacyOptionsPending]);

  const resetConsent = consent?.resetConsent ?? null;
  const handleResetConsent = useCallback(() => {
    void resetConsent?.();
  }, [resetConsent]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <>
      <SettingsView
        settings={settings}
        themeName={resolveTheme(settings.themeId).name}
        onToggle={handleToggle}
        onThemes={() => router.push("/themes")}
        onReplayTutorial={() => router.push("/tutorial")}
        onBack={handleBack}
        privacyOptionsVisible={consent ? isPrivacyOptionsRequired(consent.state) : false}
        onPrivacyOptions={handlePrivacyOptions}
        privacyOptionsPending={privacyOptionsPending}
        // Already null outside a development build — the controller decides.
        onResetConsent={resetConsent ? handleResetConsent : null}
      />
      <StatusBar style="light" />
    </>
  );
}
