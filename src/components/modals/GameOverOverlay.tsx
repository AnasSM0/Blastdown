import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";

type GameOverOverlayProps = {
  score: number;
  onRestart: () => void;
};

/** Minimal game-over overlay for the first playable slice. The full
 *  revive/second-chance flow (BUILD_SPEC.md §10.4, Stitch 08/10) lands with
 *  the ads phase — this restart-only overlay follows the shared scrim +
 *  centered panel pattern from docs/UI_IMPLEMENTATION.md. */
export function GameOverOverlay({ score, onRestart }: GameOverOverlayProps) {
  return (
    <View
      style={styles.scrim}
      testID="game-over-overlay"
      accessibilityLabel={`Game over. Final score ${score.toLocaleString("en-US")}`}
      accessible
    >
      <View style={styles.panel}>
        <Text style={styles.title}>GAME OVER</Text>
        <Text style={typography.labelCaps}>FINAL SCORE</Text>
        <Text style={[styles.score, neonGlow(colors.scoreOrange, "low")]}>
          {score.toLocaleString("en-US")}
        </Text>
        <Pressable
          onPress={onRestart}
          style={[styles.restart, neonGlow(colors.cyanBlock, "low")]}
          accessibilityRole="button"
          accessibilityLabel="Play again"
          testID="restart-button"
        >
          <Text style={styles.restartText}>PLAY AGAIN</Text>
        </Pressable>
      </View>
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
    minWidth: 260,
    maxWidth: "85%",
    backgroundColor: colors.surfaceBg,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    ...typography.labelCaps,
    fontSize: 18,
    lineHeight: 24,
    color: colors.onSurface,
  },
  score: {
    ...typography.scoreMobile,
  },
  restart: {
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cyanBlock,
    alignItems: "center",
    justifyContent: "center",
  },
  restartText: {
    ...typography.buttonText,
    color: colors.cyanBlock,
  },
});
