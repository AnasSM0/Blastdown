import { StyleSheet, Text, View } from "react-native";

// Placeholder route. Theme unlocks are implemented in Phase 5 (see docs/TASKS.md).
export default function ThemesScreen() {
  return (
    <View style={styles.container} testID="themes-screen">
      <Text style={styles.text}>Themes screen coming in Phase 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1115",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#ffffff",
    fontSize: 16,
  },
});
