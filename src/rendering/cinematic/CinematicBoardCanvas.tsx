import { Canvas, type SkFont } from "@shopify/react-native-skia";

import { BlocksLayer } from "./layers/BlocksLayer";
import { BoardFrame } from "./layers/BoardFrame";
import { NumeralsLayer } from "./layers/NumeralsLayer";
import { PreviewLayer } from "./layers/PreviewLayer";
import { RubbleLayer } from "./layers/RubbleLayer";
import type { BoardScene } from "./types";

/** The single canvas.
 *
 *  One Skia surface replaces sixty-four `GridCell` views plus their block,
 *  contour, preview, highlight and rubble children — several hundred native
 *  views in the React Native renderer, each with its own layout, its own props
 *  and, for the animated ones, its own entry in the native animation driver.
 *
 *  Layer order is the depth order and is not arbitrary:
 *
 *    frame + grid + empty cells   the recess, cached as one Picture
 *    rubble                       damage sits IN the recess
 *    blocks                       pieces sit on top of damage
 *    preview                      the ghost must be visible over what it hits,
 *                                 because a conflict IS an overlap
 *    numerals                     always last: a countdown may never be hidden
 *
 *  There is nothing here but composition. Every decision about WHAT to draw was
 *  made by `buildBoardScene` before this component was called, which is what
 *  lets the renderer be tested without a canvas — see `test-utils/skiaMock.tsx`
 *  for why that constraint exists and what it costs. */
export function CinematicBoardCanvas({
  scene,
  font,
  style,
}: {
  scene: BoardScene;
  font: SkFont | null;
  style?: { width: number; height: number };
}) {
  const { geometry, palette } = scene;

  return (
    <Canvas style={style ?? { width: geometry.boardSide, height: geometry.boardSide }}>
      <BoardFrame geometry={geometry} palette={palette} />
      <RubbleLayer rubble={scene.rubble} geometry={geometry} palette={palette} />
      <BlocksLayer blocks={scene.blocks} geometry={geometry} palette={palette} />
      <PreviewLayer preview={scene.preview} geometry={geometry} />
      <NumeralsLayer numerals={scene.numerals} palette={palette} font={font} />
    </Canvas>
  );
}
