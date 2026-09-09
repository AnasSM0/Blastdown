import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import type { CellPosition } from "../../domain/placement";
import { radius } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { blockColor } from "../../ui/themes";
import { blockSurface, type BlockVariant } from "../../ui/blockSurface";
import { BlockSurface } from "../BlockSurface";
import { RubbleSurface } from "../RubbleSurface";
import { motionKey } from "../../ui/motionKey";
import { PLACEMENT_START_SCALE } from "../../ui/pieceInteraction";
// Shared with the cinematic renderer's accessibility overlay, so a board cell
// says the same thing whichever renderer drew it.
import { cellLabel, placementHintFor } from "./cellLabel";
import { CONTOUR_BOTTOM, CONTOUR_LEFT, CONTOUR_RIGHT, CONTOUR_TOP } from "./contour";

export type CellPreviewState = "valid" | "invalid" | "conflict";

/** Contour stroke weight — heavier than the block's own edge so a timed piece's
 *  silhouette reads as one bounded group, distinct from a plain block. */
const CONTOUR_WIDTH = 2;

type GridCellProps = {
  cell: DomainGridCell;
  row: number;
  column: number;
  size: number;
  previewState?: CellPreviewState;
  /** Solid accent ring marking a rewarded-defuse target piece (Stitch 07). */
  highlighted?: boolean;
  /** True when this cell belongs to a timed piece whose countdown is urgent —
   *  drives the "critical" block material (color preserved, intensified edge +
   *  glow). Derived from existing badge metadata by the board, not here. */
  critical?: boolean;
  /** Boundary sides of this cell within its timed piece, packed as a bitmask
   *  (see `contourMaskOf`). Present only for timed cells; drives the shared
   *  piece contour. A number rather than an object so the cell stays memoizable. */
  contourMask?: number;
  /** Called with this cell's own position. Taking the position (instead of a
   *  bound closure) lets the board pass one stable handler to all 64 cells, so
   *  a re-render of the board doesn't hand every cell a new prop. */
  onPress?: (position: CellPosition) => void;
  onPreviewChange?: (position: CellPosition | null) => void;
  /** Changes each turn a piece lands on this cell, triggering a brief settle
   *  "snap" (docs/ANIMATION_SPEC.md "Placement feedback"). Undefined = no
   *  recent placement here. */
  flashNonce?: number | string;
  /** Deterministic row-major settle schedule from the shared board contract. */
  settleDelayMs?: number;
  settleDurationMs?: number;
  reducedMotion?: boolean;
  /** Anchor validity of the currently selected piece at this empty cell, from
   *  the domain's own placement preview. Present only on empty cells while a
   *  piece is selected; undefined otherwise (no selection, or a non-empty cell).
   *  Drives the placement hint so it mirrors the engine, never over-promises. */
  placementState?: "valid" | "invalid";
  /** Remaining move count of this cell's timed piece, announced in the label so
   *  the countdown never relies on color/glow alone. Timed cells only. */
  remainingTurns?: number;
  /** True while the run's freeze is active — announced on timed cells so the
   *  paused state is conveyed without color. */
  frozen?: boolean;
};

/** Maps a cell preview state to its shared block-surface variant. */
const PREVIEW_VARIANT: Record<CellPreviewState, BlockVariant> = {
  valid: "previewValid",
  invalid: "previewInvalid",
  conflict: "previewConflict",
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Presentation of one board cell. The "glass" look is approximated with a
 *  translucent fill + colored border — deliberately no per-cell blur
 *  (docs/UI_REFERENCE_AUDIT.md item 9). All colors come from the active theme. */
function GridCellImpl({
  cell,
  row,
  column,
  size,
  previewState,
  highlighted,
  critical,
  contourMask,
  onPress,
  onPreviewChange,
  flashNonce,
  settleDelayMs = 0,
  settleDurationMs = 0,
  reducedMotion,
  placementState,
  remainingTurns,
  frozen,
}: GridCellProps) {
  const theme = useTheme();
  const base = { width: size, height: size };
  const [snap] = useState(() => new Animated.Value(1));
  const lastFlash = useRef<number | string | undefined>(undefined);
  const handlePress = useCallback(() => onPress?.({ row, column }), [onPress, row, column]);
  const handlePressIn = useCallback(
    () => onPreviewChange?.({ row, column }),
    [onPreviewChange, row, column],
  );
  const handlePressOut = useCallback(() => onPreviewChange?.(null), [onPreviewChange]);

  useEffect(() => {
    if (flashNonce === undefined || flashNonce === lastFlash.current) {
      return;
    }
    lastFlash.current = flashNonce;
    if (reducedMotion) {
      return;
    }
    snap.setValue(PLACEMENT_START_SCALE);
    const animation = Animated.sequence([
      Animated.delay(settleDelayMs),
      Animated.timing(snap, {
        toValue: 1,
        duration: settleDurationMs,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      snap.setValue(1);
    };
  }, [flashNonce, reducedMotion, settleDelayMs, settleDurationMs, snap]);

  // Filled blocks (timed/normal) render as a shared premium "energy tile"
  // surface; empty and rubble cells keep their own flat treatments applied
  // directly to the pressable. Cells of one piece share a colorId, so they get
  // the same material and edge intensity and read as related — no grouping
  // logic here, just the shared surface.
  const isBlock = cell.kind === "timed" || cell.kind === "normal";
  const blockAccent = isBlock ? blockColor(theme, cell.colorId) : null;
  const blockVariant: BlockVariant = critical ? "critical" : "normal";

  let visual;
  switch (cell.kind) {
    case "empty":
      // A subdued fill distinct from the board panel so the 8×8 grid reads
      // clearly, without competing with filled blocks, previews, or rubble.
      visual = {
        backgroundColor: theme.emptyCell,
        borderWidth: 1,
        borderColor: theme.emptyCellBorder,
      };
      break;
    case "rubble":
    case "timed":
    case "normal":
      // Transparent pressable; a child surface (BlockSurface / RubbleSurface)
      // paints the tile.
      visual = undefined;
      break;
  }

  // The scale transform promotes the cell to an Android hardware layer, which —
  // combined with a rounded, clipped child — triggers the Android "black box"
  // rendering bug (placed blocks turned black on-device). Under reduced motion
  // no flash animation runs, so the transform is omitted entirely; otherwise it
  // is only briefly non-identity during the placement snap.
  const cellTransform = reducedMotion ? undefined : { transform: [{ scale: snap }] };

  const placementHint = placementHintFor(cell, onPress !== undefined, placementState);

  return (
    <AnimatedPressable
      key={motionKey(reducedMotion)}
      style={[styles.cell, base, visual, cellTransform]}
      onPress={onPress ? handlePress : undefined}
      onPressIn={onPreviewChange ? handlePressIn : undefined}
      onPressOut={onPreviewChange ? handlePressOut : undefined}
      disabled={onPress === undefined}
      testID={`cell-${row}-${column}`}
      accessibilityLabel={cellLabel(cell, row, column, { remainingTurns, critical, frozen })}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={placementHint}
      accessible
    >
      {isBlock && blockAccent ? (
        <BlockSurface
          size={size}
          surface={blockSurface(theme, blockAccent, blockVariant)}
          testID={`block-${row}-${column}`}
        />
      ) : null}
      {contourMask !== undefined && blockAccent ? (
        // A bright boundary stroke in the piece's own accent, drawn only on the
        // sides that face outside the timed piece. Internal (shared) sides get
        // nothing, so a multi-cell piece reads as one bounded group. Inset,
        // non-interactive, and interior-transparent — it never covers the block
        // highlight; previews, the highlight ring, and the badge draw over it.
        <View
          pointerEvents="none"
          style={[
            styles.contour,
            {
              borderTopWidth: contourMask & CONTOUR_TOP ? CONTOUR_WIDTH : 0,
              borderRightWidth: contourMask & CONTOUR_RIGHT ? CONTOUR_WIDTH : 0,
              borderBottomWidth: contourMask & CONTOUR_BOTTOM ? CONTOUR_WIDTH : 0,
              borderLeftWidth: contourMask & CONTOUR_LEFT ? CONTOUR_WIDTH : 0,
              borderColor: blockAccent,
            },
          ]}
          testID={`contour-${row}-${column}`}
        />
      ) : null}
      {cell.kind === "rubble" ? (
        <RubbleSurface size={size} row={row} column={column} testID={`rubble-${row}-${column}`} />
      ) : null}
      {previewState
        ? (() => {
            // Valid = the block accent (solid); invalid/conflict = the theme's
            // danger hue with a dashed edge — the non-color cue distinguishing
            // an unplaceable ghost from a placeable one.
            const previewAccent = previewState === "valid" ? theme.accent : theme.timerCritical;
            const surface = blockSurface(theme, previewAccent, PREVIEW_VARIANT[previewState]);
            return (
              <View
                pointerEvents="none"
                style={[
                  styles.preview,
                  {
                    borderColor: surface.edge,
                    backgroundColor: surface.fill,
                    borderStyle: surface.dashed ? "dashed" : "solid",
                  },
                ]}
                testID={`preview-${previewState}-${row}-${column}`}
              />
            );
          })()
        : null}
      {highlighted ? (
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            { borderColor: theme.accent, backgroundColor: `${theme.accent}33` },
          ]}
          testID={`highlight-${row}-${column}`}
        />
      ) : null}
    </AnimatedPressable>
  );
}

/** Memoized: every prop is a primitive or a stable reference (the domain reuses
 *  unchanged cell objects between turns, the board passes one shared press
 *  handler, and the contour is a bitmask), so a board re-render caused by an
 *  unrelated change re-renders only the cells that actually changed. */
export const GridCell = memo(GridCellImpl);

const styles = StyleSheet.create({
  cell: {
    borderRadius: radius.cell,
    // No `overflow: hidden`: a rounded, clipped view on an Android hardware
    // layer (from the cell transform) renders its background black. The child
    // surfaces already match the cell size, so nothing needs clipping here.
  },
  contour: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.cell,
  },
  preview: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderRadius: radius.cell,
  },
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderRadius: radius.cell,
  },
});
