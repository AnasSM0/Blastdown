import { Canvas, Group, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { EffectScene } from "./effects/effectScene";
import { BlocksLayer } from "./layers/BlocksLayer";
import { BoardFrame } from "./layers/BoardFrame";
import { EffectsLayer } from "./layers/EffectsLayer";
import { NumeralsLayer } from "./layers/NumeralsLayer";
import { PreviewLayer } from "./layers/PreviewLayer";
import { PreClearLayer } from "./layers/PreClearLayer";
import { RubbleLayer } from "./layers/RubbleLayer";
import type { BoardScene, PreClearScene, PreviewScene } from "./types";

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
  preview,
  preClear,
  preClearOpacity,
  sequences,
  shakeScene,
  elapsed,
  font,
  style,
}: {
  scene: BoardScene;
  /** Separate from the scene so a drag does not invalidate the board. */
  preview: PreviewScene;
  /** Predicted full-line lanes, separate from static board and ghost. */
  preClear: PreClearScene;
  preClearOpacity: number | SharedValue<number>;
  /** Every live effect, bottom-first. Each draws through its own child, which
   *  owns its own clock — a hook cannot be called in a loop, so per-effect
   *  independence has to come from a component per effect. */
  sequences: readonly { id: string; scene: EffectScene; elapsed: SharedValue<number> }[];
  /** The one effect that drives the board shake, if any. Shake is a property of
   *  the board rather than of an effect, so several effects cannot each shake it
   *  — the most important one wins and the rest just draw. */
  shakeScene: EffectScene | null;
  /** Milliseconds since the shake-driving sequence started. */
  elapsed: SharedValue<number>;
  font: SkFont | null;
  style?: { width: number; height: number };
}) {
  const { geometry, palette } = scene;
  const shake = shakeScene?.shake ?? 0;
  const shakeDuration = shakeScene?.durationMs ?? 0;

  // The explosion shake, applied to the BOARD drawing rather than to the screen
  // — `docs/ANIMATION_SPEC.md` is explicit that it must stay board-only. Four
  // half-cycles of a decaying sine over the first ~200 ms, then still. Zero
  // amplitude under reduced motion, where the model has already set `shake` to
  // 0, so this needs no second check.
  // A fresh array every frame, and it has to be. `useDerivedValue` assigns its
  // result to a shared value, and assigning the SAME object identity emits no
  // change — so an earlier version that mutated one module-level array in place
  // to avoid allocating never animated at all: the board jumped to frame one's
  // offset and froze there until the shake ended. The allocation being avoided
  // was a single two-field array per frame; the cost of avoiding it was the
  // whole effect.
  const transform = useDerivedValue(() => [
    { translateX: shakeOffset(elapsed.value, shake, shakeDuration) },
  ]);

  return (
    <Canvas style={style ?? { width: geometry.boardSide, height: geometry.boardSide }}>
      {/* The transform is bound ONLY when a shake is actually playing.
          Previously it was always bound, so every effect sequence — a line
          clear, a defuse, a revive, none of which shake — drove an animated
          transform on the group wrapping the ENTIRE board, including the cached
          static picture. That forces the whole board to recomposite every frame
          for the whole sequence, which is the most expensive thing this
          renderer can do and it was happening on almost every turn.

          The Group itself stays in the tree either way. Conditionally wrapping
          would change the tree shape when a shake starts, remounting every
          layer and rebuilding the cached picture — trading one problem for a
          worse one. */}
      <Group transform={shake > 0 ? transform : undefined}>
        <BoardFrame geometry={geometry} palette={palette} />
        <RubbleLayer rubble={scene.rubble} geometry={geometry} palette={palette} />
        <BlocksLayer blocks={scene.blocks} geometry={geometry} palette={palette} />
        <PreClearLayer highlights={preClear} geometry={geometry} opacity={preClearOpacity} />
        <PreviewLayer preview={preview} geometry={geometry} />
        {/* One child per live effect, keyed by the effect's own id. Keying by
            id is what makes them independent: a retiring effect unmounts only
            its own child, and a board state change re-renders this canvas
            without remounting any of them, so nothing in flight restarts. */}
        {sequences.map((sequence) => (
          <EffectsLayer
            key={sequence.id}
            scene={sequence.scene}
            elapsed={sequence.elapsed}
            font={font}
          />
        ))}
        <NumeralsLayer numerals={scene.numerals} palette={palette} font={font} />
      </Group>
    </Canvas>
  );
}

/** How long the shake runs, independent of the sequence it rides on: a shake
 *  that lasted a whole 780 ms explosion sequence would read as a fault. */
const SHAKE_MS = 200;

/** Horizontal board offset for the explosion shake, in px.
 *
 *  Four half-cycles of a sine, squared-decayed to zero over `SHAKE_MS`. Pulled
 *  out of the worklet and exported so the curve is testable — the shake is
 *  otherwise invisible to every local check, and it has already been broken once
 *  in a way no test would have noticed.
 *
 *  Marked `"worklet"` so it can be called from the UI thread. Returns 0 for a
 *  zero amplitude, which is what reduced motion produces upstream, so there is
 *  no second reduced-motion branch here to fall out of step. */
export function shakeOffset(elapsedMs: number, amplitude: number, sequenceMs: number): number {
  "worklet";
  if (amplitude === 0 || sequenceMs <= 0) {
    return 0;
  }
  const progress = Math.min(1, Math.max(0, elapsedMs / SHAKE_MS));
  if (progress >= 1) {
    return 0;
  }
  const decay = (1 - progress) * (1 - progress);
  return Math.sin(progress * Math.PI * 4) * amplitude * decay;
}
