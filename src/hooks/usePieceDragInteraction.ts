import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { View } from "react-native";

import type { DragGhostHandle } from "../components/DragGhost";
import { BOARD_SIZE } from "../domain/board";
import type { CellPosition } from "../domain/placement";
import { getShapeById } from "../domain/shapes";
import type { PlacementPreview } from "../domain/selectors";
import {
  fingerPointForDragOrigin,
  stableDragOriginFromFinger,
  BOARD_CONTENT_INSET,
  type BoardLayout,
  type Point,
} from "../ui/boardGeometry";
import { dragLiftForCell } from "../ui/pieceInteraction";
import { spacing } from "../ui/theme";
import type { GameController, PlacementIntent } from "./useGameController";

export type PieceDragState = {
  id: number;
  handId: string;
  intent: PlacementIntent;
  shapeId: string;
  colorId: string;
  startX: number;
  startY: number;
  visualLift: number;
};

type ShapeBounds = { maxRow: number; maxColumn: number };

type UsePieceDragInteractionOptions = {
  controller: GameController;
  /** Fixed outer board size used by isolated tests. Production measures the ref. */
  boardSize?: number;
  /** Locks new gesture activation; an already active gesture can still finalize. */
  inputLocked?: boolean;
  /** Optional tutorial/input gate layered above the domain's placement rules. */
  isOriginAllowed?: (origin: CellPosition) => boolean;
  onDragStarted?: () => void;
  onPlaced?: (origin: CellPosition) => void;
  onInvalidDrop?: (origin: CellPosition | null) => void;
};

const shapeBoundsCache = new Map<string, ShapeBounds | null>();

function shapeBoundsFor(shapeId: string): ShapeBounds | null {
  const cached = shapeBoundsCache.get(shapeId);
  if (cached !== undefined) {
    return cached;
  }
  const shape = getShapeById(shapeId);
  let bounds: ShapeBounds | null = null;
  if (shape) {
    let maxRow = 0;
    let maxColumn = 0;
    for (const cell of shape.cells) {
      if (cell.row > maxRow) maxRow = cell.row;
      if (cell.column > maxColumn) maxColumn = cell.column;
    }
    bounds = { maxRow, maxColumn };
  }
  shapeBoundsCache.set(shapeId, bounds);
  return bounds;
}

/** Content cell size implied by a fixed outer board size. */
function boardSizeToCell(outerSize: number): number {
  const contentSize = outerSize - 2 * BOARD_CONTENT_INSET;
  return (contentSize - (BOARD_SIZE - 1) * spacing.gridGutter) / BOARD_SIZE;
}

/**
 * Shared tray-to-board drag lifecycle used by gameplay and the tutorial.
 * Placement always commits through GameController's captured intent pathway,
 * retaining stale-intent and duplicate-finalize protection in both surfaces.
 */
export function usePieceDragInteraction({
  controller,
  boardSize,
  inputLocked = false,
  isOriginAllowed,
  onDragStarted,
  onPlaced,
  onInvalidDrop,
}: UsePieceDragInteractionOptions) {
  const [drag, setDrag] = useState<PieceDragState | null>(null);
  const [dragOrigin, setDragOrigin] = useState<CellPosition | null>(null);
  const [returning, setReturning] = useState(false);
  const [cellSize, setCellSize] = useState(boardSize ? boardSizeToCell(boardSize) : 0);

  const boardRef = useRef<View>(null);
  const ghostRef = useRef<DragGhostHandle>(null);
  const boardLayoutRef = useRef<BoardLayout | null>(null);
  const cellSizeRef = useRef(cellSize);
  const lastDragOriginRef = useRef<CellPosition | null>(null);
  const dragRef = useRef<PieceDragState | null>(null);
  const visibleDragIdRef = useRef<number | null>(null);
  const dragSequenceRef = useRef(0);
  const dragFinalizedRef = useRef(false);
  const controllerRef = useRef(controller);
  const inputLockedRef = useRef(inputLocked);
  const isOriginAllowedRef = useRef(isOriginAllowed);
  const onDragStartedRef = useRef(onDragStarted);
  const onPlacedRef = useRef(onPlaced);
  const onInvalidDropRef = useRef(onInvalidDrop);

  useEffect(() => {
    controllerRef.current = controller;
    inputLockedRef.current = inputLocked;
    isOriginAllowedRef.current = isOriginAllowed;
    onDragStartedRef.current = onDragStarted;
    onPlacedRef.current = onPlaced;
    onInvalidDropRef.current = onInvalidDrop;
  });

  const handleCellSizeChange = useCallback((size: number) => {
    cellSizeRef.current = size;
    setCellSize(size);
  }, []);

  const measureBoard = useCallback(() => {
    const captureLayout = (x: number, y: number) => {
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
    };
    if (boardSize !== undefined) {
      captureLayout(0, 0);
      return;
    }
    boardRef.current?.measureInWindow((x, y) => captureLayout(x, y));
  }, [boardSize]);

  const originForPoint = useCallback(
    (
      shapeId: string,
      point: Point,
      visualLift: number,
      previous: CellPosition | null,
    ): CellPosition | null => {
      const layout = boardLayoutRef.current;
      const bounds = shapeBoundsFor(shapeId);
      return layout && bounds
        ? stableDragOriginFromFinger(point, bounds, visualLift, layout, previous)
        : null;
    },
    [],
  );

  const ghostPointForOrigin = useCallback(
    (shapeId: string, origin: CellPosition, visualLift: number): Point | null => {
      const layout = boardLayoutRef.current;
      const bounds = shapeBoundsFor(shapeId);
      return layout && bounds ? fingerPointForDragOrigin(origin, bounds, visualLift, layout) : null;
    },
    [],
  );

  const dragPreview = useMemo<PlacementPreview | null>(() => {
    if (!drag || !dragOrigin) {
      return null;
    }
    const preview = controller.previewFor(drag.intent, dragOrigin);
    if (!preview || isOriginAllowed?.(dragOrigin) !== false) {
      return preview;
    }
    return {
      ...preview,
      valid: false,
      cells: [],
      conflictCells: preview.cells,
    };
  }, [controller, drag, dragOrigin, isOriginAllowed]);

  const clearDrag = useCallback((expectedId?: number) => {
    if (expectedId !== undefined && visibleDragIdRef.current !== expectedId) {
      return;
    }
    visibleDragIdRef.current = null;
    dragRef.current = null;
    dragFinalizedRef.current = false;
    lastDragOriginRef.current = null;
    setDrag(null);
    setDragOrigin(null);
    setReturning(false);
  }, []);

  const handleDragStart = useCallback(
    (handId: string, point: Point) => {
      const activeController = controllerRef.current;
      const piece = activeController.state.hand.find((candidate) => candidate.handId === handId);
      const intent = activeController.createPlacementIntent(handId);
      if (
        inputLockedRef.current ||
        dragRef.current !== null ||
        !piece ||
        !intent ||
        cellSizeRef.current <= 0
      ) {
        return;
      }
      activeController.clearSelection();
      onDragStartedRef.current?.();
      measureBoard();
      lastDragOriginRef.current = null;
      setDragOrigin(null);
      dragFinalizedRef.current = false;
      const visualLift = dragLiftForCell(cellSizeRef.current);
      const nextDrag: PieceDragState = {
        id: ++dragSequenceRef.current,
        handId,
        intent,
        shapeId: piece.shapeId,
        colorId: piece.colorId,
        startX: point.x,
        startY: point.y,
        visualLift,
      };
      dragRef.current = nextDrag;
      visibleDragIdRef.current = nextDrag.id;
      setReturning(false);
      setDrag(nextDrag);
    },
    [measureBoard],
  );

  const handleDragMove = useCallback(
    (handId: string, point: Point) => {
      const activeDrag = dragRef.current;
      if (!activeDrag || activeDrag.handId !== handId || dragFinalizedRef.current) {
        return;
      }
      const last = lastDragOriginRef.current;
      const origin = originForPoint(activeDrag.shapeId, point, activeDrag.visualLift, last);
      const snappedPoint = origin
        ? ghostPointForOrigin(activeDrag.shapeId, origin, activeDrag.visualLift)
        : null;
      ghostRef.current?.moveTo(snappedPoint?.x ?? point.x, snappedPoint?.y ?? point.y);
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
    [ghostPointForOrigin, originForPoint],
  );

  const handleDragEnd = useCallback(
    (handId: string, point: Point) => {
      const activeDrag = dragRef.current;
      if (!activeDrag || activeDrag.handId !== handId || dragFinalizedRef.current) {
        return;
      }
      dragFinalizedRef.current = true;
      const origin = originForPoint(
        activeDrag.shapeId,
        point,
        activeDrag.visualLift,
        lastDragOriginRef.current,
      );
      lastDragOriginRef.current = null;
      setDragOrigin(null);
      const placed =
        origin !== null && isOriginAllowedRef.current?.(origin) !== false
          ? controllerRef.current.place(activeDrag.intent, origin)
          : false;
      if (placed && origin) {
        onPlacedRef.current?.(origin);
        clearDrag(activeDrag.id);
      } else {
        onInvalidDropRef.current?.(origin);
        dragRef.current = null;
        setReturning(true);
      }
    },
    [clearDrag, originForPoint],
  );

  const handleDragCancel = useCallback((handId: string) => {
    const activeDrag = dragRef.current;
    if (!activeDrag || activeDrag.handId !== handId || dragFinalizedRef.current) {
      return;
    }
    dragFinalizedRef.current = true;
    dragRef.current = null;
    lastDragOriginRef.current = null;
    setDragOrigin(null);
    setReturning(true);
  }, []);

  // Hydrate/restart/placement commits invalidate captured intents and ghosts.
  useEffect(() => {
    if (visibleDragIdRef.current !== null) {
      clearDrag();
    }
    // State identity changes only at an authoritative controller commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller.state]);

  return {
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
  };
}
