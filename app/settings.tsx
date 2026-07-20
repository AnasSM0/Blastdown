import { useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { SettingsView } from "../src/components/SettingsScreen";
import { useSettings } from "../src/state/SettingsProvider";
import type { PersistedSettings } from "../src/services/storage/schemas";

/** Settings route: persisted toggles wired to the SettingsProvider. */
export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();

  const handleToggle = useCallback(
    (key: "soundEnabled" | "musicEnabled" | "hapticsEnabled" | "reducedMotion", value: boolean) => {
      const patch: Partial<PersistedSettings> =
        key === "reducedMotion" ? { reducedMotionOverride: value } : { [key]: value };
      updateSettings(patch);
    },
    [updateSettings],
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
      <SettingsView settings={settings} onToggle={handleToggle} onBack={handleBack} />
      <StatusBar style="light" />
    </>
  );
}
