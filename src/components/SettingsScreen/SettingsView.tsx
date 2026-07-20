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
});
