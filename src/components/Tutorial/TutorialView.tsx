import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GameBoard } from "../GameBoard";
import { DragGhost } from "../DragGhost";
import { PieceTray } from "../PieceTray";
import { createInitialGameState } from "../../domain/game";
import type { GameState } from "../../domain/gameTypes";
import type { CellPosition } from "../../domain/placement";
import { getTimerBadgePlacements, type PlacementPreview } from "../../domain/selectors";
import { useGameController } from "../../hooks/useGameController";
import { usePieceDragInteraction } from "../../hooks/usePieceDragInteraction";
import {
  tutorialSteps,
  TUTORIAL_STEP_COUNT,
  type TutorialStep,
} from "../../features/tutorial/tutorialContent";
import { colors, radius, spacing, typography } from "../../ui/theme";
import { ReactorBackground } from "../ReactorBackground";

type TutorialViewProps = {
  /** Called when the player reaches the end and finishes the tutorial. */
  onComplete: () => void;
  /** Called when the player skips (allowed only after the step-1 placement). */
  onSkip: () => void;
  /** Optional: notified with the step id whenever the player moves to a new
   *  step (not on first mount — the initial view is covered by tutorial_start).
   *  Used for analytics; the view works fine without it. */
  onStepChange?: (stepId: number) => void;
  /** Test seam: fixed board size, since onLayout doesn't fire in tests. */
  boardSize?: number;
};

/** Highlight is drawn by reusing the board's valid-preview treatment. */
function highlightPreview(cells: readonly CellPosition[]): PlacementPreview | null {
  if (cells.length === 0) {
    return null;
  }
  return {
    valid: true,
    cells: [...cells],
    conflictCells: [],
    clear: { rows: [], columns: [], cells: [], intersections: [] },
  };
}

function TutorialPlacement({
  step,
  boardSize,
  onPlaced,
}: {
  step: TutorialStep;
  boardSize?: number;
  onPlaced: () => void;
}) {
  const initialState = useMemo<GameState>(
    () => ({
      ...createInitialGameState(`tutorial-${step.id}`, 0),
      grid: step.grid,
      hand: step.interactiveHand ?? [],
    }),
    [step],
  );
  const controller = useGameController({ initialState, now: () => 0 });
  const isOriginAllowed = useCallback(
    (origin: CellPosition) =>
      step.highlightCells.length === 0 ||
      step.highlightCells.some(
        (allowed) => allowed.row === origin.row && allowed.column === origin.column,
      ),
    [step.highlightCells],
  );
  const {
    boardRef,
    ghostRef,
    cellSize,
    drag,
    dragPreview,
    returning,
    handleCellSizeChange,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
    clearDrag,
  } = usePieceDragInteraction({
    controller,
    boardSize,
    isOriginAllowed,
    onPlaced,
  });

  const handleCellPress = useCallback(
    (origin: CellPosition) => {
      const handId = controller.selectedHandId;
      if (handId === null || !isOriginAllowed(origin)) {
        return;
      }
      const intent = controller.createPlacementIntent(handId);
      if (intent && controller.place(intent, origin)) {
        onPlaced();
      }
    },
    [controller, isOriginAllowed, onPlaced],
  );

  const boardPreview = useMemo(
    () =>
      dragPreview
        ? {
            ...dragPreview,
            cells: [],
            conflictCells: [],
          }
        : highlightPreview(step.highlightCells),
    [dragPreview, step.highlightCells],
  );
  const badges = useMemo(() => getTimerBadgePlacements(controller.state), [controller.state]);

  return (
    <>
      <View style={styles.boardWrap}>
        <GameBoard
          ref={boardRef}
          grid={controller.state.grid}
          badges={badges}
          preview={boardPreview}
          boardSize={boardSize}
          onCellPress={handleCellPress}
          onCellSizeChange={handleCellSizeChange}
        />
      </View>
      <PieceTray
        hand={controller.state.hand}
        selectedHandId={controller.selectedHandId}
        onSelect={controller.selectPiece}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        draggingHandId={drag?.handId ?? null}
        boardCellSize={cellSize}
        availableWidth={boardSize ?? 320}
      />
      {drag && cellSize > 0 ? (
        <DragGhost
          key={drag.id}
          ref={ghostRef}
          shapeId={drag.shapeId}
          colorId={drag.colorId}
          cellSize={cellSize}
          initialX={drag.startX}
          initialY={drag.startY}
          valid={dragPreview?.valid ?? false}
          visualLift={drag.visualLift}
          returning={returning}
          onReturnComplete={() => clearDrag(drag.id)}
        />
      ) : null}
    </>
  );
}

/** First-run onboarding over the real board and components (never screenshots).
 *  Uses isolated controllers for interactive steps, so it can never
 *  touch the persisted active run. Persistence of completion is the caller's
 *  responsibility (onComplete / onSkip). */
export function TutorialView({ onComplete, onSkip, onStepChange, boardSize }: TutorialViewProps) {
  const steps = useMemo(() => tutorialSteps(), []);
  const [index, setIndex] = useState(0);
  const [completedInteractiveSteps, setCompletedInteractiveSteps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const step = steps[index];

  // Notify on step changes only (skip the initial mount, covered by
  // tutorial_start). Read the callback through a ref so it never re-fires.
  const onStepChangeRef = useRef(onStepChange);
  useEffect(() => {
    onStepChangeRef.current = onStepChange;
  });
  const firstStepRef = useRef(true);
  useEffect(() => {
    if (firstStepRef.current) {
      firstStepRef.current = false;
      return;
    }
    onStepChangeRef.current?.(steps[index].id);
  }, [index, steps]);
  const isInteractive = step.interactiveHand !== undefined;
  const isLast = index === steps.length - 1;
  const canAdvance = !isInteractive || completedInteractiveSteps.has(step.id);
  const canSkip = index > 0 || completedInteractiveSteps.has(1);

  const handlePlaced = useCallback(() => {
    setCompletedInteractiveSteps((current) => {
      if (current.has(step.id)) {
        return current;
      }
      return new Set([...current, step.id]);
    });
  }, [step.id]);

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

  return (
    <View style={styles.screen} testID="tutorial-screen">
      <ReactorBackground />
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
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

        {isInteractive ? (
          <TutorialPlacement
            key={step.id}
            step={step}
            boardSize={boardSize}
            onPlaced={handlePlaced}
          />
        ) : (
          <View style={styles.boardWrap}>
            <GameBoard
              grid={step.grid}
              badges={step.badges}
              preview={highlightPreview(step.highlightCells)}
              boardSize={boardSize}
            />
          </View>
        )}

        <View style={styles.panel}>
          <View style={styles.panelAccent} />
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
              <Text style={[styles.navText, styles.navPrimaryText]}>
                {isLast ? "DONE" : "NEXT"}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  safe: {
    flex: 1,
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
    position: "relative",
    backgroundColor: colors.surfaceBg,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: "auto",
    marginBottom: spacing.lg,
  },
  panelAccent: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: 42,
    height: 1,
    backgroundColor: colors.cyanBlock,
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
