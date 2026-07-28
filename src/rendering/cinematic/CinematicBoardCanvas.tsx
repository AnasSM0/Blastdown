import { Canvas, Group, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { EffectScene } from "./effects/effectScene";
import { BlocksLayer } from "./layers/BlocksLayer";
import { BoardFrame } from "./layers/BoardFrame";
import { EffectsLayer } from "./layers/EffectsLayer";
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
 *    effects                      transient, over the board it reports on
 *    numerals                     always last: a countdown may never be hidden,
 *                                 not even by the effect celebrating its clear
 *
 *  There is nothing here but composition. Every decision about WHAT to draw was
 *  made by `buildBoardScene` and `buildEffectScene` before this component was
 *  called, which is what lets the renderer be tested without a canvas — see
 *  `test-utils/skiaMock.tsx` for why that constraint exists and what it costs. */
export function CinematicBoardCanvas({
  scene,
  effects,
  elapsed,
  font,
  style,
}: {
  scene: BoardScene;
  effects: EffectScene | null;
  /** Milliseconds since the current effect sequence started. */
  elapsed: SharedValue<number>;
  font: SkFont | null;
  style?: { width: number; height: number };
}) {
  const { geometry, palette } = scene;
  const shake = effects?.shake ?? 0;
  const shakeDuration = effects?.durationMs ?? 0;

  // The explosion shake, applied to the BOARD drawing rather than to the screen
  // — `docs/ANIMATION_SPEC.md` is explicit that it must stay board-only. Four
  // half-cycles of a decaying sine over the first ~200 ms, then still. Zero
  // amplitude under reduced motion, where the model has already set `shake` to
  // 0, so this needs no second check.
  const transform = useDerivedValue(() => {
    if (shake === 0 || shakeDuration <= 0) {
      return SHAKE_REST;
    }
    const progress = Math.min(1, Math.max(0, elapsed.value / SHAKE_MS));
    if (progress >= 1) {
      return SHAKE_REST;
    }
    SHAKE_TRANSFORM[0].translateX =
      Math.sin(progress * Math.PI * 4) * shake * (1 - progress) * (1 - progress);
    return SHAKE_TRANSFORM;
  });

  return (
    <Canvas style={style ?? { width: geometry.boardSide, height: geometry.boardSide }}>
      <Group transform={transform}>
        <BoardFrame geometry={geometry} palette={palette} />
        <RubbleLayer rubble={scene.rubble} geometry={geometry} palette={palette} />
        <BlocksLayer blocks={scene.blocks} geometry={geometry} palette={palette} />
        <PreviewLayer preview={scene.preview} geometry={geometry} />
        {effects ? <EffectsLayer scene={effects} elapsed={elapsed} font={font} /> : null}
        <NumeralsLayer numerals={scene.numerals} palette={palette} font={font} />
      </Group>
    </Canvas>
  );
}

/** How long the shake runs, independent of the sequence it rides on: a shake
 *  that lasted a whole 780 ms explosion sequence would read as a fault. */
const SHAKE_MS = 200;

/** Two module-level arrays, mutated in place by the worklet above.
 *
 *  This is deliberate and is the one place in the renderer where mutation beats
 *  clarity. A `useDerivedValue` worklet runs on the UI thread every frame, and
 *  returning a fresh `[{ translateX }]` from it would allocate two objects per
 *  frame per board — garbage generated at exactly the moment the app is trying
 *  to stay smooth through an explosion. `SHAKE_REST` is never written to, so
 *  the still case allocates nothing either. */
const SHAKE_TRANSFORM: { translateX: number }[] = [{ translateX: 0 }];
const SHAKE_REST: { translateX: number }[] = [{ translateX: 0 }];
