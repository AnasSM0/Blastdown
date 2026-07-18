import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScoreHeader } from "../src/components/ScoreHeader";
import { colors, radius, spacing } from "../src/ui/theme";

// Static shell: real board/tray rendering and interaction land in the
// next Phase 3 tasks (docs/TASKS.md 3.3-3.6).
export default function GameScreen() {
  return (
    <SafeAreaView style={styles.screen} testID="game-screen">
      <ScoreHeader score={0} best={0} combo={0} onPause={() => {}} />
      <View style={styles.content}>
        <View style={styles.boardRegion} testID="board-region" />
        <View style={styles.trayRegion} testID="tray-region" />
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
    paddingHorizontal: spacing.screenPadding,
  },
  boardRegion: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    aspectRatio: 1,
    marginTop: spacing.lg,
    backgroundColor: colors.boardBg,
    borderColor: colors.boardFrame,
    borderWidth: 2,
    borderRadius: radius.board,
  },
  trayRegion: {
    height: 88,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceBg,
    borderRadius: radius.panel,
  },
});
