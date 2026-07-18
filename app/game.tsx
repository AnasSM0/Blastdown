import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GameBoard } from "../src/components/GameBoard";
import { PieceTray } from "../src/components/PieceTray";
import { ScoreHeader } from "../src/components/ScoreHeader";
import { getTimerBadgePlacements } from "../src/domain/selectors";
import { useGameController } from "../src/hooks/useGameController";
import { colors, spacing } from "../src/ui/theme";

export default function GameScreen() {
  const controller = useGameController();
  const { state } = controller;

  const badges = useMemo(() => getTimerBadgePlacements(state), [state]);

  return (
    <SafeAreaView style={styles.screen} testID="game-screen">
      {/* Best score is persisted in Phase 5; 0 stub until StorageService lands. */}
      <ScoreHeader score={state.score} best={0} combo={state.combo} onPause={() => {}} />
      <View style={styles.content}>
        <GameBoard grid={state.grid} badges={badges} />
        <PieceTray
          hand={state.hand}
          selectedHandId={controller.selectedHandId}
          onSelect={controller.selectPiece}
        />
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
    gap: spacing.lg,
  },
});
