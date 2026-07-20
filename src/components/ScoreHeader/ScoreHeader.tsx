import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { glowFor } from "../../ui/themes";
import { ComboIndicator } from "../ComboIndicator";

type ScoreHeaderProps = {
  score: number;
  best: number;
  combo: number;
  onPause: () => void;
};

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function ScoreHeader({ score, best, combo, onPause }: ScoreHeaderProps) {
  const theme = useTheme();
  return (
    <View style={styles.row} testID="score-header">
      <View style={styles.side}>
        <Text style={typography.labelCaps}>BEST</Text>
        <Text
          style={typography.numericValue}
          accessibilityLabel={`Best score ${formatNumber(best)}`}
        >
          {formatNumber(best)}
        </Text>
      </View>

      <View style={styles.center}>
        <Text
          style={[
            typography.scoreMobile,
            { color: theme.score },
            glowFor(theme, theme.score, "low"),
          ]}
          accessibilityLabel={`Score ${formatNumber(score)}`}
          testID="score-value"
        >
          {formatNumber(score)}
        </Text>
        <ComboIndicator combo={combo} />
      </View>

      <View style={[styles.side, styles.sideRight]}>
        <Pressable
          onPress={onPause}
          style={styles.pauseButton}
          accessibilityRole="button"
          accessibilityLabel="Pause"
          testID="pause-button"
          hitSlop={4}
        >
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
  },
  side: {
    minWidth: 72,
  },
  sideRight: {
    alignItems: "flex-end",
  },
  center: {
    alignItems: "center",
    gap: spacing.xs,
  },
  pauseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  pauseBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.onSurfaceVariant,
  },
});
