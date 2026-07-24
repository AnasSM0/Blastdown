import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { HAND_SIZE } from "../../config/balance";
import type { HandPiece } from "../../domain/gameTypes";
import { getShapeById } from "../../domain/shapes";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import type { Point } from "../../ui/boardGeometry";
import { radius, spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { blockColor } from "../../ui/themes";
import { blockSurface } from "../../ui/blockSurface";

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
  /** Effective reduced-motion (OS combined with the persisted override), from
   *  the screen. Falls back to the OS setting alone when omitted, so the
   *  persisted override is honored on the real screen (the OS-only hook would
   *  ignore it). */
  reducedMotion?: boolean;
};

const SLOT_SIZE = 64;
const MINI_CELL = 14;
const MINI_GAP = 2;
const SELECTED_SCALE = 1.08;
/** Selection lift duration — short and within the Phase 2 100–220 ms band. */
const SELECT_LIFT_MS = 150;
/** Finger travel before a press becomes a drag; below this a tap selects. */
const DRAG_ACTIVATION_DISTANCE = 8;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The authoritative slot index a hand piece belongs to, encoded as the final
 *  segment of its domain handId (`hand-<refill>-<slot>`). Lets the tray keep a
 *  piece in its original slot as the hand shrinks, without the domain tracking
 *  slot positions. Falls back to -1 for ids that don't encode one (e.g. test
 *  fixtures), which the tray then fills sequentially. */
function slotIndexOf(handId: string): number {
  const dash = handId.lastIndexOf("-");
  if (dash < 0) {
    return -1;
  }
  const parsed = Number(handId.slice(dash + 1));
  return Number.isInteger(parsed) ? parsed : -1;
}

/** Lay the current hand out over exactly HAND_SIZE fixed slots, each piece in
 *  its own slot; empties (consumed pieces) stay as gaps in place — no compaction
 *  or reordering. */
function layoutSlots(hand: readonly HandPiece[]): (HandPiece | null)[] {
  const slots: (HandPiece | null)[] = Array.from({ length: HAND_SIZE }, () => null);
  for (const piece of hand) {
    const index = slotIndexOf(piece.handId);
    if (index >= 0 && index < HAND_SIZE && slots[index] === null) {
      slots[index] = piece;
    } else {
      const fallback = slots.indexOf(null);
      if (fallback >= 0) {
        slots[fallback] = piece;
      }
    }
  }
  return slots;
}

function MiniShape({
  shapeId,
  colorId,
  dragging,
}: {
  shapeId: string;
  colorId: string;
  dragging: boolean;
}) {
  const theme = useTheme();
  const shape = getShapeById(shapeId);
  if (!shape) {
    return null;
  }
  const accent = blockColor(theme, colorId);
  // Tray blocks share the board's energy-tile material; while the piece is being
  // dragged its tray copy reads as consumed (disabled variant: no glow/priority).
  const surface = blockSurface(theme, accent, dragging ? "disabled" : "tray");
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
              backgroundColor: surface.fill,
              borderColor: surface.edge,
              opacity: surface.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** A dim recessed placeholder holding the position of a consumed piece so the
 *  remaining pieces never shift. Low contrast, no glow, non-interactive. */
function EmptySlot() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.slot,
        styles.slotEmpty,
        { backgroundColor: theme.boardBg, borderColor: theme.outlineVariant },
      ]}
      accessibilityLabel="Empty slot"
      accessible
      testID="tray-slot-empty"
    />
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
  const theme = useTheme();
  const [lift] = useState(() => new Animated.Value(selected ? SELECTED_SCALE : 1));

  useEffect(() => {
    const target = selected ? SELECTED_SCALE : 1;
    if (reducedMotion) {
      // Reduced motion keeps the selected-state distinction (border/glow) but
      // skips the lift transform (BUILD_SPEC.md §19).
      lift.setValue(target);
      return;
    }
    // A quick, restrained lift/settle — no spring overshoot (Phase 2 motion
    // rules). Selecting emphasizes the new piece and the previous one settles
    // back cleanly in the same short window.
    const animation = Animated.timing(lift, {
      toValue: target,
      duration: SELECT_LIFT_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, reducedMotion, lift]);

  // The selected tray piece takes the shared "selected" block material — a
  // saturated edge and a stronger glow keyed to its own color.
  const selectedSurface = blockSurface(theme, blockColor(theme, piece.colorId), "selected");
  // Under reduced motion no spring runs, so drop the transform entirely to avoid
  // promoting the slot to an Android hardware layer (the rounded-view black-box
  // trigger, docs/DECISIONS "turns black"). Otherwise apply the lift scale.
  const liftTransform = reducedMotion ? undefined : { transform: [{ scale: lift }] };
  const slot = (
    <AnimatedPressable
      onPress={() => onSelect(piece.handId)}
      style={[
        styles.slot,
        { backgroundColor: theme.surfaceBg, borderColor: theme.outlineVariant },
        selected && { borderColor: selectedSurface.edge },
        selected && selectedSurface.glow,
        dragging && styles.slotDragging,
        liftTransform,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${piece.colorId} ${piece.shapeId} piece`}
      accessibilityHint="Double tap to select, or drag onto the board to place"
      accessibilityState={{ selected }}
      testID={`tray-piece-${piece.handId}`}
    >
      {/* Restrained inner-depth highlight along the top edge — a thin lit line
          that makes the slot read as a recessed well. Self-clips via its own top
          radius (the slot sets no overflow:hidden, which would black-box on an
          Android hardware layer). Static and cheap. */}
      <View pointerEvents="none" style={[styles.slotInset, { backgroundColor: theme.onSurface }]} />
      <MiniShape shapeId={piece.shapeId} colorId={piece.colorId} dragging={dragging} />
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
  reducedMotion: reducedMotionProp,
}: PieceTrayProps) {
  const osReducedMotion = useReducedMotion();
  const reducedMotion = reducedMotionProp ?? osReducedMotion;
  const slots = layoutSlots(hand);

  return (
    <View style={styles.tray} testID="piece-tray">
      {slots.map((piece, index) => (
        <View key={`slot-${index}`} testID={`tray-slot-${index}`} style={styles.slotWrapper}>
          {piece ? (
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
          ) : (
            <EmptySlot />
          )}
        </View>
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
  // Fixed-size wrapper reserving each slot's footprint, so consuming a piece
  // leaves a gap in place rather than letting the others reflow.
  slotWrapper: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  // No `overflow: hidden`: a rounded, clipped view on an Android hardware layer
  // (from the lift transform) renders its background black. The inner highlight
  // self-clips via its own top radius instead.
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: radius.panel,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotEmpty: {
    opacity: 0.5,
  },
  slotDragging: {
    opacity: 0.4,
  },
  slotInset: {
    position: "absolute",
    top: 0,
    left: spacing.sm,
    right: spacing.sm,
    height: StyleSheet.hairlineWidth,
    opacity: 0.12,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
  },
  miniCell: {
    position: "absolute",
    width: MINI_CELL,
    height: MINI_CELL,
    borderWidth: 1,
    borderRadius: 2,
  },
});
