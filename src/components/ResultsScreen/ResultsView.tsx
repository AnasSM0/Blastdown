import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";

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
  /** Bolts earned by this run (floor(score/250) + defuses). */
  boltsEarned: number;
  onPlayAgain: () => void;
  onHome: () => void;
};

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

/** End-of-run results (Stitch 06) built from the run's real domain stats plus
 *  the settled profile (best score, Bolts earned). Play Again starts a fresh
 *  run; Home returns to the menu. Double Bolts stays deferred — no rewarded
 *  contract for it yet (see docs/DECISIONS.md). */
export function ResultsView({
  stats,
  bestScore,
  boltsEarned,
  onPlayAgain,
  onHome,
}: ResultsViewProps) {
  const n = (value: number) => value.toLocaleString("en-US");
  return (
    <SafeAreaView style={styles.screen} testID="results-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>RUN COMPLETE</Text>
        <Text
          style={[styles.score, neonGlow(colors.scoreOrange, "low")]}
          accessibilityLabel={`Final score ${n(stats.score)}`}
          testID="results-score"
        >
          {n(stats.score)}
        </Text>
        <Text style={styles.best} testID="results-best">
          BEST: {n(bestScore)}
        </Text>

        <View style={styles.card}>
          <StatRow label="Bolts Earned" value={`+${n(boltsEarned)}`} accent={colors.scoreOrange} />
          <StatRow label="Best Combo" value={`x${stats.bestCombo}`} accent={colors.cyanBlock} />
          <StatRow label="Lines Cleared" value={n(stats.linesCleared)} accent={colors.cyanBlock} />
          <StatRow label="Pieces Placed" value={n(stats.piecesPlaced)} accent={colors.cyanBlock} />
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

        <Pressable
          onPress={onPlayAgain}
          style={[styles.playAgain, neonGlow(colors.cyanBlock, "low")]}
          accessibilityRole="button"
          accessibilityLabel="Play again"
          testID="play-again-button"
        >
          <Text style={styles.playAgainText}>PLAY AGAIN ↻</Text>
        </Pressable>
        <Pressable
          onPress={onHome}
          style={styles.home}
          accessibilityRole="button"
          accessibilityLabel="Home"
          testID="results-home-button"
        >
          <Text style={styles.homeText}>HOME</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  heading: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  score: {
    ...typography.scoreMobile,
    fontSize: 48,
    textAlign: "center",
  },
  best: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceBg,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
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
    ...typography.buttonText,
    color: colors.onSurface,
  },
  playAgain: {
    marginTop: spacing.lg,
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cyanBlock,
    backgroundColor: `${colors.cyanBlock}1F`,
    alignItems: "center",
    justifyContent: "center",
  },
  playAgainText: {
    ...typography.buttonText,
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
