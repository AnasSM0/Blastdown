import { Animated, StyleSheet, Text, View } from "react-native";

import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";
import { useAppearAnimation } from "../../hooks/useAppearAnimation";
import { PressableFeedback } from "../PressableFeedback";

type GameOverOverlayProps = {
  score: number;
  best?: number;
  /** Abandon the run and open the results screen. */
  onEndRun: () => void;
  /** Effective reduced-motion for the appear transition + press feedback. */
  reducedMotion?: boolean;
};

/** Canonical V1 game-over panel. A finalized run has one exit to Results;
 *  rewarded Revive is intentionally absent from production scope. */
export function GameOverOverlay({
  score,
  best,
  onEndRun,
  reducedMotion = false,
}: GameOverOverlayProps) {
  const appear = useAppearAnimation(reducedMotion);
  return (
    <View
      style={styles.scrim}
      testID="game-over-overlay"
      accessibilityLabel={`Run over. Final score ${score.toLocaleString("en-US")}`}
      accessible
    >
      <Animated.View key={appear.key} style={[styles.panel, appear.style]}>
        <Text style={typography.labelCaps}>RUN OVER</Text>
        <Text style={[styles.score, neonGlow(colors.scoreOrange, "low")]}>
          {score.toLocaleString("en-US")}
        </Text>
        {best !== undefined ? (
          <Text style={styles.best} testID="game-over-best">
            BEST: {best.toLocaleString("en-US")}
          </Text>
        ) : null}

        <PressableFeedback
          onPress={onEndRun}
          reducedMotion={reducedMotion}
          style={styles.endRun}
          accessibilityRole="button"
          accessibilityLabel="End run and see results"
          testID="end-run-button"
        >
          <Text style={styles.endRunText}>END RUN</Text>
        </PressableFeedback>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5, 5, 5, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  panel: {
    minWidth: 280,
    maxWidth: "88%",
    backgroundColor: colors.surfaceBg,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
  },
  score: {
    ...typography.scoreMobile,
    marginTop: spacing.xs,
  },
  best: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  endRun: {
    marginTop: spacing.lg,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  endRunText: {
    ...typography.labelCaps,
    color: colors.onSurface,
  },
});
