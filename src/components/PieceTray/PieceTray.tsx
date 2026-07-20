import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import type { HandPiece } from "../../domain/gameTypes";
import { getShapeById } from "../../domain/shapes";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import type { Point } from "../../ui/boardGeometry";
import { colors, neonGlow, radius, spacing } from "../../ui/theme";
import { pieceColor } from "../../ui/pieceColors";

type PieceTrayProps = {
  hand: readonly HandPiece[];
  selectedHandId: string | null;
  onSelect: (handId: string) => void;
  /** Drag callbacks (window-space points). When omitted the tray is
   *  tap-only, which keeps non-gesture render contexts and older tests
   *  working unchanged. */
  onDragStart?: (handId: string, point: Point) => void;
  onDragMove?: (handId: string, point: Point) => void;
  onDragEnd?: (handId: string, point: Point) => void;
  /** True while a piece is being dragged (drives the picked-up slot style). */
  draggingHandId?: string | null;
};

const SLOT_SIZE = 64;
const MINI_CELL = 14;
const MINI_GAP = 2;
const SELECTED_SCALE = 1.08;
/** Finger travel before a press becomes a drag; below this a tap selects. */
const DRAG_ACTIVATION_DISTANCE = 8;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MiniShape({ shapeId, colorId }: { shapeId: string; colorId: string }) {
  const shape = getShapeById(shapeId);
  if (!shape) {
    return null;
  }
  const accent = pieceColor(colorId);
  const maxRow = Math.max(...shape.cells.map((cell) => cell.row));
  const maxColumn = Math.max(...shape.cells.map((cell) => cell.column));
  const width = (maxColumn + 1) * (MINI_CELL + MINI_GAP) - MINI_GAP;
  const height = (maxRow + 1) * (MINI_CELL + MINI_GAP) - MINI_GAP;

  return (
    <View style={{ width, height }}>
      {shape.cells.map((cell) => (
        <View
          key={`${cell.row}-${cell.column}`}
          style={[
            styles.miniCell,
            {
              top: cell.row * (MINI_CELL + MINI_GAP),
              left: cell.column * (MINI_CELL + MINI_GAP),
              backgroundColor: `${accent}33`,
              borderColor: accent,
            },
          ]}
        />
      ))}
    </View>
  );
}

type TraySlotProps = {
  piece: HandPiece;
  selected: boolean;
  dragging: boolean;
  reducedMotion: boolean;
  onSelect: (handId: string) => void;
  onDragStart?: (handId: string, point: Point) => void;
  onDragMove?: (handId: string, point: Point) => void;
  onDragEnd?: (handId: string, point: Point) => void;
};

function TraySlot({
  piece,
  selected,
  dragging,
  reducedMotion,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: TraySlotProps) {
  const [lift] = useState(() => new Animated.Value(selected ? SELECTED_SCALE : 1));

  useEffect(() => {
    const target = selected ? SELECTED_SCALE : 1;
    if (reducedMotion) {
      // Reduced motion keeps the selected-state distinction (border/glow) but
      // skips the springy lift transform (BUILD_SPEC.md §19).
      lift.setValue(target);
      return;
    }
    const animation = Animated.spring(lift, {
      toValue: target,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, reducedMotion, lift]);

  const slot = (
    <AnimatedPressable
      onPress={() => onSelect(piece.handId)}
      style={[
        styles.slot,
        selected && styles.slotSelected,
        selected && neonGlow(pieceColor(piece.colorId), "low"),
        dragging && styles.slotDragging,
        { transform: [{ scale: lift }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${piece.colorId} ${piece.shapeId} piece`}
      accessibilityHint="Double tap to select, or drag onto the board to place"
      accessibilityState={{ selected }}
      testID={`tray-piece-${piece.handId}`}
    >
      <MiniShape shapeId={piece.shapeId} colorId={piece.colorId} />
    </AnimatedPressable>
  );

  const dragEnabled = Boolean(onDragStart && onDragMove && onDragEnd);
  if (!dragEnabled) {
    return slot;
  }

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(DRAG_ACTIVATION_DISTANCE)
    .onStart((event) => onDragStart?.(piece.handId, { x: event.absoluteX, y: event.absoluteY }))
    .onUpdate((event) => onDragMove?.(piece.handId, { x: event.absoluteX, y: event.absoluteY }))
    .onFinalize((event) => onDragEnd?.(piece.handId, { x: event.absoluteX, y: event.absoluteY }));

  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false}>{slot}</View>
    </GestureDetector>
  );
}

export function PieceTray({
  hand,
  selectedHandId,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  draggingHandId,
}: PieceTrayProps) {
  const reducedMotion = useReducedMotion();

  return (
    <View style={styles.tray} testID="piece-tray">
      {hand.map((piece) => (
        <TraySlot
          key={piece.handId}
          piece={piece}
          selected={piece.handId === selectedHandId}
          dragging={piece.handId === draggingHandId}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: radius.panel,
    backgroundColor: colors.surfaceBg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  slotSelected: {
    borderColor: colors.onSurface,
  },
  slotDragging: {
    opacity: 0.4,
  },
  miniCell: {
    position: "absolute",
    width: MINI_CELL,
    height: MINI_CELL,
    borderWidth: 1,
    borderRadius: 2,
  },
});
