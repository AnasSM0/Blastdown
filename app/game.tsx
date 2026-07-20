import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { GameBoard, BOARD_CONTENT_INSET } from "../src/components/GameBoard";
import { PieceTray } from "../src/components/PieceTray";
import { ScoreHeader } from "../src/components/ScoreHeader";
import { GameOverOverlay } from "../src/components/modals/GameOverOverlay";
import { DefuseConfirmCard } from "../src/components/modals/DefuseConfirmCard";
import { SecondChanceBanner } from "../src/components/modals/SecondChanceBanner";
import { PauseOverlay } from "../src/components/modals/PauseOverlay";
import { RewardedActionBar } from "../src/components/RewardedActionButton";
import { DragGhost, DRAG_LIFT, type DragGhostHandle } from "../src/components/DragGhost";
import { BOARD_SIZE } from "../src/domain/board";
import type { CellPosition } from "../src/domain/placement";
import { getShapeById } from "../src/domain/shapes";
import {
  canActivateFreeze,
  canApplyRewardedDefuse,
  canRevive,
  getRewardedDefuseTarget,
  getTimerBadgePlacements,
} from "../src/domain/selectors";
import { dragOriginFromFinger, type BoardLayout, type Point } from "../src/ui/boardGeometry";
import {
  useGameController,
  type GameController,
  type GameControllerOptions,
} from "../src/hooks/useGameController";
import { useHaptics } from "../src/hooks/useHaptics";
import { useEffectiveReducedMotion } from "../src/hooks/useEffectiveReducedMotion";
import { useEventAnimator } from "../src/hooks/useEventAnimator";
import { useRewardedAction } from "../src/hooks/useRewardedAction";
import { useAudio } from "../src/hooks/useAudio";
import { useGameAudio } from "../src/hooks/useGameAudio";
import { AudioServiceProvider } from "../src/services/audio";
import type { AudioService } from "../src/services/audio";
import { StorageServiceProvider, createMemoryStorageService } from "../src/services/storage";
import { SettingsProvider } from "../src/state/SettingsProvider";
import { AdServiceProvider } from "../src/services/ads";
import type { AdService } from "../src/services/ads";
import { useGameSession } from "../src/state/GameSessionProvider";
import { colors, spacing } from "../src/ui/theme";

type DragState = {
  handId: string;
  shapeId: string;
  colorId: string;
  startX: number;
  startY: number;
};

function shapeBoundsFor(shapeId: string): { maxRow: number; maxColumn: number } | null {
  const shape = getShapeById(shapeId);
  if (!shape) {
    return null;
  }
  return {
    maxRow: Math.max(...shape.cells.map((cell) => cell.row)),
    maxColumn: Math.max(...shape.cells.map((cell) => cell.column)),
  };
}

type GameViewProps = {
  controller: GameController;
  /** Test seam: fixed board size, since onLayout doesn't fire in tests. */
  boardSize?: number;
  /** Invoked when the player leaves gameplay back to Home. */
  onExit?: () => void;
  /** Invoked to open the end-of-run results screen. */
  onResults?: () => void;
};

const SECOND_CHANCE_MS = 1500;
const SECOND_CHANCE_REDUCED_MS = 800;

/** Presentational gameplay screen over a supplied controller. Holds no
 *  gameplay rules — every decision is delegated to the domain controller. */
export function GameView({ controller, boardSize, onExit, onResults }: GameViewProps) {
  const { state } = controller;
  const haptics = useHaptics();
  const reducedMotion = useEffectiveReducedMotion();
  const animator = useEventAnimator({
    turn: state.turn,
    events: controller.lastEvents,
    reducedMotion,
  });
  const audio = useAudio();
  // Event-driven sound + music: plays each turn's effects once, loops music
  // while the game screen is mounted (both gated by persisted settings).
  useGameAudio({ turn: state.turn, events: controller.lastEvents, status: state.status });
  const reward = useRewardedAction();

  const [paused, setPaused] = useState(false);
  // Input is locked during a required effect sequence, while a rewarded ad is
  // in flight, and while paused, so a reward can't overlap a placement or
  // another reward and no move lands behind the pause menu.
  const inputLocked = animator.isAnimating || reward.pending || paused;

  const [defuseConfirmOpen, setDefuseConfirmOpen] = useState(false);
  const [secondChance, setSecondChance] = useState(false);
  const secondChanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewOrigin, setPreviewOrigin] = useState<CellPosition | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOrigin, setDragOrigin] = useState<CellPosition | null>(null);
  const [returning, setReturning] = useState(false);
  const [cellSize, setCellSize] = useState(boardSize ? boardSizeToCell(boardSize) : 0);

  const boardRef = useRef<View>(null);
  const ghostRef = useRef<DragGhostHandle>(null);
  const boardLayoutRef = useRef<BoardLayout | null>(null);
  const cellSizeRef = useRef(cellSize);
  const lastDragOriginRef = useRef<CellPosition | null>(null);

  const badges = useMemo(() => getTimerBadgePlacements(state), [state]);

  // Cells of the piece placed on the current turn drive the placement "snap".
  const placement = useMemo(() => {
    const event = controller.lastEvents.find((candidate) => candidate.type === "piecePlaced");
    return event && event.type === "piecePlaced"
      ? { cells: event.cells, nonce: state.turn }
      : { cells: [] as CellPosition[], nonce: 0 };
  }, [controller.lastEvents, state.turn]);

  const dragPreview = drag && dragOrigin ? controller.previewFor(drag.handId, dragOrigin) : null;
  const tapPreview = previewOrigin ? controller.previewAt(previewOrigin) : null;
  const preview = dragPreview ?? tapPreview;

  const handleCellSizeChange = useCallback((size: number) => {
    cellSizeRef.current = size;
    setCellSize(size);
  }, []);

  const handleSelect = useCallback(
    (handId: string) => {
      if (inputLocked) {
        return;
      }
      setPreviewOrigin(null);
      const wasSelected = controller.selectedHandId === handId;
      controller.selectPiece(handId);
      if (!wasSelected) {
        haptics.selection();
        audio.playSfx("selection");
      }
    },
    [audio, controller, haptics, inputLocked],
  );

  const handleCellPress = useCallback(
    (position: CellPosition) => {
      if (inputLocked || controller.selectedHandId === null) {
        return;
      }
      if (controller.placeAt(position)) {
        // Placement sound comes from the piecePlaced event (useGameAudio).
        setPreviewOrigin(null);
        haptics.success();
      } else {
        // Rejected by the domain: show exactly where the attempt conflicts.
        setPreviewOrigin(position);
        haptics.warning();
        audio.playSfx("invalid");
      }
    },
    [audio, controller, haptics, inputLocked],
  );

  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y, _width, _height) => {
      const size = cellSizeRef.current;
      if (size <= 0) {
        boardLayoutRef.current = null;
        return;
      }
      boardLayoutRef.current = {
        contentLeft: x + BOARD_CONTENT_INSET,
        contentTop: y + BOARD_CONTENT_INSET,
        cellSize: size,
        pitch: size + spacing.gridGutter,
        size: BOARD_SIZE,
      };
    });
  }, []);

  const originForPoint = useCallback((shapeId: string, point: Point): CellPosition | null => {
    const layout = boardLayoutRef.current;
    const bounds = shapeBoundsFor(shapeId);
    if (!layout || !bounds) {
      return null;
    }
    return dragOriginFromFinger(point, bounds, DRAG_LIFT, layout);
  }, []);

  const handleDragStart = useCallback(
    (handId: string, point: Point) => {
      const piece = state.hand.find((candidate) => candidate.handId === handId);
      if (inputLocked || !piece || cellSizeRef.current <= 0) {
        return;
      }
      controller.clearSelection();
      setPreviewOrigin(null);
      measureBoard();
      lastDragOriginRef.current = null;
      setDragOrigin(null);
      setDrag({
        handId,
        shapeId: piece.shapeId,
        colorId: piece.colorId,
        startX: point.x,
        startY: point.y,
      });
      haptics.selection();
    },
    [controller, haptics, inputLocked, measureBoard, state.hand],
  );

  const handleDragMove = useCallback(
    (handId: string, point: Point) => {
      ghostRef.current?.moveTo(point.x, point.y);
      const piece = state.hand.find((candidate) => candidate.handId === handId);
      if (!piece) {
        return;
      }
      const origin = originForPoint(piece.shapeId, point);
      const last = lastDragOriginRef.current;
      const changed =
        (origin === null) !== (last === null) ||
        (origin !== null &&
          last !== null &&
          (origin.row !== last.row || origin.column !== last.column));
      if (changed) {
        lastDragOriginRef.current = origin;
        setDragOrigin(origin);
      }
    },
    [originForPoint, state.hand],
  );

  const clearDrag = useCallback(() => {
    setDrag(null);
    setDragOrigin(null);
    setReturning(false);
    lastDragOriginRef.current = null;
  }, []);

  const handleDragEnd = useCallback(
    (handId: string, point: Point) => {
      const piece = state.hand.find((candidate) => candidate.handId === handId);
      const origin = piece ? originForPoint(piece.shapeId, point) : null;
      // A duplicated finalize is a no-op: the piece is already gone from the
      // hand, so the domain rejects the second attempt.
      const placed = origin ? controller.place(handId, origin) : false;
      if (placed) {
        haptics.success();
        clearDrag();
      } else {
        // Dropped outside the board or onto an invalid cell: play the return
        // animation, which clears the drag on completion.
        haptics.warning();
        audio.playSfx("invalid");
        setReturning(true);
      }
    },
    [audio, clearDrag, controller, haptics, originForPoint, state.hand],
  );

  const handleFreeze = useCallback(() => {
    // Guard against re-activation while active/exhausted or mid-reward — the
    // domain would reject anyway, but this avoids a needless ad request.
    if (inputLocked || !canActivateFreeze(state)) {
      return;
    }
    audio.playSfx("button");
    void reward.run("rewarded_freeze", () => {
      if (controller.activateFreeze()) {
        haptics.success();
        audio.playSfx("freeze");
      }
    });
  }, [audio, controller, haptics, inputLocked, reward, state]);

  const handleDefuseOpen = useCallback(() => {
    if (inputLocked || !canApplyRewardedDefuse(state)) {
      return;
    }
    controller.clearSelection();
    setPreviewOrigin(null);
    setDefuseConfirmOpen(true);
    haptics.selection();
    audio.playSfx("button");
  }, [audio, controller, haptics, inputLocked, state]);

  const handleDefuseCancel = useCallback(() => {
    audio.playSfx("button");
    setDefuseConfirmOpen(false);
  }, [audio]);

  const handleDefuseConfirm = useCallback(() => {
    if (reward.pending) {
      return;
    }
    audio.playSfx("button");
    void reward
      .run("rewarded_defuse", () => {
        if (controller.defuse()) {
          haptics.success();
          audio.playSfx("defuse");
        }
      })
      .finally(() => {
        setDefuseConfirmOpen(false);
      });
  }, [audio, controller, haptics, reward]);

  const clearSecondChance = useCallback(() => {
    if (secondChanceTimer.current !== null) {
      clearTimeout(secondChanceTimer.current);
      secondChanceTimer.current = null;
    }
    setSecondChance(false);
  }, []);

  const handleRevive = useCallback(() => {
    if (reward.pending || !canRevive(state)) {
      return;
    }
    audio.playSfx("button");
    void reward.run("rewarded_revive", () => {
      if (controller.revive()) {
        haptics.success();
        audio.playSfx("revive");
        // "SECOND CHANCE" banner over the repaired board (Stitch 10), then
        // auto-dismiss. Reduced motion shortens the hold and skips the fade.
        setSecondChance(true);
        if (secondChanceTimer.current !== null) {
          clearTimeout(secondChanceTimer.current);
        }
        secondChanceTimer.current = setTimeout(
          () => {
            secondChanceTimer.current = null;
            setSecondChance(false);
          },
          reducedMotion ? SECOND_CHANCE_REDUCED_MS : SECOND_CHANCE_MS,
        );
      }
    });
  }, [audio, controller, haptics, reducedMotion, reward, state]);

  const handleEndRun = useCallback(() => {
    if (reward.pending) {
      return;
    }
    audio.playSfx("button");
    clearSecondChance();
    onResults?.();
  }, [audio, clearSecondChance, onResults, reward.pending]);

  const handlePause = useCallback(() => {
    // Pausing mid-reward is disallowed so the confirm/overlay stack stays sane.
    if (reward.pending) {
      return;
    }
    audio.playSfx("button");
    setPaused(true);
  }, [audio, reward.pending]);

  const handleResume = useCallback(() => {
    audio.playSfx("button");
    setPaused(false);
  }, [audio]);

  // Drop every transient overlay/selection so a fresh run starts clean. Shared
  // by Restart (pause menu) and leaving to Home.
  const clearPendingUi = useCallback(() => {
    setPaused(false);
    setDefuseConfirmOpen(false);
    setPreviewOrigin(null);
    clearSecondChance();
    clearDrag();
    animator.reset();
  }, [animator, clearDrag, clearSecondChance]);

  const handleRestart = useCallback(() => {
    audio.playSfx("button");
    clearPendingUi();
    controller.restart();
  }, [audio, clearPendingUi, controller]);

  const handleHome = useCallback(() => {
    audio.playSfx("button");
    clearPendingUi();
    onExit?.();
  }, [audio, clearPendingUi, onExit]);

  // Cancel a pending second-chance timer on unmount.
  useEffect(() => () => clearSecondChance(), [clearSecondChance]);

  const freezeActive = state.freezeTurnsRemaining > 0;
  const defuseTarget = defuseConfirmOpen ? getRewardedDefuseTarget(state) : null;

  return (
    <View style={styles.screen} testID="game-screen">
      <SafeAreaView style={styles.safe}>
        {/* Best score is persisted in Phase 5; 0 stub until StorageService lands. */}
        <ScoreHeader score={state.score} best={0} combo={state.combo} onPause={handlePause} />
        <View style={styles.content}>
          <GameBoard
            ref={boardRef}
            grid={state.grid}
            badges={badges}
            boardSize={boardSize}
            preview={preview}
            onCellPress={handleCellPress}
            onCellSizeChange={handleCellSizeChange}
            placedCells={placement.cells}
            placementNonce={placement.nonce}
            effectPlan={animator.plan}
            effectKey={animator.effectKey}
            highlightPieceId={defuseTarget?.id ?? null}
            reducedMotion={reducedMotion}
          />
          <PieceTray
            hand={state.hand}
            selectedHandId={controller.selectedHandId}
            onSelect={handleSelect}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            draggingHandId={drag?.handId ?? null}
          />
          <RewardedActionBar
            freeze={{
              onPress: handleFreeze,
              disabled: inputLocked || !canActivateFreeze(state),
              active: freezeActive,
              placementsRemaining: state.freezeTurnsRemaining,
            }}
            defuse={{
              onPress: handleDefuseOpen,
              disabled: inputLocked || (!defuseConfirmOpen && !canApplyRewardedDefuse(state)),
              selected: defuseConfirmOpen,
            }}
          />
        </View>
        {defuseConfirmOpen ? (
          <DefuseConfirmCard
            onConfirm={handleDefuseConfirm}
            onCancel={handleDefuseCancel}
            busy={reward.pending}
          />
        ) : null}
        {secondChance ? <SecondChanceBanner reducedMotion={reducedMotion} /> : null}
        {paused ? (
          <PauseOverlay
            onResume={handleResume}
            onRestart={handleRestart}
            onHome={handleHome}
            reducedMotion={reducedMotion}
          />
        ) : null}
        {state.status === "gameOver" ? (
          <GameOverOverlay
            score={state.score}
            reviveAvailable={canRevive(state)}
            onRevive={handleRevive}
            onEndRun={handleEndRun}
            busy={reward.pending}
          />
        ) : null}
      </SafeAreaView>
      {drag && cellSize > 0 ? (
        <DragGhost
          ref={ghostRef}
          shapeId={drag.shapeId}
          colorId={drag.colorId}
          cellSize={cellSize}
          initialX={drag.startX}
          initialY={drag.startY}
          valid={dragPreview?.valid ?? false}
          returning={returning}
          reducedMotion={reducedMotion}
          onReturnComplete={clearDrag}
        />
      ) : null}
    </View>
  );
}

type GameScreenContentProps = {
  controllerOptions?: GameControllerOptions;
  boardSize?: number;
  /** Test seam: inject a scripted ad service to exercise reward branches. */
  adService?: AdService;
  /** Test seam: inject a recording audio service to assert sound triggers. */
  audioService?: AudioService;
  onExit?: () => void;
  onResults?: () => void;
};

/** Test entry point: builds a controller from injected options so a crafted
 *  run can be exercised without the session provider. Wraps the storage,
 *  settings, audio, and ad providers GameView depends on, all injectable. */
export function GameScreenContent({
  controllerOptions,
  boardSize,
  adService,
  audioService,
  onExit,
  onResults,
}: GameScreenContentProps) {
  const controller = useGameController(controllerOptions);
  const storage = useMemo(() => createMemoryStorageService(), []);
  return (
    <StorageServiceProvider service={storage}>
      <SettingsProvider>
        <AudioServiceProvider service={audioService}>
          <AdServiceProvider service={adService}>
            <GameView
              controller={controller}
              boardSize={boardSize}
              onExit={onExit}
              onResults={onResults}
            />
          </AdServiceProvider>
        </AudioServiceProvider>
      </SettingsProvider>
    </StorageServiceProvider>
  );
}

/** Content cell size implied by a fixed outer board size (test seam parity
 *  with GameBoard's own computation). */
function boardSizeToCell(outerSize: number): number {
  const contentSize = outerSize - 2 * BOARD_CONTENT_INSET;
  return (contentSize - (BOARD_SIZE - 1) * spacing.gridGutter) / BOARD_SIZE;
}

export default function GameScreen() {
  const router = useRouter();
  const { controller } = useGameSession();
  const handleExit = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router]);
  const handleResults = useCallback(() => {
    router.push("/results");
  }, [router]);
  return <GameView controller={controller} onExit={handleExit} onResults={handleResults} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.lg,
  },
});
