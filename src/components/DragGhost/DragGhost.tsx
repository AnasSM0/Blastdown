import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Animated, StyleSheet } from "react-native";

import { getShapeById } from "../../domain/shapes";
import { spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { blockColor } from "../../ui/themes";

/** How far above the fingertip the dragged piece floats so it stays visible
 *  under the thumb (BUILD_SPEC.md §6.5 drag ergonomics). Exported so the
 *  screen's finger→cell mapping applies the same vertical offset. */
export const DRAG_LIFT = 28;
const LIFT = DRAG_LIFT;
const GUTTER = spacing.gridGutter;
const RETURN_MS = 160;

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
  /** When true, the ghost plays a brief return-to-tray animation and then
   *  calls onReturnComplete (an invalid/cancelled drop). */
  returning?: boolean;
  reducedMotion?: boolean;
  onReturnComplete?: () => void;
};

/** A translucent copy of the dragged piece that follows the finger. Its
 *  position is driven imperatively via the ref so only this small overlay
 *  re-renders on every pointer move — the board is left untouched until the
 *  mapped origin cell actually changes. */
export const DragGhost = forwardRef<DragGhostHandle, DragGhostProps>(function DragGhost(
  {
    shapeId,
    colorId,
    cellSize,
    initialX,
    initialY,
    valid,
    returning,
    reducedMotion,
    onReturnComplete,
  },
  ref,
) {
  const theme = useTheme();
  const [point, setPoint] = useState({ x: initialX, y: initialY });
  const [opacity] = useState(() => new Animated.Value(0.9));
  const [scale] = useState(() => new Animated.Value(1));

  useImperativeHandle(
    ref,
    () => ({
      moveTo: (x: number, y: number) => setPoint({ x, y }),
    }),
    [],
  );

  useEffect(() => {
    if (!returning) {
      return;
    }
    if (reducedMotion) {
      onReturnComplete?.();
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: RETURN_MS, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.85, duration: RETURN_MS, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        onReturnComplete?.();
      }
    });
    return () => animation.stop();
  }, [returning, reducedMotion, opacity, scale, onReturnComplete]);

  const shape = getShapeById(shapeId);
  if (!shape) {
    return null;
  }

  const accent = blockColor(theme, colorId);
  const maxRow = Math.max(...shape.cells.map((cell) => cell.row));
  const maxColumn = Math.max(...shape.cells.map((cell) => cell.column));
  const pitch = cellSize + GUTTER;
  const width = (maxColumn + 1) * pitch - GUTTER;
  const height = (maxRow + 1) * pitch - GUTTER;

  // Center on the finger horizontally, floated above it vertically.
  const left = point.x - width / 2;
  const top = point.y - LIFT - height;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ghost, { left, top, width, height, opacity, transform: [{ scale }] }]}
      testID="drag-ghost"
    >
      {shape.cells.map((cell) => (
        <Animated.View
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
    </Animated.View>
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
