import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";

type HomeScreenViewProps = {
  bestScore: number;
  bolts: number;
  /** Show the Continue button only when an in-memory run is resumable. */
  canContinue: boolean;
  onPlay: () => void;
  onContinue: () => void;
  onThemes: () => void;
  onSettings: () => void;
  onHowToPlay: () => void;
  onPrivacy: () => void;
};

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** Approved "Home Screen - Neon Reactor Minimal" (docs/references .../11-home),
 *  with the leaderboard/"RANKS" button removed per docs/DECISIONS.md and the
 *  "glass" look approximated with fill + border + glow (no per-cell blur,
 *  docs/UI_REFERENCE_AUDIT.md item 9). Presentational only — no gameplay or
 *  navigation logic lives here. */
export function HomeScreenView({
  bestScore,
  bolts,
  canContinue,
  onPlay,
  onContinue,
  onThemes,
  onSettings,
  onHowToPlay,
  onPrivacy,
}: HomeScreenViewProps) {
  return (
    <SafeAreaView style={styles.screen} testID="home-screen">
      <View style={styles.topRow}>
        <Pressable
          style={styles.iconButton}
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          testID="settings-button"
        >
          <Text style={styles.iconGlyph}>⚙</Text>
        </Pressable>
        <View style={styles.boltsPill} testID="bolts-balance">
          <Text style={styles.boltsText}>{formatNumber(bolts)}</Text>
          <Text style={styles.boltsGlyph}> ⚡</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.logo}>BlastDown</Text>
        <View style={styles.bestPill} testID="best-score">
          <Text style={styles.bestLabel}>BEST</Text>
          <Text style={styles.bestValue}>{formatNumber(bestScore)}</Text>
        </View>

        <Pressable
          style={[styles.playButton, neonGlow(colors.scoreOrange, "high")]}
          onPress={onPlay}
          accessibilityRole="button"
          accessibilityLabel="Play a new game"
          testID="play-button"
        >
          <Text style={styles.playGlyph}>▶</Text>
          <Text style={styles.playText}>PLAY</Text>
        </Pressable>

        {canContinue ? (
          <Pressable
            style={styles.continueButton}
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue your current game"
            testID="continue-button"
          >
            <Text style={styles.continueText}>CONTINUE</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.menuRow}>
          <Pressable
            style={styles.menuButton}
            onPress={onThemes}
            accessibilityRole="button"
            accessibilityLabel="Themes"
            testID="themes-button"
          >
            <Text style={styles.menuGlyph}>◑</Text>
            <Text style={styles.menuLabel}>THEMES</Text>
          </Pressable>
          <Pressable
            style={styles.menuButton}
            onPress={onHowToPlay}
            accessibilityRole="button"
            accessibilityLabel="How to play"
            testID="how-to-play-button"
          >
            <Text style={styles.menuGlyph}>?</Text>
            <Text style={styles.menuLabel}>HOW TO PLAY</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={onPrivacy}
          accessibilityRole="link"
          accessibilityLabel="Privacy policy"
          testID="privacy-link"
        >
          <Text style={styles.privacy}>Privacy Policy</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
    paddingHorizontal: spacing.screenPadding,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.md,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: {
    fontSize: 20,
    color: colors.onSurfaceVariant,
  },
  boltsPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cyanBlock,
    backgroundColor: `${colors.cyanBlock}14`,
  },
  boltsText: {
    ...typography.numericValue,
    color: colors.cyanBlock,
  },
  boltsGlyph: {
    ...typography.numericValue,
    color: colors.amberBlock,
  },
  hero: {
    alignItems: "center",
    gap: spacing.xl,
  },
  logo: {
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.onSurface,
    textAlign: "center",
  },
  bestPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBg,
  },
  bestLabel: {
    ...typography.labelCaps,
  },
  bestValue: {
    ...typography.numericValue,
  },
  playButton: {
    width: 200,
    height: 200,
    borderRadius: radius.panel * 2,
    borderWidth: 2,
    borderColor: colors.scoreOrange,
    backgroundColor: `${colors.scoreOrange}1F`,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  playGlyph: {
    fontSize: 44,
    color: colors.onSurface,
  },
  playText: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.onSurface,
  },
  continueButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cyanBlock,
    backgroundColor: `${colors.cyanBlock}14`,
  },
  continueText: {
    ...typography.buttonText,
    color: colors.cyanBlock,
    letterSpacing: 1.5,
  },
  footer: {
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  menuRow: {
    flexDirection: "row",
    gap: spacing.md,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBg,
    padding: spacing.md,
  },
  menuButton: {
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  menuGlyph: {
    fontSize: 18,
    color: colors.onSurfaceVariant,
  },
  menuLabel: {
    ...typography.labelCaps,
  },
  privacy: {
    ...typography.labelCaps,
    color: colors.outline,
    textTransform: "none",
    letterSpacing: 0.5,
  },
});
