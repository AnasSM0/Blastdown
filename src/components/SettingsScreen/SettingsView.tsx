import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { PersistedSettings } from "../../services/storage/schemas";
import { colors, radius, spacing, typography } from "../../ui/theme";

type ToggleKey = "soundEnabled" | "musicEnabled" | "hapticsEnabled" | "reducedMotion";

type SettingsViewProps = {
  settings: PersistedSettings;
  /** Display name of the active theme, shown on the Themes row. */
  themeName: string;
  onToggle: (key: ToggleKey, value: boolean) => void;
  onThemes: () => void;
  onReplayTutorial: () => void;
  onBack: () => void;
  /** Privacy options row. Shown only when UMP reports that a persistent entry
   *  point is required for this user — never speculatively, and never for a
   *  user who is not under a regulation that grants it. */
  privacyOptionsVisible?: boolean;
  onPrivacyOptions?: () => void;
  /** True while the privacy form is being presented, so a second press cannot
   *  queue a second form. */
  privacyOptionsPending?: boolean;
  /** Development builds only: clears UMP's stored decision so the first-launch
   *  consent flow can be replayed on device. Absent everywhere else. */
  onResetConsent?: (() => void) | null;
};

const ROWS: { key: ToggleKey; label: string }[] = [
  { key: "soundEnabled", label: "SOUND EFFECTS" },
  { key: "musicEnabled", label: "MUSIC" },
  { key: "hapticsEnabled", label: "HAPTICS" },
  { key: "reducedMotion", label: "REDUCED MOTION" },
];

/** Settings screen (BUILD_SPEC.md §10.7). Every toggle is wired to persisted
 *  settings and survives restart. Reduced motion is an explicit override once
 *  touched (null = follow OS until then). Also the hub for Themes navigation
 *  and replaying the tutorial. All controls are at least 44x44. */
export function SettingsView({
  settings,
  themeName,
  onToggle,
  onThemes,
  onReplayTutorial,
  onBack,
  privacyOptionsVisible = false,
  onPrivacyOptions,
  privacyOptionsPending = false,
  onResetConsent = null,
}: SettingsViewProps) {
  const valueFor = (key: ToggleKey): boolean =>
    key === "reducedMotion" ? settings.reducedMotionOverride === true : settings[key];

  return (
    <SafeAreaView style={styles.screen} testID="settings-screen">
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="settings-back-button"
          hitSlop={8}
          style={styles.backHit}
        >
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={styles.backSpacer} />
      </View>

      <View style={styles.card}>
        {ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Switch
              value={valueFor(row.key)}
              onValueChange={(value) => onToggle(row.key, value)}
              accessibilityLabel={row.label}
              testID={`setting-${row.key}`}
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Pressable
          style={styles.navRow}
          onPress={onThemes}
          accessibilityRole="button"
          accessibilityLabel={`Themes, currently ${themeName}`}
          testID="settings-themes-button"
        >
          <Text style={styles.label}>THEMES</Text>
          <View style={styles.navValue}>
            <Text style={styles.navValueText}>{themeName}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.navRow}
          onPress={onReplayTutorial}
          accessibilityRole="button"
          accessibilityLabel="Replay tutorial"
          accessibilityHint="Reopens the how-to-play walkthrough"
          testID="settings-replay-tutorial-button"
        >
          <Text style={styles.label}>REPLAY TUTORIAL</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      {(privacyOptionsVisible || onResetConsent) && (
        <View style={styles.card}>
          {privacyOptionsVisible && (
            <Pressable
              style={styles.navRow}
              onPress={onPrivacyOptions}
              disabled={privacyOptionsPending}
              accessibilityRole="button"
              accessibilityState={{ disabled: privacyOptionsPending }}
              accessibilityLabel="Privacy options"
              accessibilityHint="Reopens the ad consent choices"
              testID="settings-privacy-options-button"
            >
              <Text style={[styles.label, privacyOptionsPending && styles.labelPending]}>
                PRIVACY OPTIONS
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          {onResetConsent && (
            <Pressable
              style={styles.navRow}
              onPress={onResetConsent}
              accessibilityRole="button"
              accessibilityLabel="Reset consent, development only"
              testID="settings-reset-consent-button"
            >
              <Text style={styles.label}>RESET CONSENT (DEV)</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backHit: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  back: {
    ...typography.scoreMobile,
    fontSize: 32,
    color: colors.onSurface,
  },
  backSpacer: {
    width: 44,
  },
  title: {
    ...typography.labelCaps,
    fontSize: 18,
    letterSpacing: 3,
    color: colors.onSurface,
  },
  card: {
    backgroundColor: colors.surfaceBg,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.lg,
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  navValueText: {
    ...typography.buttonText,
    color: colors.onSurfaceVariant,
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
  labelPending: {
    color: colors.onSurfaceVariant,
  },
});
