import { StyleSheet, View } from "react-native";

import { radius } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { getRubbleGeometry } from "./rubbleGeometry";

type RubbleSurfaceProps = {
  /** Square edge length in px. */
  size: number;
  /** Cell coordinates — drive the deterministic crack/facet layout. */
  row: number;
  column: number;
  testID?: string;
};

const CRACK_THICKNESS = 2;
const FISSURE_THICKNESS = 1;

/** A programmatic "cracked graphite" tile for a rubble cell: a dark basalt base
 *  with a darker edge, a couple of subtle broken-surface facets for depth, and
 *  two or three irregular dark cracks — one carrying a restrained warm ember
 *  seam. All static Views (no image, SVG, blur, or large shadow); the layout is
 *  chosen deterministically by cell position, never randomized at render. Low
 *  visual priority so it reads as blocked/damaged, distinct from a normal block.
 *  The cracks are clipped by an inner square view, never by the rounded tile —
 *  see `styles.clip`. */
export function RubbleSurface({ size, row, column, testID }: RubbleSurfaceProps) {
  const theme = useTheme();
  const { cracks, facets } = getRubbleGeometry(row, column);

  return (
    <View
      pointerEvents="none"
      testID={testID}
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          backgroundColor: theme.rubbleFill,
          borderColor: theme.rubbleEdge,
        },
      ]}
    >
      <View style={styles.clip} testID={testID ? `${testID}-clip` : undefined}>
        {facets.map((facet, index) => (
          <View
            key={`facet-${index}`}
            style={{
              position: "absolute",
              top: `${facet.topPct}%`,
              left: `${facet.leftPct}%`,
              width: `${facet.widthPct}%`,
              height: `${facet.heightPct}%`,
              backgroundColor: theme.rubbleFacet,
              opacity: 0.5,
              borderRadius: 2,
              transform: [{ rotate: `${facet.rotateDeg}deg` }],
            }}
          />
        ))}
        {cracks.map((crack, index) => (
          <View key={`crack-${index}`}>
            <View
              style={{
                position: "absolute",
                top: `${crack.topPct}%`,
                left: `${crack.leftPct}%`,
                width: `${crack.lengthPct}%`,
                height: CRACK_THICKNESS,
                backgroundColor: theme.rubbleCrack,
                opacity: 0.85,
                transform: [{ rotate: `${crack.rotateDeg}deg` }],
              }}
            />
            {crack.fissure ? (
              // A thin warm seam along the main fissure — a restrained ember
              // glow, not a bright block accent.
              <View
                style={{
                  position: "absolute",
                  top: `${crack.topPct}%`,
                  left: `${crack.leftPct}%`,
                  width: `${crack.lengthPct}%`,
                  height: FISSURE_THICKNESS,
                  backgroundColor: theme.rubbleFissure,
                  opacity: 0.6,
                  transform: [{ rotate: `${crack.rotateDeg}deg` }],
                }}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.cell,
    borderWidth: 1,
    // Deliberately NO `overflow: hidden` here. Rubble appears on explosion
    // turns, which are exactly the turns the board plays its shake transform —
    // and a rounded, clipped view inside a transformed ancestor is the Android
    // hardware-layer black-render trap this project has already hit on-device
    // (docs/DECISIONS.md 2026-07-22). The clipping moved to `clip` below.
  },
  // Square (unrounded) clip for the cracks and facets, inset by 1px so it sits
  // wholly inside the tile's 2px corner radius — nothing can paint outside the
  // rounded silhouette, and no rounded view is ever clipped.
  clip: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    overflow: "hidden",
  },
});
