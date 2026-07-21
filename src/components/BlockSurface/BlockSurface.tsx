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

/** A single layered "energy tile": a dark translucent themed fill, a saturated
 *  edge, a restrained glow, and a brighter inner/upper highlight for tactile
 *  depth — all programmatic (no blur, image, or animated shadow). Shared across
 *  the board so every filled block reads as the same material. */
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
        surface.glow ?? null,
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
  tile: {
    borderRadius: radius.cell,
    overflow: "hidden",
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
  },
});
