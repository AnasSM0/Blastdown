import { useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { SettingsView } from "../src/components/SettingsScreen";
import { isDevelopmentBuild } from "../src/config/environment";
import { useAnalytics } from "../src/services/analytics";
import { useSettings } from "../src/state/SettingsProvider";
import { resolveTheme } from "../src/ui/themes";
import type { PersistedSettings } from "../src/services/storage/schemas";

/** Settings route: persisted toggles wired to the SettingsProvider, plus
 *  navigation to Themes and tutorial replay. */
export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();
  const { track } = useAnalytics();

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
        // Undefined outside a development build, so the row is absent rather
        // than present and inert. The route itself renders nothing there too —
        // see `app/dev-effects.tsx`.
        onEffectHarness={isDevelopmentBuild() ? () => router.push("/dev-effects") : undefined}
        onBack={handleBack}
      />
      <StatusBar style="light" />
    </>
  );
}
