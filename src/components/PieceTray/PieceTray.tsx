import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import type { HandPiece } from "../../domain/gameTypes";
import { getShapeById } from "../../domain/shapes";
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
/** Finger travel before a press becomes a drag; below this a tap selects. */
const DRAG_ACTIVATION_DISTANCE = 8;

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

export function PieceTray({
  hand,
  selectedHandId,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  draggingHandId,
}: PieceTrayProps) {
  const dragEnabled = Boolean(onDragStart && onDragMove && onDragEnd);

  return (
    <View style={styles.tray} testID="piece-tray">
      {hand.map((piece) => {
        const selected = piece.handId === selectedHandId;
        const dragging = piece.handId === draggingHandId;
        const slot = (
          <Pressable
            key={piece.handId}
            onPress={() => onSelect(piece.handId)}
            style={[
              styles.slot,
              selected && styles.slotSelected,
              selected && neonGlow(pieceColor(piece.colorId), "low"),
              dragging && styles.slotDragging,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${piece.colorId} ${piece.shapeId} piece`}
            accessibilityHint="Double tap to select, or drag onto the board to place"
            accessibilityState={{ selected }}
            testID={`tray-piece-${piece.handId}`}
          >
            <MiniShape shapeId={piece.shapeId} colorId={piece.colorId} />
          </Pressable>
        );

        if (!dragEnabled) {
          return slot;
        }

        const pan = Gesture.Pan()
          .runOnJS(true)
          .minDistance(DRAG_ACTIVATION_DISTANCE)
          .onStart((event) =>
            onDragStart?.(piece.handId, { x: event.absoluteX, y: event.absoluteY }),
          )
          .onUpdate((event) =>
            onDragMove?.(piece.handId, { x: event.absoluteX, y: event.absoluteY }),
          )
          .onFinalize((event) =>
            onDragEnd?.(piece.handId, { x: event.absoluteX, y: event.absoluteY }),
          );

        return (
          <GestureDetector key={piece.handId} gesture={pan}>
            {slotWrapper(slot)}
          </GestureDetector>
        );
      })}
    </View>
  );
}

/** GestureDetector needs a single native-view child; the Pressable qualifies,
 *  but wrapping keeps the key/collapsable contract explicit. */
function slotWrapper(child: ReactNode): ReactNode {
  return <View collapsable={false}>{child}</View>;
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
    transform: [{ scale: 1.08 }],
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
