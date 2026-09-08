import { forwardRef, memo, useEffect, useMemo, useState } from "react";
import { Animated, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import { BOARD_CONTENT_INSET, FRAME_WIDTH } from "../../ui/boardGeometry";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { getTimerVisualState } from "../../ui/timerStates";
import { radius, spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { GridCell, contourMaskOf, type CellEdges, type CellPreviewState } from "../GridCell";
import { TimerBadge } from "../TimerBadge";
import { BoardDangerLighting } from "../BoardDangerLighting";
import { CALM_DANGER_STATE } from "../../ui/dangerState";
import { PRE_CLEAR_PULSE_MIN, PRE_CLEAR_PULSE_MS, preClearVisual } from "../../ui/preClearPreview";
import type { GameBoardProps } from "./boardProps";

/** Boundary sides of a timed cell within its piece: a side is a boundary when
 *  its neighbor is not the same timed piece. Reads only the cells' existing
 *  `pieceInstanceId` — no grouping is reconstructed, just adjacency-checked.
 *  Returns undefined for non-timed cells (no contour). */
function contourEdgesFor(
  grid: readonly (readonly DomainGridCell[])[],
  row: number,
  column: number,
): CellEdges | undefined {
  const cell = grid[row][column];
  if (cell.kind !== "timed") {
    return undefined;
  }
  const id = cell.pieceInstanceId;
  const samePiece = (r: number, c: number): boolean => {
    const neighbor = grid[r]?.[c];
    return neighbor?.kind === "timed" && neighbor.pieceInstanceId === id;
  };
  return {
    top: !samePiece(row - 1, column),
    right: !samePiece(row, column + 1),
    bottom: !samePiece(row + 1, column),
    left: !samePiece(row, column - 1),
  };
}

/** Corner-accent geometry (P1-3). Short, thin brackets inset just inside the
 *  frame; purely decorative and non-interactive. */
const CORNER_LENGTH = 12;
const CORNER_THICKNESS = 2;
const CORNER_INSET = 3;

// FRAME_WIDTH and BOARD_CONTENT_INSET now live in ../../ui/boardGeometry (the
// neutral module) so EffectsLayer can share them without importing this
// component's barrel — which formed a require cycle. Re-exported (from the
// imported binding) for the screen that reads it via the GameBoard barrel.
export { BOARD_CONTENT_INSET };

function GameBoardImpl(
  {
    grid,
    badges,
    danger = CALM_DANGER_STATE,
    boardSize,
    preview,
    onCellPress,
    onCellPreviewChange,
    onCellSizeChange,
    placedCells,
    placementNonce,
    highlightPieceId,
    reducedMotion: reducedMotionProp,
    frozen = false,
    placementHints,
  }: GameBoardProps,
  ref: React.ForwardedRef<View>,
) {
  const theme = useTheme();
  const [measured, setMeasured] = useState(0);
  const osReducedMotion = useReducedMotion();
  const reducedMotion = reducedMotionProp ?? osReducedMotion;
  const [preClearPulse] = useState(() => new Animated.Value(1));
  const rows = grid.length;
  const columns = grid[0]?.length ?? 0;
  const showPreClear = Boolean(
    preview?.valid && (preview.clear.rows.length > 0 || preview.clear.columns.length > 0),
  );

  // A single driver animates every predicted lane. It starts/stops only when
  // prediction presence changes, never for every pointer pixel or board cell.
  useEffect(() => {
    if (!showPreClear || reducedMotion) {
      preClearPulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(preClearPulse, {
          toValue: PRE_CLEAR_PULSE_MIN,
          duration: PRE_CLEAR_PULSE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(preClearPulse, {
          toValue: 1,
          duration: PRE_CLEAR_PULSE_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      preClearPulse.setValue(1);
    };
  }, [preClearPulse, reducedMotion, showPreClear]);

  // Derived lookups, each memoized on the one input it actually depends on, so
  // a board re-render for an unrelated reason (a preview change, a freeze
  // toggle) doesn't rebuild all of them.
  const placedSet = useMemo(
    () => new Set((placedCells ?? []).map((cell) => `${cell.row},${cell.column}`)),
    [placedCells],
  );

  // Pieces whose countdown is urgent, from the badge data already supplied —
  // drives the "critical" block material on their cells. Reuses the existing
  // visual-state threshold; no new timer logic or piece grouping is introduced.
  const criticalPieceIds = useMemo(
    () =>
      new Set(
        badges
          .filter((badge) => getTimerVisualState(badge.remainingTurns) === "urgent")
          .map((badge) => badge.pieceId),
      ),
    [badges],
  );

  // Remaining move count per timed piece, from the same badge data — announced
  // in each timed cell's accessibility label (never signaled by color alone).
  const remainingByPiece = useMemo(
    () => new Map(badges.map((badge) => [badge.pieceId, badge.remainingTurns])),
    [badges],
  );

  const previewMap = useMemo(() => {
    const map = new Map<string, CellPreviewState>();
    if (preview) {
      for (const cell of preview.cells) {
        map.set(`${cell.row},${cell.column}`, preview.valid ? "valid" : "invalid");
      }
      for (const cell of preview.conflictCells) {
        map.set(`${cell.row},${cell.column}`, "conflict");
      }
    }
    return map;
  }, [preview]);

  // Piece contours, packed per cell so each cell receives a primitive prop and
  // stays memoizable. Recomputed only when the grid itself changes.
  const contourMasks = useMemo(() => {
    const masks = new Map<string, number>();
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid[row].length; column++) {
        const edges = contourEdgesFor(grid, row, column);
        if (edges) {
          masks.set(`${row},${column}`, contourMaskOf(edges));
        }
      }
    }
    return masks;
  }, [grid]);

  const outerSize = boardSize ?? measured;
  const contentSize = outerSize - 2 * BOARD_CONTENT_INSET;
  const cellSize =
    columns > 0 && contentSize > 0
      ? (contentSize - (columns - 1) * spacing.gridGutter) / columns
      : 0;
  const contentSpan = columns > 0 ? columns * cellSize + (columns - 1) * spacing.gridGutter : 0;
  const preClear = useMemo(() => preClearVisual(theme), [theme]);

  useEffect(() => {
    if (cellSize > 0) {
      onCellSizeChange?.(cellSize);
    }
  }, [cellSize, onCellSizeChange]);

  const handleLayout = (event: LayoutChangeEvent) => {
    if (boardSize === undefined) {
      setMeasured(event.nativeEvent.layout.width);
    }
  };

  return (
    <View
      ref={ref}
      style={[styles.board, { backgroundColor: theme.boardBg, borderColor: theme.boardFrame }]}
      onLayout={handleLayout}
      collapsable={false}
      accessibilityLabel="Game board"
      testID="game-board"
    >
      {/* Frame depth (P1-3), all decorative and non-interactive, drawn BEHIND
          the cells within the frame/gutter zone so the playable area is never
          covered or reduced: a fine inner-border ring plus a subtle top inset
          highlight. Cheap static Views — no blur, animation, or shadow. */}
      <View
        pointerEvents="none"
        testID="board-frame-inner"
        style={[styles.frameInner, { borderColor: theme.boardFrameInner }]}
      />
      <View
        pointerEvents="none"
        style={[styles.frameBevel, { backgroundColor: theme.boardFrameBevel }]}
      />
      {cellSize > 0
        ? grid.map((rowCells, row) => (
            <View key={`row-${row}`} style={[styles.row, row < rows - 1 && styles.rowGap]}>
              {rowCells.map((cell, column) => (
                <View
                  key={`cell-${row}-${column}`}
                  style={column < columns - 1 ? styles.cellGap : undefined}
                >
                  <GridCell
                    cell={cell}
                    row={row}
                    column={column}
                    size={cellSize}
                    previewState={previewMap.get(`${row},${column}`)}
                    highlighted={
                      highlightPieceId != null &&
                      cell.kind === "timed" &&
                      cell.pieceInstanceId === highlightPieceId
                    }
                    critical={cell.kind === "timed" && criticalPieceIds.has(cell.pieceInstanceId)}
                    contourMask={contourMasks.get(`${row},${column}`)}
                    // One shared handler for all 64 cells — each cell reports
                    // its own position, so no per-cell closure is created.
                    onPress={onCellPress}
                    onPreviewChange={onCellPreviewChange}
                    flashNonce={placedSet.has(`${row},${column}`) ? placementNonce : undefined}
                    reducedMotion={reducedMotion}
                    placementState={
                      cell.kind === "empty"
                        ? (placementHints?.get(`${row},${column}`) ?? undefined)
                        : undefined
                    }
                    remainingTurns={
                      cell.kind === "timed" ? remainingByPiece.get(cell.pieceInstanceId) : undefined
                    }
                    frozen={frozen}
                  />
                </View>
              ))}
            </View>
          ))
        : null}
      {cellSize > 0 && showPreClear
        ? preview?.clear.rows.map((row) => (
            <Animated.View
              key={`preclear-row-${row}`}
              pointerEvents="none"
              testID={`preclear-row-${row}`}
              style={[
                styles.preClear,
                {
                  left: BOARD_CONTENT_INSET,
                  top: BOARD_CONTENT_INSET + row * (cellSize + spacing.gridGutter),
                  width: contentSpan,
                  height: cellSize,
                  backgroundColor: preClear.fill,
                  borderColor: preClear.edge,
                  borderWidth: preClear.edgeWidth,
                  opacity: reducedMotion ? 1 : preClearPulse,
                },
              ]}
            />
          ))
        : null}
      {cellSize > 0 && showPreClear
        ? preview?.clear.columns.map((column) => (
            <Animated.View
              key={`preclear-column-${column}`}
              pointerEvents="none"
              testID={`preclear-column-${column}`}
              style={[
                styles.preClear,
                {
                  left: BOARD_CONTENT_INSET + column * (cellSize + spacing.gridGutter),
                  top: BOARD_CONTENT_INSET,
                  width: cellSize,
                  height: contentSpan,
                  backgroundColor: preClear.fill,
                  borderColor: preClear.edge,
                  borderWidth: preClear.edgeWidth,
                  opacity: reducedMotion ? 1 : preClearPulse,
                },
              ]}
            />
          ))
        : null}
      {/* Small theme-aware corner accents (P1-3), drawn on top at the four
          board corners; thin and non-interactive so hit testing is untouched. */}
      <View pointerEvents="none" testID="board-frame-corners" style={styles.cornerLayer}>
        <View
          style={[
            styles.corner,
            styles.cornerTL,
            styles.cornerH,
            { backgroundColor: theme.boardFrameCorner },
          ]}
        />
        <View
          style={[
            styles.corner,
            styles.cornerTL,
            styles.cornerV,
            { backgroundColor: theme.boardFrameCorner },
          ]}
        />
        <View
          style={[
            styles.corner,
            styles.cornerTR,
            styles.cornerH,
            { backgroundColor: theme.boardFrameCorner },
          ]}
        />
        <View
          style={[
            styles.corner,
            styles.cornerTR,
            styles.cornerV,
            { backgroundColor: theme.boardFrameCorner },
          ]}
        />
        <View
          style={[
            styles.corner,
            styles.cornerBL,
            styles.cornerH,
            { backgroundColor: theme.boardFrameCorner },
          ]}
        />
        <View
          style={[
            styles.corner,
            styles.cornerBL,
            styles.cornerV,
            { backgroundColor: theme.boardFrameCorner },
          ]}
        />
        <View
          style={[
            styles.corner,
            styles.cornerBR,
            styles.cornerH,
            { backgroundColor: theme.boardFrameCorner },
          ]}
        />
        <View
          style={[
            styles.corner,
            styles.cornerBR,
            styles.cornerV,
            { backgroundColor: theme.boardFrameCorner },
          ]}
        />
      </View>
      {cellSize > 0
        ? badges.map((badge) => (
            <View
              key={badge.pieceId}
              pointerEvents="none"
              style={[
                styles.badgeAnchor,
                {
                  top:
                    FRAME_WIDTH +
                    spacing.gridGutter +
                    badge.position.row * (cellSize + spacing.gridGutter) -
                    8,
                  left:
                    FRAME_WIDTH +
                    spacing.gridGutter +
                    badge.position.column * (cellSize + spacing.gridGutter) -
                    8,
                },
              ]}
            >
              <TimerBadge
                pieceId={badge.pieceId}
                remainingTurns={badge.remainingTurns}
                colorId={badge.colorId}
                frozen={frozen}
                reducedMotion={reducedMotion}
              />
            </View>
          ))
        : null}
      <BoardDangerLighting danger={danger} reducedMotion={reducedMotion} />
    </View>
  );
}

export const GameBoard = memo(forwardRef<View, GameBoardProps>(GameBoardImpl));

const styles = StyleSheet.create({
  board: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    aspectRatio: 1,
    borderWidth: FRAME_WIDTH,
    borderRadius: radius.board,
    padding: spacing.gridGutter,
  },
  row: {
    flexDirection: "row",
  },
  rowGap: {
    marginBottom: spacing.gridGutter,
  },
  cellGap: {
    marginRight: spacing.gridGutter,
  },
  badgeAnchor: {
    position: "absolute",
    zIndex: 2,
  },
  preClear: {
    position: "absolute",
    zIndex: 1,
    borderRadius: radius.cell,
  },
  // A fine inner-border ring sitting just inside the outer frame, within the
  // gutter — draws structure without touching cell geometry.
  frameInner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.board - FRAME_WIDTH,
  },
  // Subtle top inset highlight — a thin light line along the inner top edge.
  frameBevel: {
    position: "absolute",
    top: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  cornerLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  corner: {
    position: "absolute",
    opacity: 0.85,
  },
  cornerH: {
    width: CORNER_LENGTH,
    height: CORNER_THICKNESS,
  },
  cornerV: {
    width: CORNER_THICKNESS,
    height: CORNER_LENGTH,
  },
  cornerTL: { top: CORNER_INSET, left: CORNER_INSET },
  cornerTR: { top: CORNER_INSET, right: CORNER_INSET },
  cornerBL: { bottom: CORNER_INSET, left: CORNER_INSET },
  cornerBR: { bottom: CORNER_INSET, right: CORNER_INSET },
});
