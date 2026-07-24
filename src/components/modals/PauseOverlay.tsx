import { Animated, StyleSheet, Switch, Text, View } from "react-native";

import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";
import { useAppearAnimation } from "../../hooks/useAppearAnimation";
import { PressableFeedback } from "../PressableFeedback";

type PauseOverlayProps = {
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  /** Read-only reflection of the OS reduced-motion setting for its toggle row. */
  reducedMotion?: boolean;
};

/** Settings placeholder rows (Stitch 12). Sound, music, and haptics toggles
 *  are non-functional until the audio/settings phase wires a persisted
 *  settings store; reduced motion mirrors the OS setting read-only. Kept here
 *  so the paused screen matches the approved reference without introducing a
 *  settings store this phase (see docs/DECISIONS.md). */
const PLACEHOLDER_ROWS: { key: string; label: string; on: boolean }[] = [
  { key: "sound", label: "SOUND EFFECTS", on: true },
  { key: "music", label: "MUSIC", on: true },
  { key: "haptics", label: "HAPTICS", on: true },
];

/** Pause menu (Stitch 12). Resume, Restart, and Home are functional; the
 *  sound/music/haptics toggles are documented placeholders and reduced motion
 *  is a read-only mirror of the OS setting. Holds no gameplay rules. */
export function PauseOverlay({
  onResume,
  onRestart,
  onHome,
  reducedMotion = false,
}: PauseOverlayProps) {
  const appear = useAppearAnimation(reducedMotion);
  return (
    <View style={styles.scrim} testID="pause-overlay" accessibilityLabel="Paused" accessible>
      <Animated.View style={[styles.panel, appear]}>
        <Text style={styles.title}>PAUSED</Text>

        <PressableFeedback
          onPress={onResume}
          reducedMotion={reducedMotion}
          style={[styles.resume, neonGlow(colors.cyanBlock, "low")]}
          accessibilityRole="button"
          accessibilityLabel="Resume game"
          testID="resume-button"
        >
          <Text style={styles.resumeText}>▶ RESUME</Text>
        </PressableFeedback>

        <View style={styles.toggles}>
          {PLACEHOLDER_ROWS.map((row) => (
            <View key={row.key} style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{row.label}</Text>
              <Switch value={row.on} disabled testID={`toggle-${row.key}`} />
            </View>
          ))}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>REDUCED MOTION</Text>
            <Switch value={reducedMotion} disabled testID="toggle-reduced-motion" />
          </View>
        </View>

        <View style={styles.actions}>
          <PressableFeedback
            onPress={onRestart}
            reducedMotion={reducedMotion}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel="Restart run"
            testID="pause-restart-button"
          >
            <Text style={styles.actionText}>Restart</Text>
          </PressableFeedback>
          <PressableFeedback
            onPress={onHome}
            reducedMotion={reducedMotion}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel="Go home"
            testID="pause-home-button"
          >
            <Text style={styles.actionText}>Home</Text>
          </PressableFeedback>
        </View>
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
    zIndex: 15,
  },
  panel: {
    minWidth: 300,
    maxWidth: "90%",
    backgroundColor: colors.surfaceBg,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.labelCaps,
    fontSize: 24,
    letterSpacing: 4,
    color: colors.cyanBlock,
    textAlign: "center",
  },
  resume: {
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cyanBlock,
    alignItems: "center",
    justifyContent: "center",
  },
  resumeText: {
    ...typography.buttonText,
    color: colors.scoreOrange,
  },
  toggles: {
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  toggleLabel: {
    ...typography.labelCaps,
    color: colors.onSurface,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  action: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.panel,
    backgroundColor: colors.boardBg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    ...typography.buttonText,
    color: colors.onSurface,
  },
});
