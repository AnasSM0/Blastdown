import { useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { ThemeScreenView } from "../src/components/ThemeScreen";
import { useSettings } from "../src/state/SettingsProvider";
import { THEMES } from "../src/ui/themes";

/** Themes route: selecting a theme persists `themeId` and applies immediately
 *  across every themed surface (via ThemeProvider reading the same setting). */
export default function ThemesScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();

  const handleSelect = useCallback(
    (themeId: string) => updateSettings({ themeId }),
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
      <ThemeScreenView
        themes={THEMES}
        selectedThemeId={settings.themeId}
        onSelect={handleSelect}
        onBack={handleBack}
      />
      <StatusBar style="light" />
    </>
  );
}
