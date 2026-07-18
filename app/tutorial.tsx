import { StyleSheet, Text, View } from "react-native";

// Placeholder route. Playable tutorial is implemented in Phase 3 (see docs/TASKS.md).
export default function TutorialScreen() {
  return (
    <View style={styles.container} testID="tutorial-screen">
      <Text style={styles.text}>Tutorial screen coming in Phase 3</Text>
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
