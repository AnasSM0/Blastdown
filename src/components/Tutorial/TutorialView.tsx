import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GameBoard } from "../GameBoard";
import { PieceTray } from "../PieceTray";
import { createInitialGameState } from "../../domain/game";
import type { GameState } from "../../domain/gameTypes";
import type { CellPosition } from "../../domain/placement";
import { getTimerBadgePlacements, type PlacementPreview } from "../../domain/selectors";
import { useGameController } from "../../hooks/useGameController";
import { tutorialSteps, TUTORIAL_STEP_COUNT } from "../../features/tutorial/tutorialContent";
import { colors, radius, spacing, typography } from "../../ui/theme";

type TutorialViewProps = {
  /** Called when the player reaches the end and finishes the tutorial. */
  onComplete: () => void;
  /** Called when the player skips (allowed only after the step-1 placement). */
  onSkip: () => void;
  /** Test seam: fixed board size, since onLayout doesn't fire in tests. */
  boardSize?: number;
};

/** Highlight is drawn by reusing the board's valid-preview treatment. */
function highlightPreview(cells: readonly CellPosition[]): PlacementPreview | null {
  if (cells.length === 0) {
    return null;
  }
  return { valid: true, cells: [...cells], conflictCells: [] };
}

/** First-run onboarding over the real board and components (never screenshots).
 *  Uses its own isolated controller for the interactive step, so it can never
 *  touch the persisted active run. Persistence of completion is the caller's
 *  responsibility (onComplete / onSkip). */
export function TutorialView({ onComplete, onSkip, boardSize }: TutorialViewProps) {
  const steps = useMemo(() => tutorialSteps(), []);
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState(false);

  const step = steps[index];
  const isInteractive = step.interactiveHand !== undefined;
  const isLast = index === steps.length - 1;

  // Isolated controller for the interactive first step (never the session one).
  const interactiveInitial = useMemo<GameState>(
    () => ({
      ...createInitialGameState("tutorial", 0),
      grid: steps[0].grid,
      hand: steps[0].interactiveHand ?? [],
    }),
    [steps],
  );
  const controller = useGameController({ initialState: interactiveInitial, now: () => 0 });

  const interactivePlaced = controller.state.turn > 0;
  const canAdvance = !isInteractive || placed || interactivePlaced;
  const canSkip = index > 0 || placed || interactivePlaced;

  const handleSelect = useCallback(
    (handId: string) => {
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
        setPlaced(true);
      }
    },
    [controller],
  );

  const handleNext = useCallback(() => {
    if (!canAdvance) {
      return;
    }
    if (isLast) {
      onComplete();
      return;
    }
    setIndex((value) => Math.min(value + 1, steps.length - 1));
  }, [canAdvance, isLast, onComplete, steps.length]);

  const handleBack = useCallback(() => {
    setIndex((value) => Math.max(value - 1, 0));
  }, []);

  const interactiveBadges = useMemo(
    () => getTimerBadgePlacements(controller.state),
    [controller.state],
  );

  const boardGrid = isInteractive ? controller.state.grid : step.grid;
  const boardBadges = isInteractive ? interactiveBadges : step.badges;
  const boardPreview = isInteractive ? null : highlightPreview(step.highlightCells);

  return (
    <SafeAreaView style={styles.screen} testID="tutorial-screen">
      <View style={styles.header}>
        <Text
          style={styles.progress}
          accessibilityLabel={`Step ${step.id} of ${TUTORIAL_STEP_COUNT}`}
        >
          {`STEP ${step.id} / ${TUTORIAL_STEP_COUNT}`}
        </Text>
        {canSkip ? (
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip tutorial"
            style={styles.skipButton}
            hitSlop={8}
            testID="tutorial-skip-button"
          >
            <Text style={styles.skipText}>SKIP</Text>
          </Pressable>
        ) : (
          <View style={styles.skipSpacer} />
        )}
      </View>

      <View style={styles.boardWrap}>
        <GameBoard
          grid={boardGrid}
          badges={boardBadges}
          preview={boardPreview}
          boardSize={boardSize}
          onCellPress={isInteractive ? handleCellPress : undefined}
        />
      </View>

      {isInteractive ? (
        <PieceTray
          hand={controller.state.hand}
          selectedHandId={controller.selectedHandId}
          onSelect={handleSelect}
        />
      ) : null}

      <View style={styles.panel}>
        <Text
          style={styles.message}
          accessibilityHint={step.accessibilityHint}
          testID="tutorial-message"
        >
          {step.message}
        </Text>
        {isInteractive && !canAdvance ? (
          <Text style={styles.action} testID="tutorial-action-hint">
            Select the block, then tap the board to place it.
          </Text>
        ) : null}

        <View style={styles.controls}>
          <Pressable
            onPress={handleBack}
            disabled={index === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous step"
            accessibilityState={{ disabled: index === 0 }}
            style={[styles.navButton, index === 0 && styles.navDisabled]}
            testID="tutorial-back-button"
          >
            <Text style={styles.navText}>BACK</Text>
          </Pressable>
          <Pressable
            onPress={handleNext}
            disabled={!canAdvance}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Finish tutorial" : "Next step"}
            accessibilityState={{ disabled: !canAdvance }}
            style={[styles.navButton, styles.navPrimary, !canAdvance && styles.navDisabled]}
            testID="tutorial-next-button"
          >
            <Text style={[styles.navText, styles.navPrimaryText]}>{isLast ? "DONE" : "NEXT"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
  },
  progress: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    letterSpacing: 2,
  },
  skipButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  skipSpacer: {
    width: 44,
    height: 44,
  },
  skipText: {
    ...typography.buttonText,
    color: colors.onSurfaceVariant,
  },
  boardWrap: {
    alignItems: "center",
  },
  panel: {
    backgroundColor: colors.surfaceBg,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: "auto",
    marginBottom: spacing.lg,
  },
  message: {
    ...typography.body,
    color: colors.onSurface,
    fontSize: 18,
    textAlign: "center",
  },
  action: {
    ...typography.labelCaps,
    color: colors.cyanBlock,
    textAlign: "center",
    textTransform: "none",
  },
  controls: {
    flexDirection: "row",
    gap: spacing.md,
  },
  navButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  navPrimary: {
    borderColor: colors.cyanBlock,
    backgroundColor: `${colors.cyanBlock}14`,
  },
  navDisabled: {
    opacity: 0.4,
  },
  navText: {
    ...typography.buttonText,
    color: colors.onSurface,
  },
  navPrimaryText: {
    color: colors.cyanBlock,
  },
});
