import { useEffect, useMemo, useState } from "react";
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
import { motionKey } from "../../ui/motionKey";
import {
  PICKUP_LIFT_PX,
  PICKUP_MS,
  PICKUP_SCALE,
  refillPlanForSlot,
  trayMetrics,
  type TrayMetrics,
} from "../../ui/pieceInteraction";

type PieceTrayProps = {
  hand: readonly HandPiece[];
  selectedHandId: string | null;
  onSelect: (handId: string) => void;
  /** Immediate semantic pickup boundary, fired on touch-down. */
  onPickup?: (handId: string) => void;
  /** Drag callbacks (window-space points). When omitted the tray is
   *  tap-only, which keeps non-gesture render contexts and older tests
   *  working unchanged. */
  onDragStart?: (handId: string, point: Point) => void;
  onDragMove?: (handId: string, point: Point) => void;
  onDragEnd?: (handId: string, point: Point) => void;
  onDragCancel?: (handId: string) => void;
  /** True while a piece is being dragged (drives the picked-up slot style). */
  draggingHandId?: string | null;
  /** Effective reduced-motion (OS combined with the persisted override), from
   *  the screen. Falls back to the OS setting alone when omitted, so the
   *  persisted override is honored on the real screen (the OS-only hook would
   *  ignore it). */
  reducedMotion?: boolean;
  /** Actual board-cell geometry, used to keep previews proportionate. */
  boardCellSize?: number;
  /** Measured horizontal room for all three fixed slots. */
  availableWidth?: number;
  /** Present only for the turn whose domain events generated a new hand. */
  refillNonce?: number;
};

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
  handId,
  dragging,
  metrics,
}: {
  shapeId: string;
  colorId: string;
  handId: string;
  dragging: boolean;
  metrics: TrayMetrics;
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
  const miniCell = metrics.shapeCellSize({ maxRow, maxColumn });
  const width = (maxColumn + 1) * (miniCell + metrics.cellGap) - metrics.cellGap;
  const height = (maxRow + 1) * (miniCell + metrics.cellGap) - metrics.cellGap;

  return (
    <View style={{ width, height }}>
      {shape.cells.map((cell) => (
        <View
          key={`${cell.row}-${cell.column}`}
          style={[
            styles.miniCell,
            {
              top: cell.row * (miniCell + metrics.cellGap),
              left: cell.column * (miniCell + metrics.cellGap),
              width: miniCell,
              height: miniCell,
              backgroundColor: surface.fill,
              borderColor: surface.edge,
              opacity: surface.opacity,
            },
          ]}
          testID={`tray-mini-cell-${handId}-${cell.row}-${cell.column}`}
        />
      ))}
    </View>
  );
}

/** A dim recessed placeholder holding the position of a consumed piece so the
 *  remaining pieces never shift. Low contrast, no glow, non-interactive. */
function EmptySlot({ slotSize }: { slotSize: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.slot,
        styles.slotEmpty,
        { width: slotSize, height: slotSize },
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
  onPickup?: (handId: string) => void;
  onDragStart?: (handId: string, point: Point) => void;
  onDragMove?: (handId: string, point: Point) => void;
  onDragEnd?: (handId: string, point: Point) => void;
  onDragCancel?: (handId: string) => void;
  metrics: TrayMetrics;
  slotIndex: number;
  refilling: boolean;
};

function TraySlot({
  piece,
  selected,
  dragging,
  reducedMotion,
  onSelect,
  onPickup,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  metrics,
  slotIndex,
  refilling,
}: TraySlotProps) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const active = !dragging && (selected || pressed);
  const [pickup] = useState(() => new Animated.Value(active ? 1 : 0));
  const [refill] = useState(() => new Animated.Value(refilling && !reducedMotion ? 0 : 1));

  useEffect(() => {
    const target = active ? 1 : 0;
    if (reducedMotion) {
      // Reduced motion keeps the selected-state distinction (border/glow) but
      // skips the lift transform (BUILD_SPEC.md §19).
      pickup.setValue(target);
      return;
    }
    // A quick, restrained lift/settle — no spring overshoot (Phase 2 motion
    // rules). Selecting emphasizes the new piece and the previous one settles
    // back cleanly in the same short window.
    const animation = Animated.timing(pickup, {
      toValue: target,
      duration: PICKUP_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, reducedMotion, pickup]);

  useEffect(() => {
    if (!refilling) {
      refill.setValue(1);
      return;
    }
    const plan = refillPlanForSlot(slotIndex, reducedMotion);
    if (reducedMotion) {
      refill.setValue(1);
      return;
    }
    refill.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(plan.delayMs),
      Animated.timing(refill, {
        toValue: 1,
        duration: plan.durationMs,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [refill, reducedMotion, refilling, slotIndex]);

  // The selected tray piece takes the shared "selected" block material — a
  // saturated edge and a stronger glow keyed to its own color.
  const selectedSurface = blockSurface(theme, blockColor(theme, piece.colorId), "selected");
  // Under reduced motion no spring runs, so drop the transform entirely to avoid
  // promoting the slot to an Android hardware layer (the rounded-view black-box
  // trigger, docs/DECISIONS "turns black"). Otherwise apply the lift scale.
  const liftTransform = reducedMotion
    ? undefined
    : {
        transform: [
          {
            scale: pickup.interpolate({ inputRange: [0, 1], outputRange: [1, PICKUP_SCALE] }),
          },
          {
            translateY: pickup.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -PICKUP_LIFT_PX],
            }),
          },
        ],
      };
  const activeSurface = selected || pressed;
  const slot = (
    <AnimatedPressable
      key={motionKey(reducedMotion)}
      onPress={() => onSelect(piece.handId)}
      onPressIn={() => {
        setPressed(true);
        onPickup?.(piece.handId);
      }}
      onPressOut={() => setPressed(false)}
      style={[
        styles.slot,
        { width: metrics.slotSize, height: metrics.slotSize },
        { backgroundColor: theme.boardBg, borderColor: theme.outlineVariant },
        activeSurface && { borderColor: selectedSurface.edge },
        activeSurface && selectedSurface.glow,
        dragging && styles.slotDragging,
        liftTransform,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${piece.colorId} ${piece.shapeId} piece`}
      accessibilityHint="Double tap to select, or drag onto the board to place"
      accessibilityState={{ selected: activeSurface }}
      testID={`tray-piece-${piece.handId}`}
    >
      {/* Restrained inner-depth highlight along the top edge — a thin lit line
          that makes the slot read as a recessed well. Self-clips via its own top
          radius (the slot sets no overflow:hidden, which would black-box on an
          Android hardware layer). Static and cheap. */}
      <View pointerEvents="none" style={[styles.slotInset, { backgroundColor: theme.onSurface }]} />
      <View pointerEvents="none" style={[styles.slotPort, { backgroundColor: theme.outline }]} />
      <MiniShape
        shapeId={piece.shapeId}
        colorId={piece.colorId}
        handId={piece.handId}
        dragging={dragging}
        metrics={metrics}
      />
    </AnimatedPressable>
  );

  const refillStyle = reducedMotion
    ? undefined
    : {
        opacity: refill,
        transform: [
          {
            translateY: refill.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }),
          },
        ],
      };
  const wrappedSlot = (
    <Animated.View style={refillStyle} testID={`tray-refill-${slotIndex}`}>
      {slot}
    </Animated.View>
  );

  const dragEnabled = Boolean(onDragStart && onDragMove && onDragEnd);
  if (!dragEnabled) {
    return wrappedSlot;
  }

  const pan = Gesture.Pan()
    .withTestId(`tray-drag-${piece.handId}`)
    .runOnJS(true)
    .minDistance(DRAG_ACTIVATION_DISTANCE)
    .onStart((event) => onDragStart?.(piece.handId, { x: event.absoluteX, y: event.absoluteY }))
    .onUpdate((event) => onDragMove?.(piece.handId, { x: event.absoluteX, y: event.absoluteY }))
    .onFinalize((event, success) => {
      if (success) {
        onDragEnd?.(piece.handId, { x: event.absoluteX, y: event.absoluteY });
      } else {
        onDragCancel?.(piece.handId);
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false}>{wrappedSlot}</View>
    </GestureDetector>
  );
}

export function PieceTray({
  hand,
  selectedHandId,
  onSelect,
  onPickup,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  draggingHandId,
  reducedMotion: reducedMotionProp,
  boardCellSize = 36,
  availableWidth = 320,
  refillNonce,
}: PieceTrayProps) {
  const theme = useTheme();
  const osReducedMotion = useReducedMotion();
  const reducedMotion = reducedMotionProp ?? osReducedMotion;
  const slots = layoutSlots(hand);
  const metrics = useMemo(
    () => trayMetrics(boardCellSize, availableWidth),
    [availableWidth, boardCellSize],
  );
  const refilling = refillNonce !== undefined;

  return (
    <View style={[styles.tray, { columnGap: metrics.gap }]} testID="piece-tray">
      <View
        pointerEvents="none"
        style={[styles.bayRail, { backgroundColor: theme.outlineVariant }]}
        testID="tray-bay-rail"
      />
      <View pointerEvents="none" style={[styles.bayRailCore, { backgroundColor: theme.accent }]} />
      {slots.map((piece, index) => (
        <View
          key={`slot-${index}`}
          testID={`tray-slot-${index}`}
          style={[styles.slotWrapper, { width: metrics.slotSize, height: metrics.slotSize }]}
        >
          {piece ? (
            <TraySlot
              key={piece.handId}
              piece={piece}
              selected={piece.handId === selectedHandId}
              dragging={piece.handId === draggingHandId}
              reducedMotion={reducedMotion}
              onSelect={onSelect}
              onPickup={onPickup}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
              metrics={metrics}
              slotIndex={index}
              refilling={refilling}
            />
          ) : (
            <EmptySlot slotSize={metrics.slotSize} />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: "relative",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,
  },
  bayRail: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    top: "50%",
    height: StyleSheet.hairlineWidth,
    opacity: 0.55,
  },
  bayRailCore: {
    position: "absolute",
    alignSelf: "center",
    bottom: 1,
    width: 28,
    height: 1,
    opacity: 0.65,
  },
  // Fixed-size wrapper reserving each slot's footprint, so consuming a piece
  // leaves a gap in place rather than letting the others reflow.
  slotWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  // No `overflow: hidden`: a rounded, clipped view on an Android hardware layer
  // (from the lift transform) renders its background black. The inner highlight
  // self-clips via its own top radius instead.
  slot: {
    borderRadius: radius.board,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotEmpty: {
    opacity: 0.42,
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
    borderTopLeftRadius: radius.board,
    borderTopRightRadius: radius.board,
  },
  slotPort: {
    position: "absolute",
    bottom: 4,
    width: 14,
    height: StyleSheet.hairlineWidth,
    opacity: 0.35,
  },
  miniCell: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 2,
  },
});
