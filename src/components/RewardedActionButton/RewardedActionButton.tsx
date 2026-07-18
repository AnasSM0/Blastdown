import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../ui/theme";

type RewardedActionButtonProps = {
  glyph: string;
  label: string;
  testID: string;
};

/** Inactive-state rewarded power-up button (Stitch 01/07's idle treatment:
 *  transparent fill, neutral border). The active/charged and exhausted
 *  states plus real wiring arrive with the ads phase (BUILD_SPEC.md §6.16,
 *  §6.17, docs/UI_REFERENCE_AUDIT.md item 5) — until then the controls are
 *  rendered disabled so the layout matches the approved reference. */
function RewardedActionButton({ glyph, label, testID }: RewardedActionButtonProps) {
  return (
    <Pressable
      style={styles.button}
      disabled
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: true }}
      testID={testID}
    >
      <Text style={styles.glyph}>{glyph}</Text>
    </Pressable>
  );
}

export function RewardedActionBar() {
  return (
    <View style={styles.bar} testID="rewarded-action-bar">
      <RewardedActionButton glyph="❄" label="Freeze timers" testID="freeze-button" />
      <RewardedActionButton
        glyph="⚡"
        label="Defuse the lowest-timer piece"
        testID="defuse-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    paddingVertical: spacing.sm,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  glyph: {
    fontSize: 20,
    color: colors.onSurfaceVariant,
  },
});
