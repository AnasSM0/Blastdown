import { useCallback, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { ThemeScreenView } from "../src/components/ThemeScreen";
import { isUnlocked, purchaseTheme } from "../src/economy/themeOwnership";
import { useProfile } from "../src/state/ProfileProvider";
import { useSettings } from "../src/state/SettingsProvider";
import { THEMES } from "../src/ui/themes";

/** Themes route: owned themes select immediately (persist themeId); locked
 *  themes open a Bolt purchase confirmation. Purchase deducts Bolts and unlocks
 *  atomically via the pure ownership service applied through a functional
 *  profile update, so a duplicate confirm can never double-charge. All economy
 *  rules live in src/economy — this screen only orchestrates. */
export default function ThemesScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();
  const { profile, updateProfile } = useProfile();
  const [pendingThemeId, setPendingThemeId] = useState<string | null>(null);

  const handleSelect = useCallback(
    (themeId: string) => {
      if (isUnlocked(profile.unlockedThemeIds, themeId)) {
        updateSettings({ themeId });
      } else {
        setPendingThemeId(themeId);
      }
    },
    [profile.unlockedThemeIds, updateSettings],
  );

  const handleConfirmPurchase = useCallback(
    (themeId: string) => {
      // Decide from the current profile; bail without mutation if unaffordable.
      const preview = purchaseTheme(profile, themeId);
      if (!preview.ok) {
        return;
      }
      // Apply through a functional update so a repeated confirm sees the theme
      // already owned (no double deduction), then select it immediately.
      updateProfile((current) => purchaseTheme(current, themeId).profile);
      updateSettings({ themeId });
      setPendingThemeId(null);
    },
    [profile, updateProfile, updateSettings],
  );

  const handleCancelPurchase = useCallback(() => setPendingThemeId(null), []);

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
        unlockedThemeIds={profile.unlockedThemeIds}
        bolts={profile.bolts}
        pendingThemeId={pendingThemeId}
        onSelect={handleSelect}
        onConfirmPurchase={handleConfirmPurchase}
        onCancelPurchase={handleCancelPurchase}
        onBack={handleBack}
      />
      <StatusBar style="light" />
    </>
  );
}
