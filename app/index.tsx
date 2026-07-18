import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container} testID="home-screen">
      <Text style={styles.logo}>BlastDown</Text>
      <Text style={styles.tagline}>Place. Clear. Defuse. Survive.</Text>

      <View style={styles.statsRow}>
        <Text style={styles.statLabel}>Best score: 0</Text>
        <Text style={styles.statLabel}>Bolts: 0</Text>
      </View>

      <Link href="/game" style={styles.primaryButton} testID="play-button">
        Play
      </Link>

      <View style={styles.secondaryRow}>
        <Link href="/themes" style={styles.secondaryButton}>
          Themes
        </Link>
        <Link href="/settings" style={styles.secondaryButton}>
          Settings
        </Link>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1115",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  logo: {
    fontSize: 40,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: "#9aa0aa",
  },
  statsRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 8,
  },
  statLabel: {
    color: "#c7cbd1",
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: "#ff5c39",
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    overflow: "hidden",
    textAlign: "center",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  secondaryButton: {
    color: "#c7cbd1",
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
