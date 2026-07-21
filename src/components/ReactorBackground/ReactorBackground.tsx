import { StyleSheet, View } from "react-native";

import { useTheme } from "../../ui/ThemeProvider";

/** A restrained, fully programmatic "reactor" surface that replaces the flat
 *  screen fill (P1-2). It is deliberately cheap and static:
 *
 *  - no per-frame animation, no image assets, no blur, no layered shadows;
 *  - a handful of absolutely-positioned, low-opacity `View`s only;
 *  - every position is a percentage, so it holds from 320px up with no fixed
 *    device coordinates;
 *  - all hues come from the active theme's `background` tokens, so it stays low
 *    contrast under every theme and never competes with the board, timers,
 *    previews, or controls.
 *
 *  It fills the whole screen behind gameplay (edge-to-edge, under the safe-area
 *  content) and never intercepts touches (`pointerEvents="none"`). */
export function ReactorBackground() {
  const theme = useTheme();
  const bg = theme.background;
  return (
    <View
      style={[styles.fill, { backgroundColor: bg.base }]}
      pointerEvents="none"
      testID="reactor-background"
    >
      {/* Soft central lift — a single large, low-opacity rounded panel that
          lightens the middle where the board sits and lets the corners fall
          away, approximating a vignette/gradient without a gradient library. */}
      <View style={[styles.glow, { backgroundColor: bg.glow }]} />

      {/* Faint circuit grid: a few evenly spaced hairlines each way. Kept to a
          small, fixed count so the cost is trivial regardless of screen size. */}
      {GRID_FRACTIONS.map((fraction) => (
        <View
          key={`v-${fraction}`}
          style={[styles.vLine, { left: `${fraction * 100}%`, backgroundColor: bg.grid }]}
        />
      ))}
      {GRID_FRACTIONS.map((fraction) => (
        <View
          key={`h-${fraction}`}
          style={[styles.hLine, { top: `${fraction * 100}%`, backgroundColor: bg.grid }]}
        />
      ))}

      {/* Panel seams framing the central play area. */}
      <View style={[styles.seamTop, { backgroundColor: bg.seam }]} />
      <View style={[styles.seamBottom, { backgroundColor: bg.seam }]} />

      {/* Corner brackets — two thin strokes per corner for a machined detail. */}
      <View
        style={[styles.corner, styles.cornerTL, styles.cornerH, { backgroundColor: bg.corner }]}
      />
      <View
        style={[styles.corner, styles.cornerTL, styles.cornerV, { backgroundColor: bg.corner }]}
      />
      <View
        style={[styles.corner, styles.cornerTR, styles.cornerH, { backgroundColor: bg.corner }]}
      />
      <View
        style={[styles.corner, styles.cornerTR, styles.cornerV, { backgroundColor: bg.corner }]}
      />
      <View
        style={[styles.corner, styles.cornerBL, styles.cornerH, { backgroundColor: bg.corner }]}
      />
      <View
        style={[styles.corner, styles.cornerBL, styles.cornerV, { backgroundColor: bg.corner }]}
      />
      <View
        style={[styles.corner, styles.cornerBR, styles.cornerH, { backgroundColor: bg.corner }]}
      />
      <View
        style={[styles.corner, styles.cornerBR, styles.cornerV, { backgroundColor: bg.corner }]}
      />
    </View>
  );
}

/** Fixed hairline positions (as fractions of each axis). Small count = cheap. */
const GRID_FRACTIONS = [0.25, 0.5, 0.75] as const;

const CORNER_LENGTH = 28;
const CORNER_THICKNESS = 2;
const CORNER_INSET = 16;

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    left: "-10%",
    right: "-10%",
    top: "18%",
    bottom: "22%",
    borderRadius: 320,
    opacity: 0.5,
  },
  vLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    opacity: 0.5,
  },
  hLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.5,
  },
  seamTop: {
    position: "absolute",
    left: "8%",
    right: "8%",
    top: "12%",
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  seamBottom: {
    position: "absolute",
    left: "8%",
    right: "8%",
    bottom: "10%",
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  corner: {
    position: "absolute",
    opacity: 0.7,
  },
  cornerH: {
    width: CORNER_LENGTH,
    height: CORNER_THICKNESS,
  },
  cornerV: {
    width: CORNER_THICKNESS,
    height: CORNER_LENGTH,
  },
  cornerTL: {
    top: CORNER_INSET,
    left: CORNER_INSET,
  },
  cornerTR: {
    top: CORNER_INSET,
    right: CORNER_INSET,
  },
  cornerBL: {
    bottom: CORNER_INSET,
    left: CORNER_INSET,
  },
  cornerBR: {
    bottom: CORNER_INSET,
    right: CORNER_INSET,
  },
});
