import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";

/** The recovery UI shown when the app-level boundary catches a render error.
 *  Deliberately generic — it never shows the raw error message, stack, or any
 *  game/stored state to the player (that goes to the reporter, not the screen).
 *  "Try Again" resets the boundary so the tree re-renders from a clean slate.
 *  Uses static colors (the theme provider may be below the boundary). */
export function ErrorRecoveryView({ onRetry }: { onRetry: () => void }) {
  return (
    <SafeAreaView style={styles.screen} testID="error-recovery">
      <View style={styles.content}>
        <Text style={styles.title}>SOMETHING WENT WRONG</Text>
        <Text style={styles.body}>
          The game hit an unexpected problem. Your progress is saved — tap below to keep playing.
        </Text>
        <Pressable
          onPress={onRetry}
          style={[styles.button, neonGlow(colors.cyanBlock, "low")]}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          testID="error-retry-button"
        >
          <Text style={styles.buttonText}>TRY AGAIN</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.labelCaps,
    color: colors.onSurface,
    textAlign: "center",
    letterSpacing: 2,
  },
  body: {
    ...typography.body,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  button: {
    minHeight: 52,
    minWidth: 200,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cyanBlock,
    backgroundColor: `${colors.cyanBlock}1F`,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    ...typography.buttonText,
    color: colors.cyanBlock,
  },
});
