import { StyleSheet, Text, View } from "react-native";

// Placeholder route. Settings persistence is implemented in Phase 5 (see docs/TASKS.md).
export default function SettingsScreen() {
  return (
    <View style={styles.container} testID="settings-screen">
      <Text style={styles.text}>Settings screen coming in Phase 5</Text>
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
