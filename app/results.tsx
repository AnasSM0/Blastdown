import { StyleSheet, Text, View } from "react-native";

// Placeholder route. Final results UI is implemented in Phase 3 (see docs/TASKS.md).
export default function ResultsScreen() {
  return (
    <View style={styles.container} testID="results-screen">
      <Text style={styles.text}>Results screen coming in Phase 3</Text>
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
