import { Animated, StyleSheet, Text, View } from "react-native";

import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";
import { useAppearAnimation } from "../../hooks/useAppearAnimation";
import { PressableFeedback } from "../PressableFeedback";

type DefuseConfirmCardProps = {
  onConfirm: () => void;
  onCancel: () => void;
  /** Disables both actions while the reward is in flight (no double-spend). */
  busy?: boolean;
  /** Effective reduced-motion for the appear transition + press feedback. */
  reducedMotion?: boolean;
};

/** Bottom confirm card for the rewarded defuse (Stitch 07). The targeted piece
 *  is highlighted on the board beneath; this only asks the player to spend the
 *  reward. "WATCH & DEFUSE" earns the ad, then the domain defuses the
 *  lowest-timer piece — the UI never picks the target itself. */
export function DefuseConfirmCard({
  onConfirm,
  onCancel,
  busy = false,
  reducedMotion = false,
}: DefuseConfirmCardProps) {
  const appear = useAppearAnimation(reducedMotion);
  return (
    <View style={styles.wrap} testID="defuse-confirm" accessible>
      <Animated.View style={[styles.card, appear]}>
        <Text style={styles.prompt}>Defuse this piece?</Text>
        <PressableFeedback
          onPress={busy ? undefined : onConfirm}
          disabled={busy}
          reducedMotion={reducedMotion}
          style={[styles.confirm, busy && styles.busy, neonGlow(colors.cyanBlock, "low")]}
          accessibilityRole="button"
          accessibilityLabel="Watch an ad and defuse the piece"
          accessibilityState={{ disabled: busy }}
          testID="defuse-confirm-button"
        >
          <Text style={styles.confirmText}>WATCH &amp; DEFUSE</Text>
        </PressableFeedback>
        <PressableFeedback
          onPress={busy ? undefined : onCancel}
          disabled={busy}
          reducedMotion={reducedMotion}
          style={styles.cancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel defuse"
          accessibilityState={{ disabled: busy }}
          testID="defuse-cancel-button"
        >
          <Text style={styles.cancelText}>CANCEL</Text>
        </PressableFeedback>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    zIndex: 12,
  },
  card: {
    backgroundColor: colors.surfaceBg,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "stretch",
  },
  prompt: {
    ...typography.buttonText,
    color: colors.onSurface,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  confirm: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.cyanBlock,
    alignItems: "center",
    justifyContent: "center",
  },
  busy: {
    opacity: 0.5,
  },
  confirmText: {
    ...typography.buttonText,
    color: colors.appBackground,
  },
  cancel: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
  },
});
