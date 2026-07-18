import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import type { PlacementPreview, TimerBadgePlacement } from "../../domain/selectors";
import type { CellPosition } from "../../domain/placement";
import { colors, radius, spacing } from "../../ui/theme";
import { GridCell, type CellPreviewState } from "../GridCell";
import { TimerBadge } from "../TimerBadge";

type GameBoardProps = {
  grid: readonly (readonly DomainGridCell[])[];
  badges: readonly TimerBadgePlacement[];
  /** Optional fixed content size (mostly for tests); defaults to measuring. */
  boardSize?: number;
  preview?: PlacementPreview | null;
  onCellPress?: (position: CellPosition) => void;
};

const FRAME_WIDTH = 2;

export function GameBoard({ grid, badges, boardSize, preview, onCellPress }: GameBoardProps) {
  const [measured, setMeasured] = useState(0);
  const rows = grid.length;
  const columns = grid[0]?.length ?? 0;

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
  const contentSize = outerSize - 2 * (FRAME_WIDTH + spacing.gridGutter);
  const cellSize =
    columns > 0 && contentSize > 0
      ? (contentSize - (columns - 1) * spacing.gridGutter) / columns
      : 0;

  const handleLayout = (event: LayoutChangeEvent) => {
    if (boardSize === undefined) {
      setMeasured(event.nativeEvent.layout.width);
    }
  };

  return (
    <View
      style={styles.board}
      onLayout={handleLayout}
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
    </View>
  );
}

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
