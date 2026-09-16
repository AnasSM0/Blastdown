import { Circle, Group, RoundedRect, Text, vec, type SkFont } from "@shopify/react-native-skia";
import { memo } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type {
  BloomPrimitive,
  BurstPrimitive,
  DetonationPrimitive,
  EffectScene,
  FlashPrimitive,
  RingPrimitive,
  ShockwavePrimitive,
  SweepPrimitive,
  TextPrimitive,
} from "../effects/effectScene";
import { alpha, darken, lighten } from "../palette";

/** Transient effects, drawn from the pure model in `effects/effectScene.ts`.
 *
 *  Two rules shape every component below, both learned the expensive way from
 *  the CINPERF-A audit of the first version.
 *
 *  **One or two derived values per primitive, never six.** A full-board clear
 *  puts 64 flashes and 16 sweeps on screen at once. The first version gave each
 *  flash six `useDerivedValue` callbacks and each sweep five, which came to
 *  roughly 470 worklet evaluations PER FRAME on the UI thread — while the
 *  gesture handler and Skia were competing for the same frame budget. Animating
 *  a group's `transform` and `opacity` says the same thing in two.
 *
 *  **No blur mask on a per-cell primitive.** A blur mask is an offscreen render
 *  pass. Sixty-four per frame is the most expensive thing this renderer can do,
 *  and on a tiled mobile GPU it is far worse than the same number of ordinary
 *  draws. Softness costing a pass per cell is not worth it at 40 px. */

/** The near-white core of a sweep. Theme-neutral on purpose: a highlight this
 *  bright is white in any palette. The trail and body carry the theme accent. */
const SWEEP_CORE = alpha("#FFFFFF", 0.9);

/** How far a settling flash overshoots before resting. */
const SETTLE = 0.08;

function Bloom({
  primitive,
  elapsed,
}: {
  primitive: BloomPrimitive;
  elapsed: SharedValue<number>;
}) {
  const { color, delayMs, durationMs, peak, rect } = primitive;
  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    if (local < 0 || local >= durationMs) {
      return 0;
    }
    const progress = local / durationMs;
    return peak * (1 - progress) * (1 - progress * 0.45);
  });
  return (
    <RoundedRect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      r={Math.min(rect.width, rect.height) * 0.22}
      color={alpha(lighten(color, 0.35), 0.82)}
      opacity={opacity}
    />
  );
}

function Sweep({
  primitive,
  elapsed,
}: {
  primitive: SweepPrimitive;
  elapsed: SharedValue<number>;
}) {
  const { color, delayMs, durationMs, orientation, peak, rect } = primitive;
  const row = orientation === "row";
  const along = row ? rect.width : rect.height;
  const across = row ? rect.height : rect.width;
  const length = Math.max(across * 2.4, along * 0.22);
  const travel = along + length * 2;
  const trail = alpha(color, 0.14);
  const body = alpha(lighten(color, 0.35), 0.45);

  // Two worklets, not five: the three bands sit at fixed offsets inside a group
  // and the GROUP travels, so band geometry is static and only the group's
  // transform and opacity animate.
  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    if (local < 0 || local >= durationMs) {
      return 0;
    }
    return Math.sin((local / durationMs) * Math.PI) * peak;
  });
  const transform = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    const progress = durationMs > 0 ? Math.max(0, Math.min(1, local / durationMs)) : 1;
    const offset = -length + progress * travel;
    return row ? [{ translateX: offset }] : [{ translateY: offset }];
  });

  return (
    <Group opacity={opacity} transform={transform}>
      <RoundedRect
        x={row ? rect.x - length * 0.58 : rect.x}
        y={row ? rect.y : rect.y - length * 0.58}
        width={row ? length : rect.width}
        height={row ? rect.height : length}
        r={across * 0.28}
        color={trail}
      />
      <RoundedRect
        x={rect.x}
        y={rect.y}
        width={row ? length * 0.72 : rect.width}
        height={row ? rect.height : length * 0.72}
        r={across * 0.24}
        color={body}
      />
      <RoundedRect
        x={row ? rect.x + length * 0.7 : rect.x}
        y={row ? rect.y : rect.y + length * 0.7}
        width={row ? length * 0.12 : rect.width}
        height={row ? rect.height : length * 0.12}
        r={across * 0.08}
        color={SWEEP_CORE}
      />
    </Group>
  );
}

function Flash({
  primitive,
  elapsed,
}: {
  primitive: FlashPrimitive;
  elapsed: SharedValue<number>;
}) {
  const { clearTimeline, color, delayMs, durationMs, peak, rect, settles } = primitive;
  const radius = Math.min(rect.width, rect.height) * 0.2;
  const fill = alpha(lighten(color, 0.55), 0.95);
  const center = vec(rect.x + rect.width / 2, rect.y + rect.height / 2);

  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    if (local < 0 || local >= durationMs) {
      return 0;
    }
    if (clearTimeline) {
      if (local < clearTimeline.impactEndMs) {
        return peak * (1 - (local / clearTimeline.impactEndMs) * 0.72);
      }
      if (local < clearTimeline.releaseStartMs) {
        return 0;
      }
      const releaseDuration = clearTimeline.releaseEndMs - clearTimeline.releaseStartMs;
      const releaseProgress = Math.max(
        0,
        Math.min(1, (local - clearTimeline.releaseStartMs) / releaseDuration),
      );
      return Math.sin(releaseProgress * Math.PI) * peak;
    }
    const remaining = 1 - local / durationMs;
    return remaining * remaining * peak;
  });

  // The settle is one scale about the cell's own centre, not four animated
  // edges. Non-settling flashes — defuse, revive, and everything under reduced
  // motion — bind no transform at all and cost a single worklet.
  const transform = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    if (clearTimeline) {
      if (local < clearTimeline.impactEndMs) {
        return [{ scale: 0.96 + 0.04 * (local / clearTimeline.impactEndMs) }];
      }
      if (local >= clearTimeline.releaseStartMs) {
        const releaseDuration = clearTimeline.releaseEndMs - clearTimeline.releaseStartMs;
        const progress = Math.max(
          0,
          Math.min(1, (local - clearTimeline.releaseStartMs) / releaseDuration),
        );
        return [{ scale: 1 - 0.18 * progress }];
      }
      return [{ scale: 1 }];
    }
    const progress = durationMs > 0 ? Math.max(0, Math.min(1, local / durationMs)) : 1;
    return [{ scale: 1 + SETTLE * (1 - progress) }];
  });

  return (
    <Group
      opacity={opacity}
      origin={settles ? center : undefined}
      transform={settles ? transform : undefined}
    >
      <RoundedRect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        r={radius}
        color={fill}
      />
    </Group>
  );
}

function Ring({ primitive, elapsed }: { primitive: RingPrimitive; elapsed: SharedValue<number> }) {
  const { center, color, delayMs, durationMs, radius } = primitive;
  const startRadius = Math.max(1, radius * 0.18);
  const stroke = alpha(lighten(color, 0.35), 0.9);

  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    return local >= 0 && local < durationMs ? 1 - local / durationMs : 0;
  });
  const animatedRadius = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    const progress = durationMs > 0 ? Math.max(0, Math.min(1, local / durationMs)) : 1;
    return startRadius + (radius - startRadius) * progress;
  });

  // No blur: one ring per defused piece is an unbounded count in principle, and
  // a mask on each would be an unbounded number of render passes to soften a
  // two-pixel stroke.
  return (
    <Circle
      cx={center.x}
      cy={center.y}
      r={animatedRadius}
      color={stroke}
      opacity={opacity}
      style="stroke"
      strokeWidth={2}
    />
  );
}

function Detonation({
  primitive,
  elapsed,
}: {
  primitive: DetonationPrimitive;
  elapsed: SharedValue<number>;
}) {
  const { center, color, delayMs, durationMs, expands, peak, radius } = primitive;
  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    if (local < 0 || local >= durationMs) return 0;
    return peak * (1 - local / durationMs);
  });
  const animatedRadius = useDerivedValue(() => {
    if (!expands) return radius * 0.62;
    const local = elapsed.value - delayMs;
    const progress = Math.max(0, Math.min(1, local / durationMs));
    return radius * (0.28 + progress * 0.72);
  });
  return (
    <Circle
      cx={center.x}
      cy={center.y}
      r={animatedRadius}
      color={alpha(lighten(color, 0.38), 0.9)}
      opacity={opacity}
    />
  );
}

function Shockwave({
  primitive,
  elapsed,
}: {
  primitive: ShockwavePrimitive;
  elapsed: SharedValue<number>;
}) {
  const { center, color, delayMs, durationMs, expands, peak, radius } = primitive;
  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    if (local < 0 || local >= durationMs) return 0;
    return peak * (1 - local / durationMs);
  });
  const animatedRadius = useDerivedValue(() => {
    if (!expands) return radius * 0.42;
    const local = elapsed.value - delayMs;
    const progress = Math.max(0, Math.min(1, local / durationMs));
    return radius * (0.18 + progress * 0.82);
  });
  return (
    <Circle
      cx={center.x}
      cy={center.y}
      r={animatedRadius}
      color={alpha(lighten(color, 0.52), 0.95)}
      opacity={opacity}
      style="stroke"
      strokeWidth={2.5}
    />
  );
}

/** The three debris specks of one burst, thrown together.
 *
 *  Eight derived values became two. Each speck used to animate its own cx and
 *  cy; now they sit at fixed offsets inside a group that translates, which is
 *  indistinguishable for debris and costs a quarter as much with 24 live.
 *
 *  Its own component because the contained (reduced-motion) variant returns
 *  early in `Burst`, and hooks cannot sit behind that branch. */
function TravellingDebris({
  rect,
  color,
  dx,
  dy,
  opacity,
  elapsed,
  delayMs,
  durationMs,
}: {
  rect: BurstPrimitive["rect"];
  color: string;
  dx: number;
  dy: number;
  opacity: SharedValue<number>;
  elapsed: SharedValue<number>;
  delayMs: number;
  durationMs: number;
}) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const size = Math.max(1, Math.min(rect.width, rect.height) * 0.09);

  const transform = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    const progress = durationMs > 0 ? Math.max(0, Math.min(1, local / durationMs)) : 1;
    return [{ translateX: dx * progress }, { translateY: dy * progress }];
  });

  return (
    <Group opacity={opacity} transform={transform}>
      <Circle cx={centerX} cy={centerY} r={size} color={alpha(lighten(color, 0.45), 0.92)} />
      <Circle
        cx={centerX + size * 1.6}
        cy={centerY - size * 1.2}
        r={size * 0.78}
        color={alpha(lighten(color, 0.2), 0.95)}
      />
      <Circle
        cx={centerX - size * 1.4}
        cy={centerY + size * 1.5}
        r={size * 0.62}
        color={alpha(darken(color, 0.35), 0.9)}
      />
    </Group>
  );
}

function Burst({
  primitive,
  elapsed,
}: {
  primitive: BurstPrimitive;
  elapsed: SharedValue<number>;
}) {
  const { angle, color, delayMs, distance, durationMs, rect } = primitive;

  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    return local >= 0 && local < durationMs ? 1 - local / durationMs : 0;
  });

  // Reduced motion: the model sets distance to 0, so the burst is a contained
  // flash. One worklet, one rect, no travel.
  if (distance === 0) {
    return (
      <RoundedRect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        r={Math.min(rect.width, rect.height) * 0.2}
        color={alpha(lighten(color, 0.45), 0.92)}
        opacity={opacity}
      />
    );
  }

  return (
    <TravellingDebris
      rect={rect}
      color={color}
      dx={Math.cos(angle) * distance}
      dy={Math.sin(angle) * distance}
      opacity={opacity}
      elapsed={elapsed}
      delayMs={delayMs}
      durationMs={durationMs}
    />
  );
}

function FloatingText({
  primitive,
  elapsed,
  font,
}: {
  primitive: TextPrimitive;
  elapsed: SharedValue<number>;
  font: SkFont;
}) {
  const { center, color, delayMs, durationMs, riseBy, text } = primitive;
  const bounds = font.measureText(text);
  const x = center.x - bounds.width / 2;
  const startY = center.y - bounds.y / 2;
  const fill = lighten(color, 0.2);

  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    return local >= 0 && local < durationMs ? 1 - local / durationMs : 0;
  });
  const y = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    const progress = durationMs > 0 ? Math.max(0, Math.min(1, local / durationMs)) : 1;
    return startY - riseBy * progress;
  });

  return <Text x={x} y={y} text={text} font={font} color={fill} opacity={opacity} />;
}

function EffectsLayerImpl({
  scene,
  elapsed,
  font,
}: {
  scene: EffectScene;
  elapsed: SharedValue<number>;
  font: SkFont | null;
}) {
  return (
    <Group>
      {scene.blooms.map((primitive) => (
        <Bloom key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.sweeps.map((primitive) => (
        <Sweep key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.flashes.map((primitive) => (
        <Flash key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.rings.map((primitive) => (
        <Ring key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.detonations.map((primitive) => (
        <Detonation key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.shockwaves.map((primitive) => (
        <Shockwave key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.bursts.map((primitive) => (
        <Burst key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.rubbleImpacts.map((primitive) => (
        <Flash key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {font
        ? scene.texts.map((primitive) => (
            <FloatingText key={primitive.key} primitive={primitive} elapsed={elapsed} font={font} />
          ))
        : null}
    </Group>
  );
}

/** Memoized: the effect scene is rebuilt only when a new plan arrives, so an
 *  unrelated board render must not re-reconcile every live primitive. */
export const EffectsLayer = memo(EffectsLayerImpl);
