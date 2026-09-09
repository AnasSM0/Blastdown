import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";
import { PressableFeedback } from "../PressableFeedback";
import { ReactorBackground } from "../ReactorBackground";

export type RunStats = {
  score: number;
  bestCombo: number;
  linesCleared: number;
  piecesPlaced: number;
  piecesDefused: number;
  explosions: number;
  rubbleCleared: number;
};

type ResultsViewProps = {
  stats: RunStats;
  /** Player best score after this run is settled. */
  bestScore: number;
  onPlayAgain: () => void;
  onHome: () => void;
  /** Effective reduced-motion value for presentational press feedback. */
  reducedMotion?: boolean;
};

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

/** Canonical V1 end-of-run presentation. Settlement and route actions remain
 * owned by the caller; this view only applies the release reactor language. */
export function ResultsView({
  stats,
  bestScore,
  onPlayAgain,
  onHome,
  reducedMotion,
}: ResultsViewProps) {
  const n = (value: number) => value.toLocaleString("en-US");
  return (
    <View style={styles.screen} testID="results-screen">
      <ReactorBackground />
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.scoreReadout}>
            <View style={styles.scoreRail} />
            <Text style={styles.heading}>RUN COMPLETE</Text>
            <Text
              style={[styles.score, neonGlow(colors.scoreOrange, "low")]}
              accessibilityLabel={`Final score ${n(stats.score)}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.35}
              testID="results-score"
            >
              {n(stats.score)}
            </Text>
            <Text style={styles.best} numberOfLines={1} testID="results-best">
              BEST: {n(bestScore)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>RUN TELEMETRY</Text>
            <View style={styles.cardDivider} />
            <StatRow label="Best Combo" value={`x${stats.bestCombo}`} accent={colors.cyanBlock} />
            <StatRow
              label="Lines Cleared"
              value={n(stats.linesCleared)}
              accent={colors.cyanBlock}
            />
            <StatRow
              label="Pieces Placed"
              value={n(stats.piecesPlaced)}
              accent={colors.cyanBlock}
            />
            <StatRow
              label="Pieces Defused"
              value={n(stats.piecesDefused)}
              accent={colors.cyanBlock}
            />
            <StatRow label="Explosions" value={n(stats.explosions)} accent={colors.urgentRed} />
            <StatRow
              label="Rubble Cleared"
              value={n(stats.rubbleCleared)}
              accent={colors.cyanBlock}
            />
          </View>

          <PressableFeedback
            onPress={onPlayAgain}
            reducedMotion={reducedMotion}
            style={[styles.playAgain, neonGlow(colors.cyanBlock, "low")]}
            accessibilityRole="button"
            accessibilityLabel="Play again"
            testID="play-again-button"
          >
            <Text style={styles.playAgainText}>PLAY AGAIN</Text>
            <Text style={styles.playAgainArrow}>↻</Text>
          </PressableFeedback>
          <PressableFeedback
            onPress={onHome}
            reducedMotion={reducedMotion}
            style={styles.home}
            accessibilityRole="button"
            accessibilityLabel="Home"
            testID="results-home-button"
          >
            <Text style={styles.homeText}>HOME</Text>
          </PressableFeedback>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  scoreReadout: {
    position: "relative",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  scoreRail: {
    position: "absolute",
    top: 0,
    width: 44,
    height: 1,
    backgroundColor: colors.scoreOrange,
  },
  heading: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    letterSpacing: 2.4,
  },
  score: {
    ...typography.scoreMobile,
    fontSize: 48,
    lineHeight: 54,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  best: {
    ...typography.labelCaps,
    fontVariant: ["tabular-nums"],
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  card: {
    backgroundColor: `${colors.surfaceBg}E8`,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardLabel: {
    ...typography.labelCaps,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.onSurfaceVariant,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
    marginBottom: spacing.xs,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    ...typography.buttonText,
    color: colors.onSurface,
  },
  statValue: {
    ...typography.numericValue,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
    color: colors.onSurface,
  },
  playAgain: {
    marginTop: spacing.lg,
    minHeight: 56,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.cyanBlock,
    backgroundColor: `${colors.cyanBlock}14`,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  playAgainText: {
    ...typography.buttonText,
    color: colors.cyanBlock,
    letterSpacing: 1.2,
  },
  playAgainArrow: {
    ...typography.numericValue,
    color: colors.cyanBlock,
  },
  home: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  homeText: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
  },
});
