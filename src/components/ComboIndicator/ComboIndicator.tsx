import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "../../ui/theme";

type ComboIndicatorProps = {
  combo: number;
};

export function ComboIndicator({ combo }: ComboIndicatorProps) {
  if (combo <= 0) {
    return null;
  }
  return (
    <View
      style={styles.pill}
      testID="combo-indicator"
      accessibilityLabel={`Combo x${combo}`}
      accessible
    >
      <Text style={styles.text}>{`x${combo}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderColor: colors.amberBlock,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "center",
  },
  text: {
    color: colors.amberBlock,
    fontSize: 14,
    fontWeight: "700",
  },
});
