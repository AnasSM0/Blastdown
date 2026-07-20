import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { PersistedSettings } from "../../services/storage/schemas";
import { colors, radius, spacing, typography } from "../../ui/theme";

type ToggleKey = "soundEnabled" | "musicEnabled" | "hapticsEnabled" | "reducedMotion";

type SettingsViewProps = {
  settings: PersistedSettings;
  onToggle: (key: ToggleKey, value: boolean) => void;
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
 *  touched (null = follow OS until then). Audio playback itself is a later
 *  phase — these flags are stored now so the wiring exists. */
export function SettingsView({ settings, onToggle, onBack }: SettingsViewProps) {
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
              testID={`setting-${row.key}`}
            />
          </View>
        ))}
      </View>

      <Text style={styles.version} testID="settings-theme">
        Theme: {settings.themeId}
      </Text>
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
  back: {
    ...typography.scoreMobile,
    fontSize: 32,
    color: colors.onSurface,
  },
  backSpacer: {
    width: 24,
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    ...typography.buttonText,
    color: colors.onSurface,
  },
  version: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
});
