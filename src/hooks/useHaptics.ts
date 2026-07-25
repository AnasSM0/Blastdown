import { useMemo } from "react";
import * as Haptics from "expo-haptics";

import { useSettings } from "../state/SettingsProvider";

/** Gameplay haptic vocabulary, wired at the UI layer only (BUILD_SPEC.md
 *  §6.5/§6.11). Components call these instead of expo-haptics directly, so the
 *  trigger points stay in one place and honor the persisted haptics setting.
 *  All calls are best-effort: on platforms without a haptics engine, or when
 *  haptics are disabled, they simply no-op instead of throwing. */
export type GameHaptics = {
  /** Light tick when a piece is selected or picked up for drag. */
  selection: () => void;
  /** Success cue on a valid placement. */
  success: () => void;
  /** Warning cue on a rejected placement. */
  warning: () => void;
  /** Restrained urgent cue as a timer crosses a countdown-2 / countdown-1
   *  threshold. Called once per transition by useTimerHaptics. */
  timerUrgent: () => void;
  /** The heavier impact of a timer reaching zero and leaving rubble. Fired at
   *  most once per turn by useTimerHaptics, however many pieces expired, so a
   *  multi-expiry turn is one impact rather than a burst. */
  expiry: () => void;
};

function runSafely(action: () => Promise<unknown> | void): void {
  try {
    const result = action();
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // Haptics are non-essential feedback; never let them break gameplay.
  }
}

export function useHaptics(): GameHaptics {
  const { settings } = useSettings();
  const enabled = settings.hapticsEnabled;

  return useMemo<GameHaptics>(() => {
    const gate = (action: () => Promise<unknown> | void) => () => {
      if (enabled) {
        runSafely(action);
      }
    };
    return {
      selection: gate(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      success: gate(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: gate(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
      timerUrgent: gate(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      expiry: gate(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
    };
  }, [enabled]);
}
