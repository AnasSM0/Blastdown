import { forwardRef, memo, useEffect, useState } from "react";
import { Animated, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import type { PlacementPreview, TimerBadgePlacement } from "../../domain/selectors";
import type { CellPosition } from "../../domain/placement";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import type { EffectPlan } from "../../ui/effects/eventEffects";
import { radius, spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { EffectsLayer } from "../effects/EffectsLayer";
import { GridCell, type CellPreviewState } from "../GridCell";
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
  /** Cosmetic effect plan for the current turn's clear/defuse/explosion, or
   *  null when idle. Rendered as an overlay positioned from the cell size. */
  effectPlan?: EffectPlan | null;
  /** Increments per sequence so the overlay remounts instead of interpolating. */
  effectKey?: number;
  /** Timed piece to ring as the rewarded-defuse target (Stitch 07); its cells
   *  get a solid cyan highlight while the confirm card is open. */
  highlightPieceId?: string | null;
  /** Effective reduced-motion (OS combined with the persisted override). When
   *  omitted, falls back to the OS setting alone. */
  reducedMotion?: boolean;
};

const FRAME_WIDTH = 2;

/** Corner-accent geometry (P1-3). Short, thin brackets inset just inside the
 *  frame; purely decorative and non-interactive. */
const CORNER_LENGTH = 12;
const CORNER_THICKNESS = 2;
const CORNER_INSET = 3;

/** Frame + gutter offset from the board's outer edge to the first cell's
 *  edge — the screen adds this to the measured window origin to locate the
 *  playable content area. */
export const BOARD_CONTENT_INSET = FRAME_WIDTH + spacing.gridGutter;

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
    effectPlan,
    effectKey,
    highlightPieceId,
    reducedMotion: reducedMotionProp,
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
  const explosionCount = effectPlan?.explosions.length ?? 0;
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

  const placedSet = new Set((placedCells ?? []).map((cell) => `${cell.row},${cell.column}`));

  const previewMap = new Map<string, CellPreviewState>();
  if (preview) {
    for (const cell of preview.cells) {
      previewMap.set(`${cell.row},${cell.column}`, preview.valid ? "valid" : "invalid");
    }
    for (const cell of preview.conflictCells) {
      previewMap.set(`${cell.row},${cell.column}`, "conflict");
    }
  }

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
        { transform: [{ translateX: shake }] },
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
                    onPress={onCellPress ? () => onCellPress({ row, column }) : undefined}
                    flashNonce={placedSet.has(`${row},${column}`) ? placementNonce : undefined}
                    reducedMotion={reducedMotion}
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
              />
            </View>
          ))
        : null}
      {effectPlan && cellSize > 0 ? (
        <EffectsLayer
          key={effectKey}
          plan={effectPlan}
          cellSize={cellSize}
          reducedMotion={reducedMotion}
        />
      ) : null}
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
