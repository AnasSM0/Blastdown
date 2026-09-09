import { StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { PersistedSettings } from "../../services/storage/schemas";
import { colors, radius, spacing, typography } from "../../ui/theme";
import { PressableFeedback } from "../PressableFeedback";
import { ReactorBackground } from "../ReactorBackground";

type ToggleKey = "soundEnabled" | "musicEnabled" | "hapticsEnabled" | "reducedMotion";

type SettingsViewProps = {
  settings: PersistedSettings;
  onToggle: (key: ToggleKey, value: boolean) => void;
  onReplayTutorial: () => void;
  onBack: () => void;
  /** Opens the development-only effect delivery harness. Omitted from all
   * production builds so the row is structurally absent there. */
  onEffectHarness?: () => void;
  /** Effective OS + in-app reduced-motion value for decorative press feedback. */
  reducedMotion?: boolean;
};

const ROWS: { key: ToggleKey; label: string }[] = [
  { key: "soundEnabled", label: "SOUND EFFECTS" },
  { key: "musicEnabled", label: "MUSIC" },
  { key: "hapticsEnabled", label: "HAPTICS" },
  { key: "reducedMotion", label: "REDUCED MOTION" },
];

/** V1 Settings presentation. Toggle and navigation callbacks remain owned by
 * the route; this view only composes the shared reactor chrome around them. */
export function SettingsView({
  settings,
  onToggle,
  onReplayTutorial,
  onBack,
  onEffectHarness,
  reducedMotion,
}: SettingsViewProps) {
  const valueFor = (key: ToggleKey): boolean =>
    key === "reducedMotion" ? settings.reducedMotionOverride === true : settings[key];

  return (
    <View style={styles.screen} testID="settings-screen">
      <ReactorBackground />
      <SafeAreaView
        style={styles.safe}
        edges={["top", "bottom", "left", "right"]}
        testID="settings-content"
      >
        <View style={styles.header}>
          <PressableFeedback
            onPress={onBack}
            reducedMotion={reducedMotion}
            pressStyle="scale"
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="settings-back-button"
            hitSlop={8}
            style={styles.backHit}
          >
            <Text style={styles.back}>‹</Text>
          </PressableFeedback>
          <View style={styles.titleGroup}>
            <Text style={styles.title}>SETTINGS</Text>
            <View style={styles.titleRail} />
          </View>
          <View style={styles.backSpacer} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AUDIO &amp; FEEDBACK</Text>
          <View style={styles.card}>
            {ROWS.map((row, index) => (
              <View key={row.key}>
                <View style={styles.row}>
                  <Text style={styles.label}>{row.label}</Text>
                  <Switch
                    value={valueFor(row.key)}
                    onValueChange={(value) => onToggle(row.key, value)}
                    accessibilityLabel={row.label}
                    testID={`setting-${row.key}`}
                    trackColor={{ false: colors.outlineVariant, true: `${colors.cyanBlock}80` }}
                    thumbColor={valueFor(row.key) ? colors.cyanBlock : colors.onSurfaceVariant}
                  />
                </View>
                {index < ROWS.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GUIDANCE</Text>
          <View style={styles.card}>
            <PressableFeedback
              style={styles.navRow}
              reducedMotion={reducedMotion}
              onPress={onReplayTutorial}
              accessibilityRole="button"
              accessibilityLabel="Replay tutorial"
              accessibilityHint="Reopens the how-to-play walkthrough"
              testID="settings-replay-tutorial-button"
            >
              <Text style={styles.label}>REPLAY TUTORIAL</Text>
              <Text style={styles.chevron}>›</Text>
            </PressableFeedback>
            {onEffectHarness ? (
              <PressableFeedback
                style={styles.navRow}
                reducedMotion={reducedMotion}
                onPress={onEffectHarness}
                accessibilityRole="button"
                accessibilityLabel="Effect harness"
                accessibilityHint="Opens the development-only effect delivery harness"
                testID="settings-effect-harness-button"
              >
                <Text style={styles.label}>EFFECT HARNESS (DEV)</Text>
                <Text style={styles.chevron}>›</Text>
              </PressableFeedback>
            ) : null}
          </View>
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
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backHit: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: `${colors.surfaceBg}CC`,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    ...typography.scoreMobile,
    fontSize: 30,
    lineHeight: 32,
    color: colors.onSurface,
  },
  backSpacer: {
    width: 44,
  },
  titleGroup: {
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    ...typography.labelCaps,
    fontSize: 18,
    letterSpacing: 3,
    color: colors.onSurface,
  },
  titleRail: {
    width: 36,
    height: 1,
    backgroundColor: colors.cyanBlock,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.labelCaps,
    paddingHorizontal: spacing.xs,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.onSurfaceVariant,
  },
  card: {
    backgroundColor: `${colors.surfaceBg}E6`,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.lg,
  },
  row: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
    opacity: 0.65,
  },
  chevron: {
    ...typography.numericValue,
    fontSize: 22,
    color: colors.onSurfaceVariant,
  },
  label: {
    ...typography.buttonText,
    color: colors.onSurface,
  },
});
