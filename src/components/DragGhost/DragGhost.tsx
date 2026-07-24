import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

import { getShapeById } from "../../domain/shapes";
import { spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { blockColor } from "../../ui/themes";
import { blockSurface } from "../../ui/blockSurface";

/** How far above the fingertip the dragged piece floats so it stays visible
 *  under the thumb (BUILD_SPEC.md §6.5 drag ergonomics). Exported so the
 *  screen's finger→cell mapping applies the same vertical offset. */
export const DRAG_LIFT = 28;
const LIFT = DRAG_LIFT;
const GUTTER = spacing.gridGutter;
const RETURN_MS = 160;
/** Subtle pick-up scale so the dragged piece reads as lifted off the tray.
 *  Kept small per the Phase 2 motion rules (no large scale, no overshoot). */
const DRAG_SCALE = 1.06;

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
 *  position is a native-backed `Animated.ValueXY` driven imperatively through
 *  the ref, so a pointer move updates the value directly and NEVER triggers a
 *  React render — no per-frame setState, no board rerender. The board is only
 *  touched when the mapped origin cell actually changes (the screen's job). */
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
  const pos = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const opacity = useRef(new Animated.Value(0.9)).current;
  // Rest at the small lift scale while motion is allowed so the piece reads as
  // picked up the instant the drag begins; reduced motion rests at 1 (no lift).
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : DRAG_SCALE)).current;

  useImperativeHandle(
    ref,
    () => ({
      // Position is pushed straight into the native-backed value — no setState,
      // so following the finger costs zero React renders.
      moveTo: (x: number, y: number) => pos.setValue({ x, y }),
    }),
    [pos],
  );

  useEffect(() => {
    if (!returning) {
      return;
    }
    if (reducedMotion) {
      onReturnComplete?.();
      return;
    }
    // Invalid/cancelled drop: glide back to the pick-up point (its original tray
    // slot) while fading and shrinking, then clear. Short and deterministic.
    const animation = Animated.parallel([
      Animated.timing(pos, {
        toValue: { x: initialX, y: initialY },
        duration: RETURN_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 0, duration: RETURN_MS, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.85, duration: RETURN_MS, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        onReturnComplete?.();
      }
    });
    return () => animation.stop();
  }, [returning, reducedMotion, pos, opacity, scale, initialX, initialY, onReturnComplete]);

  const shape = getShapeById(shapeId);
  if (!shape) {
    return null;
  }

  const accent = blockColor(theme, colorId);
  // Shared preview material: valid = solid piece accent; invalid = a dashed
  // edge in the theme's danger hue (the non-color cue), fill keeps the piece
  // identity so the player still recognizes which piece is being dragged.
  const surface = blockSurface(theme, accent, valid ? "previewValid" : "previewInvalid");
  const cellBorderColor = valid ? surface.edge : theme.timerCritical;
  const maxRow = Math.max(...shape.cells.map((cell) => cell.row));
  const maxColumn = Math.max(...shape.cells.map((cell) => cell.column));
  const pitch = cellSize + GUTTER;
  const width = (maxColumn + 1) * pitch - GUTTER;
  const height = (maxRow + 1) * pitch - GUTTER;

  // The anchor is a zero-size point translated to the finger; the piece is drawn
  // offset up-and-left from it (centered horizontally, floated above). Position
  // MUST be a transform so it can ride the native driver (top/left cannot), so a
  // translate is always present — but it is a real position, not an identity
  // transform. The scale (lift/return) is the only motion transform, and it is
  // omitted entirely under reduced motion. The ghost has no overflow:hidden and
  // no elevation, so it is clear of the Android rounded-layer black-render trap.
  const transform = reducedMotion
    ? pos.getTranslateTransform()
    : [...pos.getTranslateTransform(), { scale }];

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.anchor, { opacity, transform }]}
      testID="drag-ghost"
    >
      <Animated.View
        style={{ position: "absolute", left: -width / 2, top: -(LIFT + height), width, height }}
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
                borderColor: cellBorderColor,
                borderStyle: surface.dashed ? "dashed" : "solid",
              },
            ]}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 20,
  },
  cell: {
    position: "absolute",
    borderRadius: 2,
    borderWidth: 1.5,
    opacity: 0.9,
  },
});
