import { forwardRef, memo, useEffect, useMemo, useState } from "react";
import { Animated, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import type { PlacementPreview, TimerBadgePlacement } from "../../domain/selectors";
import type { CellPosition } from "../../domain/placement";
import { BOARD_CONTENT_INSET, FRAME_WIDTH } from "../../ui/boardGeometry";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { getTimerVisualState } from "../../ui/timerStates";
import { radius, spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { GridCell, contourMaskOf, type CellEdges, type CellPreviewState } from "../GridCell";
import { TimerBadge } from "../TimerBadge";

type GameBoardProps = {
  grid: readonly (readonly DomainGridCell[])[];
  badges: readonly TimerBadgePlacement[];
  /** Optional fixed content size (mostly for tests); defaults to measuring. */
  boardSize?: number;
  preview?: PlacementPreview | null;
  onCellPress?: (position: CellPosition) => void;
  /** Reports the computed cell edge length whenever it changes, so the screen
   *  can map finger coordinates to board cells during a drag. */
  onCellSizeChange?: (cellSize: number) => void;
  /** Cells of the most recently placed piece, flashed with a settle "snap". */
  placedCells?: readonly CellPosition[];
  /** Bumped each placement so the snap replays even on the same cells. */
  placementNonce?: number;
  /** Number of explosions in the turn currently being animated, paired with
   *  `effectKey` to retrigger the board's single shake. Deliberately NOT the
   *  whole effect plan: the cosmetic overlay is a sibling of the board, so a
   *  plan change must not re-render all 64 cells. */
  explosionCount?: number;
  /** Increments per sequence so the shake retriggers on a repeated explosion. */
  effectKey?: number;
  /** Timed piece to ring as the rewarded-defuse target (Stitch 07); its cells
   *  get a solid cyan highlight while the confirm card is open. */
  highlightPieceId?: string | null;
  /** Effective reduced-motion (OS combined with the persisted override). When
   *  omitted, falls back to the OS setting alone. */
  reducedMotion?: boolean;
  /** True while the run's rewarded freeze is active — pauses the countdown and
   *  puts every timer badge into its frozen (icy, static) cue. */
  frozen?: boolean;
  /** Per-empty-cell anchor validity for the currently selected piece, keyed
   *  "row,column", from the domain's placement preview. Null/absent when no
   *  piece is selected. Drives each empty cell's placement hint for assistive
   *  tech — read-only presentation data, never a gameplay input. */
  placementHints?: ReadonlyMap<string, "valid" | "invalid"> | null;
};

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
    boardSize,
    preview,
    onCellPress,
    onCellSizeChange,
    placedCells,
    placementNonce,
    explosionCount = 0,
    effectKey,
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
  const [shake] = useState(() => new Animated.Value(0));
  const rows = grid.length;
  const columns = grid[0]?.length ?? 0;

  // Subtle single board shake on an explosion turn (skipped under reduced
  // motion); keyed on effectKey so it retriggers each explosion sequence.
  useEffect(() => {
    if (explosionCount === 0 || reducedMotion) {
      shake.setValue(0);
      return;
    }
    const animation = Animated.sequence([
      Animated.timing(shake, { toValue: -4, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 4, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -3, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      shake.setValue(0);
    };
  }, [effectKey, explosionCount, reducedMotion, shake]);

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
    <Animated.View
      ref={ref}
      style={[
        styles.board,
        { backgroundColor: theme.boardBg, borderColor: theme.boardFrame },
        // Only bind the shake transform when motion is allowed. Under reduced
        // motion the shake never animates, so an identity transform would only
        // promote this rounded board (and its rounded cell/rubble children) to
        // an Android hardware layer for no benefit — the black-render trap.
        reducedMotion ? undefined : { transform: [{ translateX: shake }] },
      ]}
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
    </Animated.View>
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
