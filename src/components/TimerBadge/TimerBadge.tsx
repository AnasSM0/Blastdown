import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { colors, neonGlow } from "../../ui/theme";
import { pieceColor } from "../../ui/pieceColors";
import { getTimerVisualState } from "../../ui/timerStates";
import { getPulseConfig } from "../../ui/timerPulse";
import { useReducedMotion } from "../../hooks/useReducedMotion";

type TimerBadgeProps = {
  pieceId: string;
  remainingTurns: number;
  colorId: string;
};

const BADGE_SIZE = 24;

export function TimerBadge({ pieceId, remainingTurns, colorId }: TimerBadgeProps) {
  const visualState = getTimerVisualState(remainingTurns);
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const pulse = getPulseConfig(visualState, reducedMotion);
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
  }, [visualState, reducedMotion, scale]);

  const accentColor =
    visualState === "urgent"
      ? colors.urgentRed
      : visualState === "warning" || visualState === "caution"
        ? colors.amberBlock
        : pieceColor(colorId);
  const glow =
    visualState === "urgent" || visualState === "warning"
      ? neonGlow(accentColor, "high")
      : neonGlow(accentColor, "low");

  return (
    <Animated.View
      style={[styles.badge, { borderColor: accentColor, transform: [{ scale }] }, glow]}
      testID={`timer-badge-${pieceId}`}
      accessibilityLabel={`${remainingTurns} moves left`}
      accessibilityHint={`Timer state: ${visualState}`}
      accessible
    >
      <Text style={[styles.digit, { color: accentColor }]}>{remainingTurns}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 1,
    backgroundColor: colors.appBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
