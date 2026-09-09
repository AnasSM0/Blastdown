import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { glowFor } from "../../ui/themes";
import { PressableFeedback } from "../PressableFeedback";
import { ReactorBackground } from "../ReactorBackground";

type HomeScreenViewProps = {
  bestScore: number;
  /** New-run/resume decisions are disabled until active-run hydration settles. */
  actionsEnabled?: boolean;
  /** Show the Continue button only when an in-memory run is resumable. */
  canContinue: boolean;
  onPlay: () => void;
  onContinue: () => void;
  onSettings: () => void;
  onHowToPlay: () => void;
  onPrivacy: () => void;
  /** Effective reduced-motion (OS + persisted override), threaded from the route
   *  so the buttons' press feedback honors the in-app Settings toggle, not just
   *  the OS setting. Falls back to the OS hook when omitted (isolated renders). */
  reducedMotion?: boolean;
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
  actionsEnabled = true,
  canContinue,
  onPlay,
  onContinue,
  onSettings,
  onHowToPlay,
  onPrivacy,
  reducedMotion,
}: HomeScreenViewProps) {
  const theme = useTheme();
  const primaryLabel = canContinue ? "CONTINUE" : "PLAY";
  const primaryDetail = canContinue ? "RETURN TO ACTIVE RUN" : "START A FRESH RUN";

  return (
    <View style={styles.screen} testID="home-screen">
      <ReactorBackground />
      <SafeAreaView
        style={styles.safe}
        edges={["top", "bottom", "left", "right"]}
        testID="home-safe-area"
      >
        <View style={styles.topRow}>
          <View style={styles.systemMark}>
            <View style={[styles.systemDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.systemText, { color: theme.onSurfaceVariant }]}>
              REACTOR 08×08
            </Text>
          </View>
          <PressableFeedback
            reducedMotion={reducedMotion}
            pressStyle="scale"
            style={[
              styles.iconButton,
              { borderColor: theme.outlineVariant, backgroundColor: `${theme.surfaceBg}D9` },
            ]}
            onPress={onSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            testID="settings-button"
          >
            <Text style={[styles.iconGlyph, { color: theme.onSurfaceVariant }]}>⚙</Text>
          </PressableFeedback>
        </View>

        <View style={styles.hero}>
          <View style={styles.identity}>
            <Text style={[styles.eyebrow, { color: theme.accent }]}>NEON REACTOR</Text>
            <Text style={[styles.logo, { color: theme.onSurface }]}>BlastDown</Text>
            <View style={styles.titleRail}>
              <View style={[styles.titleRailLine, { backgroundColor: theme.outlineVariant }]} />
              <View style={[styles.titleRailCore, { backgroundColor: theme.score }]} />
              <View style={[styles.titleRailLine, { backgroundColor: theme.outlineVariant }]} />
            </View>
          </View>

          <View
            style={styles.scoreReadout}
            accessibilityLabel={`Best score ${formatNumber(bestScore)}`}
            accessible
            testID="home-score-readout"
          >
            <View
              style={[
                styles.readoutBracket,
                styles.readoutBracketLeft,
                { borderColor: theme.outline },
              ]}
            />
            <Text style={[styles.bestLabel, { color: theme.onSurfaceVariant }]}>PERSONAL BEST</Text>
            <Text
              style={[styles.bestValue, { color: theme.onSurface }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.4}
              testID="best-score"
            >
              {formatNumber(bestScore)}
            </Text>
            <View
              style={[
                styles.readoutBracket,
                styles.readoutBracketRight,
                { borderColor: theme.outline },
              ]}
            />
          </View>

          <View
            style={[styles.primaryShell, glowFor(theme, theme.score, "high")]}
            testID="home-primary-action"
          >
            <PressableFeedback
              reducedMotion={reducedMotion}
              pressStyle="scale"
              style={[
                styles.primaryButton,
                {
                  borderColor: theme.score,
                  backgroundColor: `${theme.score}18`,
                },
              ]}
              onPress={canContinue ? onContinue : onPlay}
              disabled={!actionsEnabled}
              accessibilityRole="button"
              accessibilityLabel={canContinue ? "Continue your current game" : "Play a new game"}
              accessibilityState={{ disabled: !actionsEnabled }}
              testID={canContinue ? "continue-button" : "play-button"}
            >
              <View style={[styles.playGlyphWell, { borderColor: `${theme.score}66` }]}>
                <Text style={[styles.playGlyph, { color: theme.onSurface }]}>▶</Text>
              </View>
              <View style={styles.primaryCopy}>
                <Text style={[styles.playText, { color: theme.onSurface }]}>{primaryLabel}</Text>
                <Text style={[styles.playDetail, { color: theme.onSurfaceVariant }]}>
                  {primaryDetail}
                </Text>
              </View>
              <Text style={[styles.primaryArrow, { color: theme.score }]}>›</Text>
              <View style={[styles.energyEdge, { backgroundColor: theme.score }]} />
            </PressableFeedback>
          </View>

          {canContinue ? (
            <PressableFeedback
              reducedMotion={reducedMotion}
              style={[styles.newGameButton, { borderColor: theme.outlineVariant }]}
              onPress={onPlay}
              disabled={!actionsEnabled}
              accessibilityRole="button"
              accessibilityLabel="Start a new game"
              accessibilityState={{ disabled: !actionsEnabled }}
              testID="play-button"
            >
              <Text style={[styles.newGameText, { color: theme.onSurfaceVariant }]}>NEW GAME</Text>
            </PressableFeedback>
          ) : null}
        </View>

        <View style={styles.footer} testID="home-footer">
          <PressableFeedback
            reducedMotion={reducedMotion}
            style={[
              styles.howToButton,
              { borderColor: theme.outlineVariant, backgroundColor: `${theme.surfaceBg}A6` },
            ]}
            onPress={onHowToPlay}
            accessibilityRole="button"
            accessibilityLabel="How to play"
            testID="how-to-play-button"
          >
            <View style={[styles.helpGlyph, { borderColor: theme.outline }]}>
              <Text style={[styles.menuGlyph, { color: theme.onSurfaceVariant }]}>?</Text>
            </View>
            <Text style={[styles.menuLabel, { color: theme.onSurfaceVariant }]}>HOW TO PLAY</Text>
            <Text style={[styles.secondaryArrow, { color: theme.outline }]}>›</Text>
          </PressableFeedback>
          <PressableFeedback
            reducedMotion={reducedMotion}
            style={styles.privacyHit}
            onPress={onPrivacy}
            accessibilityRole="link"
            accessibilityLabel="Privacy policy"
            testID="privacy-link"
          >
            <Text style={[styles.privacy, { color: theme.outline }]}>Privacy Policy</Text>
          </PressableFeedback>
        </View>
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
    paddingHorizontal: spacing.screenPadding,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.sm,
  },
  systemMark: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  systemDot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
  },
  systemText: {
    ...typography.labelCaps,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.8,
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
  hero: {
    alignItems: "center",
    width: "100%",
    gap: spacing.lg,
  },
  identity: {
    alignItems: "center",
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.labelCaps,
    fontSize: 10,
    letterSpacing: 3.2,
  },
  logo: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  titleRail: {
    width: 152,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  titleRailLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  titleRailCore: {
    width: 18,
    height: 2,
  },
  scoreReadout: {
    minWidth: 152,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  readoutBracket: {
    position: "absolute",
    top: 6,
    bottom: 6,
    width: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  readoutBracketLeft: {
    left: 0,
    borderLeftWidth: 1,
  },
  readoutBracketRight: {
    right: 0,
    borderRightWidth: 1,
  },
  bestLabel: {
    ...typography.labelCaps,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 2,
  },
  bestValue: {
    ...typography.numericValue,
    fontSize: 25,
    lineHeight: 30,
    fontVariant: ["tabular-nums"],
  },
  primaryShell: {
    width: "100%",
    maxWidth: 340,
    minHeight: 84,
  },
  primaryButton: {
    width: "100%",
    minHeight: 84,
    borderRadius: radius.panel,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  playGlyphWell: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playGlyph: {
    fontSize: 20,
    lineHeight: 24,
    marginLeft: 2,
  },
  primaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  playText: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  playDetail: {
    ...typography.labelCaps,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.35,
  },
  primaryArrow: {
    fontSize: 30,
    lineHeight: 34,
  },
  energyEdge: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    height: 2,
    opacity: 0.9,
  },
  newGameButton: {
    minWidth: 132,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  newGameText: {
    ...typography.labelCaps,
    letterSpacing: 1.3,
  },
  footer: {
    width: "100%",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  howToButton: {
    width: "100%",
    maxWidth: 300,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.panel,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  helpGlyph: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  menuGlyph: {
    fontSize: 14,
    lineHeight: 18,
  },
  menuLabel: {
    ...typography.labelCaps,
    flex: 1,
  },
  secondaryArrow: {
    fontSize: 22,
  },
  privacyHit: {
    minHeight: 44,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  privacy: {
    ...typography.labelCaps,
    textTransform: "none",
    letterSpacing: 0.5,
  },
});
