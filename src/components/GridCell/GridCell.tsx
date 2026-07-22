import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import { radius } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { blockColor } from "../../ui/themes";
import { blockSurface, type BlockVariant } from "../../ui/blockSurface";
import { BlockSurface } from "../BlockSurface";

export type CellPreviewState = "valid" | "invalid" | "conflict";

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
      return `Rubble, ${place}`;
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
      visual = {
        backgroundColor: theme.rubbleFill,
        borderWidth: 1,
        borderColor: theme.outlineVariant,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      };
      break;
    case "timed":
    case "normal":
      // Transparent pressable; the BlockSurface child paints the tile.
      visual = undefined;
      break;
  }

  return (
    <AnimatedPressable
      style={[styles.cell, base, visual, { transform: [{ scale: snap }] }]}
      onPress={onPress}
      disabled={onPress === undefined}
      testID={`cell-${row}-${column}`}
      accessibilityLabel={cellLabel(cell, row, column)}
      accessibilityRole={onPress ? "button" : undefined}
      accessible
    >
      {isBlock && blockAccent ? (
        <BlockSurface
          size={size}
          surface={blockSurface(theme, blockAccent, blockVariant)}
          testID={`block-${row}-${column}`}
        />
      ) : null}
      {cell.kind === "rubble" ? (
        <>
          <View style={[styles.crackA, { backgroundColor: theme.rubbleCrack }]} />
          <View style={[styles.crackB, { backgroundColor: theme.rubbleCrack }]} />
        </>
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
    overflow: "hidden",
  },
  crackA: {
    position: "absolute",
    width: "120%",
    height: 1.5,
    transform: [{ rotate: "35deg" }],
    opacity: 0.7,
  },
  crackB: {
    position: "absolute",
    width: "80%",
    height: 1.5,
    transform: [{ rotate: "-50deg" }],
    opacity: 0.5,
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
