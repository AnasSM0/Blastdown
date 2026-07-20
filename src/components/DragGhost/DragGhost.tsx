import { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getShapeById } from "../../domain/shapes";
import { spacing } from "../../ui/theme";
import { pieceColor } from "../../ui/pieceColors";

/** How far above the fingertip the dragged piece floats so it stays visible
 *  under the thumb (BUILD_SPEC.md §6.5 drag ergonomics). Exported so the
 *  screen's finger→cell mapping applies the same vertical offset. */
export const DRAG_LIFT = 28;
const LIFT = DRAG_LIFT;
const GUTTER = spacing.gridGutter;

export type DragGhostHandle = {
  /** Move the ghost so it floats above the given window-space finger point. */
  moveTo: (x: number, y: number) => void;
};

type DragGhostProps = {
  shapeId: string;
  colorId: string;
  cellSize: number;
  initialX: number;
  initialY: number;
  valid: boolean;
};

/** A translucent copy of the dragged piece that follows the finger. Its
 *  position is driven imperatively via the ref so only this small overlay
 *  re-renders on every pointer move — the board is left untouched until the
 *  mapped origin cell actually changes. */
export const DragGhost = forwardRef<DragGhostHandle, DragGhostProps>(function DragGhost(
  { shapeId, colorId, cellSize, initialX, initialY, valid },
  ref,
) {
  const [point, setPoint] = useState({ x: initialX, y: initialY });

  useImperativeHandle(
    ref,
    () => ({
      moveTo: (x: number, y: number) => setPoint({ x, y }),
    }),
    [],
  );

  const shape = getShapeById(shapeId);
  if (!shape) {
    return null;
  }

  const accent = pieceColor(colorId);
  const maxRow = Math.max(...shape.cells.map((cell) => cell.row));
  const maxColumn = Math.max(...shape.cells.map((cell) => cell.column));
  const pitch = cellSize + GUTTER;
  const width = (maxColumn + 1) * pitch - GUTTER;
  const height = (maxRow + 1) * pitch - GUTTER;

  // Center on the finger horizontally, floated above it vertically.
  const left = point.x - width / 2;
  const top = point.y - LIFT - height;

  return (
    <View
      pointerEvents="none"
      style={[styles.ghost, { left, top, width, height }]}
      testID="drag-ghost"
    >
      {shape.cells.map((cell) => (
        <View
          key={`${cell.row}-${cell.column}`}
          style={[
            styles.cell,
            {
              width: cellSize,
              height: cellSize,
              top: cell.row * pitch,
              left: cell.column * pitch,
              backgroundColor: `${accent}55`,
              borderColor: valid ? accent : "#FFB4AB",
            },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  ghost: {
    position: "absolute",
    zIndex: 20,
  },
  cell: {
    position: "absolute",
    borderRadius: 2,
    borderWidth: 1.5,
    opacity: 0.9,
  },
});
