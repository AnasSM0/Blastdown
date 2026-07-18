import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GameBoard } from "../src/components/GameBoard";
import { PieceTray } from "../src/components/PieceTray";
import { ScoreHeader } from "../src/components/ScoreHeader";
import { GameOverOverlay } from "../src/components/modals/GameOverOverlay";
import type { CellPosition } from "../src/domain/placement";
import { getTimerBadgePlacements } from "../src/domain/selectors";
import { useGameController, type GameControllerOptions } from "../src/hooks/useGameController";
import { colors, spacing } from "../src/ui/theme";

type GameScreenContentProps = {
  controllerOptions?: GameControllerOptions;
  /** Test seam: fixed board size, since onLayout doesn't fire in tests. */
  boardSize?: number;
};

/** Inner screen, exported for tests so a crafted controller can be injected.
 *  All gameplay decisions come from the domain via the controller. */
export function GameScreenContent({ controllerOptions, boardSize }: GameScreenContentProps) {
  const controller = useGameController(controllerOptions);
  const { state } = controller;
  const [previewOrigin, setPreviewOrigin] = useState<CellPosition | null>(null);

  const badges = useMemo(() => getTimerBadgePlacements(state), [state]);
  const preview = previewOrigin ? controller.previewAt(previewOrigin) : null;

  const handleSelect = useCallback(
    (handId: string) => {
      setPreviewOrigin(null);
      controller.selectPiece(handId);
    },
    [controller],
  );

  const handleCellPress = useCallback(
    (position: CellPosition) => {
      if (controller.selectedHandId === null) {
        return;
      }
      if (controller.placeAt(position)) {
        setPreviewOrigin(null);
      } else {
        // Rejected by the domain: show exactly where the attempt conflicts.
        setPreviewOrigin(position);
      }
    },
    [controller],
  );

  const handleRestart = useCallback(() => {
    setPreviewOrigin(null);
    controller.restart();
  }, [controller]);

  return (
    <SafeAreaView style={styles.screen} testID="game-screen">
      {/* Best score is persisted in Phase 5; 0 stub until StorageService lands. */}
      <ScoreHeader score={state.score} best={0} combo={state.combo} onPause={() => {}} />
      <View style={styles.content}>
        <GameBoard
          grid={state.grid}
          badges={badges}
          boardSize={boardSize}
          preview={preview}
          onCellPress={handleCellPress}
        />
        <PieceTray
          hand={state.hand}
          selectedHandId={controller.selectedHandId}
          onSelect={handleSelect}
        />
      </View>
      {state.status === "gameOver" ? (
        <GameOverOverlay score={state.score} onRestart={handleRestart} />
      ) : null}
    </SafeAreaView>
  );
}

export default function GameScreen() {
  return <GameScreenContent />;
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
