import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { useTheme } from "../../ui/ThemeProvider";
import { getTimerVisualState } from "../../ui/timerStates";
import { getPulseConfig } from "../../ui/timerPulse";
import { getBadgeVisual } from "../../ui/timerBadgeStyle";
import { useReducedMotion } from "../../hooks/useReducedMotion";

type TimerBadgeProps = {
  pieceId: string;
  remainingTurns: number;
  colorId: string;
  /** True while the run's rewarded freeze is active — pauses the countdown and
   *  switches the badge to its icy, static frozen cue. */
  frozen?: boolean;
};

export function TimerBadge({ pieceId, remainingTurns, frozen = false }: TimerBadgeProps) {
  const theme = useTheme();
  const visualState = getTimerVisualState(remainingTurns);
  const badge = getBadgeVisual(visualState, frozen, theme);
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  // Pulse keys on the resolved pulse state (a primitive), so ordinary rerenders
  // never restart the loop — only a genuine state change or a reduced-motion
  // toggle does. Frozen and calm states resolve to a static (null) pulse.
  useEffect(() => {
    const pulse = getPulseConfig(badge.pulseState, reducedMotion);
    if (!pulse) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: pulse.scaleTo,
          duration: pulse.halfCycleMs,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: pulse.halfCycleMs,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
    };
  }, [badge.pulseState, reducedMotion, scale]);

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          width: badge.size,
          height: badge.size,
          borderRadius: badge.size / 2,
          backgroundColor: theme.appBackground,
          borderColor: badge.ringColor,
          borderWidth: badge.ringWidth,
          borderStyle: badge.dashed ? "dashed" : "solid",
          transform: [{ scale }],
        },
        badge.glow,
      ]}
      testID={`timer-badge-${pieceId}`}
      accessibilityLabel={`${remainingTurns} moves left${frozen ? ", frozen" : ""}`}
      accessibilityHint={`Timer state: ${frozen ? "frozen" : visualState}`}
      accessible
    >
      <Text style={[styles.digit, { color: badge.numeralColor }]}>{remainingTurns}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
