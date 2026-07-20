import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { GameBoard, BOARD_CONTENT_INSET } from "../src/components/GameBoard";
import { PieceTray } from "../src/components/PieceTray";
import { ScoreHeader } from "../src/components/ScoreHeader";
import { GameOverOverlay } from "../src/components/modals/GameOverOverlay";
import { RewardedActionBar } from "../src/components/RewardedActionButton";
import { DragGhost, DRAG_LIFT, type DragGhostHandle } from "../src/components/DragGhost";
import { BOARD_SIZE } from "../src/domain/board";
import type { CellPosition } from "../src/domain/placement";
import { getShapeById } from "../src/domain/shapes";
import { getTimerBadgePlacements } from "../src/domain/selectors";
import { dragOriginFromFinger, type BoardLayout, type Point } from "../src/ui/boardGeometry";
import {
  useGameController,
  type GameController,
  type GameControllerOptions,
} from "../src/hooks/useGameController";
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
};

/** Presentational gameplay screen over a supplied controller. Holds no
 *  gameplay rules — every decision is delegated to the domain controller. */
export function GameView({ controller, boardSize, onExit }: GameViewProps) {
  const { state } = controller;

  const [previewOrigin, setPreviewOrigin] = useState<CellPosition | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOrigin, setDragOrigin] = useState<CellPosition | null>(null);
  const [cellSize, setCellSize] = useState(boardSize ? boardSizeToCell(boardSize) : 0);

  const boardRef = useRef<View>(null);
  const ghostRef = useRef<DragGhostHandle>(null);
  const boardLayoutRef = useRef<BoardLayout | null>(null);
  const cellSizeRef = useRef(cellSize);
  const lastDragOriginRef = useRef<CellPosition | null>(null);

  const badges = useMemo(() => getTimerBadgePlacements(state), [state]);

  const dragPreview = drag && dragOrigin ? controller.previewFor(drag.handId, dragOrigin) : null;
  const tapPreview = previewOrigin ? controller.previewAt(previewOrigin) : null;
  const preview = dragPreview ?? tapPreview;

  const handleCellSizeChange = useCallback((size: number) => {
    cellSizeRef.current = size;
    setCellSize(size);
  }, []);

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
      if (!piece || cellSizeRef.current <= 0) {
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
    },
    [controller, measureBoard, state.hand],
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
    lastDragOriginRef.current = null;
  }, []);

  const handleDragEnd = useCallback(
    (handId: string, point: Point) => {
      const piece = state.hand.find((candidate) => candidate.handId === handId);
      const origin = piece ? originForPoint(piece.shapeId, point) : null;
      if (origin) {
        // A duplicated finalize is a no-op: the piece is already gone from
        // the hand, so the domain rejects the second attempt.
        controller.place(handId, origin);
      }
      clearDrag();
    },
    [clearDrag, controller, originForPoint, state.hand],
  );

  const handleRestart = useCallback(() => {
    setPreviewOrigin(null);
    clearDrag();
    controller.restart();
  }, [clearDrag, controller]);

  return (
    <View style={styles.screen} testID="game-screen">
      <SafeAreaView style={styles.safe}>
        {/* Best score is persisted in Phase 5; 0 stub until StorageService lands. */}
        <ScoreHeader
          score={state.score}
          best={0}
          combo={state.combo}
          onPause={onExit ?? (() => {})}
        />
        <View style={styles.content}>
          <GameBoard
            ref={boardRef}
            grid={state.grid}
            badges={badges}
            boardSize={boardSize}
            preview={preview}
            onCellPress={handleCellPress}
            onCellSizeChange={handleCellSizeChange}
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
          <RewardedActionBar />
        </View>
        {state.status === "gameOver" ? (
          <GameOverOverlay score={state.score} onRestart={handleRestart} />
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
        />
      ) : null}
    </View>
  );
}

type GameScreenContentProps = {
  controllerOptions?: GameControllerOptions;
  boardSize?: number;
};

/** Test entry point: builds a controller from injected options so a crafted
 *  run can be exercised without the session provider. */
export function GameScreenContent({ controllerOptions, boardSize }: GameScreenContentProps) {
  const controller = useGameController(controllerOptions);
  return <GameView controller={controller} boardSize={boardSize} />;
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
  return <GameView controller={controller} onExit={handleExit} />;
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
