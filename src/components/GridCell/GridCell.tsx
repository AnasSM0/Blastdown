import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import { radius } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { blockColor } from "../../ui/themes";
import { blockSurface, type BlockVariant } from "../../ui/blockSurface";
import { BlockSurface } from "../BlockSurface";
import { RubbleSurface } from "../RubbleSurface";

export type CellPreviewState = "valid" | "invalid" | "conflict";

/** Which sides of a timed cell sit on the outer boundary of its piece — a side
 *  is a boundary when its neighbor is not part of the same timed piece. Drives
 *  the piece contour. Computed by the board from existing piece metadata. */
export type CellEdges = { top: boolean; right: boolean; bottom: boolean; left: boolean };

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
  /** Boundary sides of this cell within its timed piece. Present only for timed
   *  cells; drives the shared piece contour. */
  contourEdges?: CellEdges;
  onPress?: () => void;
  /** Changes each turn a piece lands on this cell, triggering a brief settle
   *  "snap" (docs/ANIMATION_SPEC.md "Placement feedback"). Undefined = no
   *  recent placement here. */
  flashNonce?: number;
  reducedMotion?: boolean;
};

/** Maps a cell preview state to its shared block-surface variant. */
const PREVIEW_VARIANT: Record<CellPreviewState, BlockVariant> = {
  valid: "previewValid",
  invalid: "previewInvalid",
  conflict: "previewConflict",
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function cellLabel(cell: DomainGridCell, row: number, column: number): string {
  const place = `row ${row + 1}, column ${column + 1}`;
  switch (cell.kind) {
    case "empty":
      return `Empty cell, ${place}`;
    case "timed":
      return `${cell.colorId} block with timer, ${place}`;
    case "normal":
      return `${cell.colorId} block, ${place}`;
    case "rubble":
      return `Blocked rubble cell, ${place}`;
  }
}

/** Presentation of one board cell. The "glass" look is approximated with a
 *  translucent fill + colored border — deliberately no per-cell blur
 *  (docs/UI_REFERENCE_AUDIT.md item 9). All colors come from the active theme. */
export function GridCell({
  cell,
  row,
  column,
  size,
  previewState,
  highlighted,
  critical,
  contourEdges,
  onPress,
  flashNonce,
  reducedMotion,
}: GridCellProps) {
  const theme = useTheme();
  const base = { width: size, height: size };
  const [snap] = useState(() => new Animated.Value(1));
  const lastFlash = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (flashNonce === undefined || flashNonce === lastFlash.current) {
      return;
    }
    lastFlash.current = flashNonce;
    if (reducedMotion) {
      return;
    }
    snap.setValue(1.12);
    const animation = Animated.timing(snap, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [flashNonce, reducedMotion, snap]);

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

  return (
    <AnimatedPressable
      style={[styles.cell, base, visual, cellTransform]}
      onPress={onPress}
      disabled={onPress === undefined}
      testID={`cell-${row}-${column}`}
      accessibilityLabel={cellLabel(cell, row, column)}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={onPress ? "Places the selected piece here" : undefined}
      accessible
    >
      {isBlock && blockAccent ? (
        <BlockSurface
          size={size}
          surface={blockSurface(theme, blockAccent, blockVariant)}
          testID={`block-${row}-${column}`}
        />
      ) : null}
      {contourEdges && blockAccent ? (
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
              borderTopWidth: contourEdges.top ? CONTOUR_WIDTH : 0,
              borderRightWidth: contourEdges.right ? CONTOUR_WIDTH : 0,
              borderBottomWidth: contourEdges.bottom ? CONTOUR_WIDTH : 0,
              borderLeftWidth: contourEdges.left ? CONTOUR_WIDTH : 0,
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
