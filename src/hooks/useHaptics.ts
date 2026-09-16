import { useCallback, useMemo } from "react";
import * as Haptics from "expo-haptics";

import type { HapticPattern } from "../services/feedback";
import { useSettings } from "../state/SettingsProvider";

function runSafely(action: () => Promise<unknown> | void): void {
  try {
    const result = action();
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // Haptics are optional feedback; never let the native provider affect play.
  }
}

/** The only expo-haptics boundary. One semantic pattern maps to exactly one
 * native call, and the persisted setting gates it synchronously. */
export function useHaptics(): { play: (pattern: HapticPattern) => void } {
  const { settings, loaded } = useSettings();
  const enabled = loaded && settings.hapticsEnabled;

  const play = useCallback(
    (pattern: HapticPattern) => {
      if (!enabled || pattern === "none") return;
      const actions: Record<Exclude<HapticPattern, "none">, () => Promise<void>> = {
        selection: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        lightImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        mediumImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        heavyImpact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
        warningLight: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
        warningStrong: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
        success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        successStrong: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
        explosion: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
        terminal: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      };
      runSafely(actions[pattern]);
    },
    [enabled],
  );

  return useMemo(() => ({ play }), [play]);
}
