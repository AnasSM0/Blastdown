import { StyleSheet, Text, View } from "react-native";

import { colors, neonGlow } from "../../ui/theme";
import { pieceColor } from "../../ui/pieceColors";
import { getTimerVisualState } from "../../ui/timerStates";

type TimerBadgeProps = {
  pieceId: string;
  remainingTurns: number;
  colorId: string;
};

const BADGE_SIZE = 24;

export function TimerBadge({ pieceId, remainingTurns, colorId }: TimerBadgeProps) {
  const visualState = getTimerVisualState(remainingTurns);
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
    <View
      style={[styles.badge, { borderColor: accentColor }, glow]}
      testID={`timer-badge-${pieceId}`}
      accessibilityLabel={`${remainingTurns} moves left`}
      accessibilityHint={`Timer state: ${visualState}`}
      accessible
    >
      <Text style={[styles.digit, { color: accentColor }]}>{remainingTurns}</Text>
    </View>
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
