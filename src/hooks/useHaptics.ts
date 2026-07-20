import { useMemo } from "react";
import * as Haptics from "expo-haptics";

/** Gameplay haptic vocabulary, wired at the UI layer only (BUILD_SPEC.md
 *  §6.5/§6.11). Components call these instead of expo-haptics directly, so the
 *  trigger points stay in one place and can later respect a persisted haptics
 *  setting (Phase 5). All calls are best-effort: on platforms without a haptics
 *  engine they simply no-op instead of throwing. */
export type GameHaptics = {
  /** Light tick when a piece is selected or picked up for drag. */
  selection: () => void;
  /** Success cue on a valid placement. */
  success: () => void;
  /** Warning cue on a rejected placement. */
  warning: () => void;
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
  return useMemo<GameHaptics>(
    () => ({
      selection: () => runSafely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      success: () =>
        runSafely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: () =>
        runSafely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    }),
    [],
  );
}
