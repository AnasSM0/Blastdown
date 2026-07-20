import { forwardRef, memo, useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import type { PlacementPreview, TimerBadgePlacement } from "../../domain/selectors";
import type { CellPosition } from "../../domain/placement";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import type { EffectPlan } from "../../ui/effects/eventEffects";
import { colors, radius, spacing } from "../../ui/theme";
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
};

const FRAME_WIDTH = 2;

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
  }: GameBoardProps,
  ref: React.ForwardedRef<View>,
) {
  const [measured, setMeasured] = useState(0);
  const reducedMotion = useReducedMotion();
  const rows = grid.length;
  const columns = grid[0]?.length ?? 0;

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
    <View
      ref={ref}
      style={styles.board}
      onLayout={handleLayout}
      collapsable={false}
      accessibilityLabel="Game board"
      testID="game-board"
    >
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
                    onPress={onCellPress ? () => onCellPress({ row, column }) : undefined}
                    flashNonce={placedSet.has(`${row},${column}`) ? placementNonce : undefined}
                    reducedMotion={reducedMotion}
                  />
                </View>
              ))}
            </View>
          ))
        : null}
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
    backgroundColor: colors.boardBg,
    borderColor: colors.boardFrame,
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
});
