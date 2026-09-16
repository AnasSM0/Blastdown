import { Animated, StyleSheet, Text, View } from "react-native";

import { useAppearAnimation } from "../../hooks/useAppearAnimation";
import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";
import { PressableFeedback } from "../PressableFeedback";

type RunConfirmationCardProps = {
  kind: "new-game" | "restart";
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  reducedMotion?: boolean;
};

/** Shared destructive-run confirmation. It owns presentation only; session
 * replacement remains in the route/session layer. */
export function RunConfirmationCard({
  kind,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  reducedMotion = false,
}: RunConfirmationCardProps) {
  const appear = useAppearAnimation(reducedMotion);
  return (
    <View style={styles.scrim} testID={`${kind}-confirm`} accessibilityLabel={title} accessible>
      <Animated.View key={appear.key} style={[styles.card, appear.style]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <PressableFeedback
          onPress={onConfirm}
          reducedMotion={reducedMotion}
          style={[styles.confirm, neonGlow(colors.scoreOrange, "low")]}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          testID={`${kind}-confirm-button`}
        >
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </PressableFeedback>
        <PressableFeedback
          onPress={onCancel}
          reducedMotion={reducedMotion}
          style={styles.cancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          testID={`${kind}-cancel-button`}
        >
          <Text style={styles.cancelText}>CANCEL</Text>
        </PressableFeedback>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(5, 5, 5, 0.88)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    gap: spacing.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.panel,
    backgroundColor: colors.surfaceBg,
  },
  title: {
    ...typography.buttonText,
    color: colors.onSurface,
    textAlign: "center",
  },
  message: {
    ...typography.body,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  confirm: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.scoreOrange,
    borderRadius: radius.pill,
    backgroundColor: `${colors.scoreOrange}1F`,
  },
  confirmText: {
    ...typography.buttonText,
    color: colors.onSurface,
  },
  cancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
  },
});
