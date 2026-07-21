import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import { colors, radius } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { blockColor } from "../../ui/themes";

export type CellPreviewState = "valid" | "invalid" | "conflict";

type GridCellProps = {
  cell: DomainGridCell;
  row: number;
  column: number;
  size: number;
  previewState?: CellPreviewState;
  /** Solid accent ring marking a rewarded-defuse target piece (Stitch 07). */
  highlighted?: boolean;
  onPress?: () => void;
  /** Changes each turn a piece lands on this cell, triggering a brief settle
   *  "snap" (docs/ANIMATION_SPEC.md "Placement feedback"). Undefined = no
   *  recent placement here. */
  flashNonce?: number;
  reducedMotion?: boolean;
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
    case "normal": {
      const accent = blockColor(theme, cell.colorId);
      visual = { backgroundColor: `${accent}22`, borderWidth: 1, borderColor: accent };
      break;
    }
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
      {cell.kind === "rubble" ? (
        <>
          <View style={[styles.crackA, { backgroundColor: theme.rubbleCrack }]} />
          <View style={[styles.crackB, { backgroundColor: theme.rubbleCrack }]} />
        </>
      ) : null}
      {previewState ? (
        <View
          pointerEvents="none"
          style={[
            styles.preview,
            previewState === "valid"
              ? { borderColor: theme.accent, backgroundColor: `${theme.accent}26` }
              : previewStyles[previewState],
          ]}
          testID={`preview-${previewState}-${row}-${column}`}
        />
      ) : null}
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
    borderStyle: "dashed",
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

const previewStyles = StyleSheet.create({
  valid: {
    borderColor: colors.cyanBlock,
    backgroundColor: `${colors.cyanBlock}26`,
  },
  invalid: {
    borderColor: colors.error,
    backgroundColor: `${colors.error}1A`,
  },
  conflict: {
    borderColor: colors.error,
    backgroundColor: `${colors.error}59`,
  },
});
