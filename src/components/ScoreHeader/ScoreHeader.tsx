import { StyleSheet, Text, View } from "react-native";

import { spacing, typography } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { glowFor } from "../../ui/themes";
import { ComboIndicator } from "../ComboIndicator";
import { PressableFeedback } from "../PressableFeedback";

type ScoreHeaderProps = {
  score: number;
  best: number;
  combo: number;
  onPause: () => void;
  /** Effective reduced-motion, for the pause control's press feedback. */
  reducedMotion?: boolean;
};

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** Cap runaway OS text scaling so the three HUD columns can't collide at large
 *  accessibility sizes. The digits still scale — they just stop before overlap.
 *  The current score keeps a tighter cap (it is the widest element) and also
 *  shrinks to fit its column as a final guard. */
const SCORE_MAX_SCALE = 1.4;
const LABEL_MAX_SCALE = 1.6;

export function ScoreHeader({ score, best, combo, onPause, reducedMotion }: ScoreHeaderProps) {
  const theme = useTheme();
  return (
    <View style={styles.row} testID="score-header">
      <View style={styles.side}>
        <Text
          style={[typography.labelCaps, { color: theme.onSurfaceVariant }]}
          numberOfLines={1}
          maxFontSizeMultiplier={LABEL_MAX_SCALE}
        >
          BEST
        </Text>
        <Text
          style={[typography.numericValue, { color: theme.onSurfaceVariant }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={LABEL_MAX_SCALE}
          accessibilityLabel={`Best score ${formatNumber(best)}`}
          testID="best-value"
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
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={SCORE_MAX_SCALE}
          accessibilityLabel={`Score ${formatNumber(score)}`}
          testID="score-value"
        >
          {formatNumber(score)}
        </Text>
        <ComboIndicator combo={combo} />
      </View>

      <View style={[styles.side, styles.sideRight]}>
        <PressableFeedback
          onPress={onPause}
          reducedMotion={reducedMotion}
          style={[styles.pauseButton, { borderColor: theme.outlineVariant }]}
          accessibilityRole="button"
          accessibilityLabel="Pause"
          accessibilityHint="Pauses the current run and opens the pause menu"
          testID="pause-button"
          hitSlop={4}
        >
          <View style={[styles.pauseBar, { backgroundColor: theme.onSurfaceVariant }]} />
          <View style={[styles.pauseBar, { backgroundColor: theme.onSurfaceVariant }]} />
        </PressableFeedback>
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
    // Fixed, non-shrinking side columns keep the centered score truly centered
    // and give it a stable amount of room to shrink into at large text scales.
    // Wide enough for a realistic multi-digit best; the value also shrinks to
    // fit rather than truncating.
    width: 72,
    flexShrink: 0,
  },
  sideRight: {
    alignItems: "flex-end",
  },
  center: {
    // The score column takes the remaining width and can shrink (minWidth: 0)
    // so `adjustsFontSizeToFit` has room to work instead of overflowing.
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: spacing.xs,
  },
  pauseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  pauseBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
});
