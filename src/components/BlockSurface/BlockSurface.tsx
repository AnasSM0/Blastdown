import { StyleSheet, View } from "react-native";

import { radius } from "../../ui/theme";
import type { BlockSurfaceStyle } from "../../ui/blockSurface";

type BlockSurfaceProps = {
  /** Square edge length in px. */
  size: number;
  /** The flattened surface description for the block's current state. */
  surface: BlockSurfaceStyle;
  /** Optional overlay content (e.g. a preview/highlight ring drawn on top). */
  children?: React.ReactNode;
  testID?: string;
};

/** A single layered "energy tile": an opaque themed body, a saturated edge, and
 *  a brighter inner/upper highlight for tactile depth — all programmatic (no
 *  blur, image, or shadow). Shared across the board so every filled block reads
 *  as the same material.
 *
 *  The block body deliberately carries NO Android `elevation`/shadow: an
 *  elevated child inside the cell's animated `transform` parent fails to render
 *  on Android (placed blocks vanished on-device), and a per-cell shadow across
 *  64 cells is the "expensive shadow" the spec forbids. Depth now comes from the
 *  opaque body + edge + sheen only. (`surface.glow` is still used elsewhere for
 *  the single selected tray slot, which is not nested under a transform.) */
export function BlockSurface({ size, surface, children, testID }: BlockSurfaceProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          backgroundColor: surface.fill,
          borderColor: surface.edge,
          borderWidth: surface.borderWidth,
          borderStyle: surface.dashed ? "dashed" : "solid",
          opacity: surface.opacity,
        },
      ]}
    >
      {surface.highlight ? (
        <View pointerEvents="none" style={[styles.sheen, { backgroundColor: surface.highlight }]} />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // No `overflow: hidden`: a rounded, clipped View on an Android hardware layer
  // (the parent cell's transform) renders its background black instead of the
  // fill — the placed-block "turns black" bug. The sheen self-clips via its own
  // rounded top corners instead of relying on the tile clipping it.
  tile: {
    borderRadius: radius.cell,
  },
  // Upper-inner highlight: a soft sheen across the top of the tile that fades
  // by sitting at low opacity, giving the block a lit, slightly inset feel.
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    opacity: 0.22,
    borderTopLeftRadius: radius.cell,
    borderTopRightRadius: radius.cell,
  },
});
