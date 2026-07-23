import { StyleSheet, Text, View } from "react-native";

import { radius, spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";

type ComboIndicatorProps = {
  combo: number;
};

export function ComboIndicator({ combo }: ComboIndicatorProps) {
  const theme = useTheme();
  if (combo <= 0) {
    return null;
  }
  // The combo multiplier is a scoring flourish in the HUD, so it takes the
  // theme's score accent (per-theme) rather than a fixed amber — keeping it
  // consistent with the score numeral across all five themes.
  return (
    <View
      style={[styles.pill, { borderColor: theme.score }]}
      testID="combo-indicator"
      accessibilityLabel={`Combo x${combo}`}
      accessible
    >
      <Text
        style={[styles.text, { color: theme.score }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
      >{`x${combo}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "center",
  },
  text: {
    fontSize: 14,
    fontWeight: "700",
  },
});
