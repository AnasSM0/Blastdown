import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";

import type { DangerState, DangerTone } from "../../ui/dangerState";
import { radius } from "../../ui/theme";
import { glowFor, type ThemePalette } from "../../ui/themes";
import { useTheme } from "../../ui/ThemeProvider";

type Props = {
  danger: DangerState;
  reducedMotion: boolean;
  testID?: string;
};

export type DangerLightingVisual = {
  color: string;
  opacity: number;
  borderWidth: number;
};

function toneColor(tone: DangerTone, theme: ThemePalette): string {
  switch (tone) {
    case "critical":
      return theme.timerCritical;
    case "warning":
    case "warm":
      return theme.timerWarning;
    case "cool":
      return theme.timerNormal;
    case "neutral":
      return theme.boardFrameCorner;
    case "default":
    default:
      return theme.boardFrame;
  }
}

/** Static part of the shared renderer treatment, exported for parity and
 * Reduced Motion tests. Border weight supplies a non-color urgency channel. */
export function dangerLightingVisual(
  danger: DangerState,
  theme: ThemePalette,
): DangerLightingVisual {
  const borderWidth = danger.level === "critical" ? 3 : danger.level === "warning" ? 2 : 1;
  return {
    color: toneColor(danger.tone, theme),
    opacity: danger.intensity,
    borderWidth,
  };
}

/** One board-level pulse shared by every tile. It is mounted by both board
 * renderers and never intercepts touches or creates per-cell animation work. */
export function BoardDangerLighting({ danger, reducedMotion, testID }: Props) {
  const theme = useTheme();
  const visual = dangerLightingVisual(danger, theme);
  const [opacity] = useState(() => new Animated.Value(visual.opacity));

  useEffect(() => {
    opacity.stopAnimation();
    opacity.setValue(visual.opacity);
    if (reducedMotion || danger.pulseDurationMs === null || visual.opacity === 0) {
      return;
    }
    const halfCycleMs = danger.pulseDurationMs / 2;
    opacity.setValue(visual.opacity * 0.55);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: visual.opacity,
          duration: halfCycleMs,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: visual.opacity * 0.55,
          duration: halfCycleMs,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [danger.pulseDurationMs, opacity, reducedMotion, visual.opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID ?? `board-danger-${danger.level}`}
      style={[
        styles.rim,
        {
          borderColor: visual.color,
          borderWidth: visual.borderWidth,
          opacity: reducedMotion ? visual.opacity : opacity,
        },
        glowFor(theme, visual.color, danger.level === "critical" ? "high" : "low"),
      ]}
    />
  );
}

const styles = StyleSheet.create({
  rim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.board,
    zIndex: 4,
  },
});
