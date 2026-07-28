import {
  BlurMask,
  Circle,
  Group,
  RoundedRect,
  Text,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type {
  BurstPrimitive,
  EffectScene,
  FlashPrimitive,
  RingPrimitive,
  SweepPrimitive,
  TextPrimitive,
} from "../effects/effectScene";
import { alpha, darken, lighten } from "../palette";

/** The sweep reads as light travelling along the lane: a faint trail, a soft
 *  body, and a near-white core. Only the core is theme-neutral -- a bright
 *  enough highlight is white in any palette -- so the trail and body carry the
 *  theme's own accent and the largest, brightest beat on the board stops being
 *  the one thing that ignores the active theme. */
const SWEEP_CORE = alpha("#FFFFFF", 0.9);

function Sweep({
  primitive,
  elapsed,
}: {
  primitive: SweepPrimitive;
  elapsed: SharedValue<number>;
}) {
  const { color, delayMs, durationMs, orientation, rect } = primitive;
  const along = orientation === "row" ? rect.width : rect.height;
  const across = orientation === "row" ? rect.height : rect.width;
  const length = Math.max(across * 2.4, along * 0.22);
  const start = orientation === "row" ? rect.x : rect.y;
  const row = orientation === "row";
  const trail = alpha(color, 0.14);
  const body = alpha(lighten(color, 0.35), 0.45);

  const progress = useDerivedValue(() => {
    const raw = durationMs > 0 ? (elapsed.value - delayMs) / durationMs : 1;
    return Math.max(0, Math.min(1, raw));
  });
  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    return local >= 0 && local < durationMs ? Math.sin(progress.value * Math.PI) : 0;
  });
  const head = useDerivedValue(() => start - length + progress.value * (along + length * 2));
  const tail = useDerivedValue(() => head.value - length * 0.58);
  const core = useDerivedValue(() => head.value + length * 0.7);

  return (
    <Group opacity={opacity}>
      {/* Layered bands keep the gradient directional without allocating shader
          points on every frame. */}
      <RoundedRect
        x={row ? tail : rect.x}
        y={row ? rect.y : tail}
        width={row ? length : rect.width}
        height={row ? rect.height : length}
        r={across * 0.28}
        color={trail}
      />
      <RoundedRect
        x={row ? head : rect.x}
        y={row ? rect.y : head}
        width={row ? length * 0.72 : rect.width}
        height={row ? rect.height : length * 0.72}
        r={across * 0.24}
        color={body}
      >
        <BlurMask blur={across * 0.18} style="normal" />
      </RoundedRect>
      <RoundedRect
        x={row ? core : rect.x}
        y={row ? rect.y : core}
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
  const { color, delayMs, durationMs, rect, settles } = primitive;
  const settle = settles ? 0.08 : 0;
  const radius = Math.min(rect.width, rect.height) * 0.2;
  const fill = alpha(lighten(color, 0.55), 0.95);

  const progress = useDerivedValue(() => {
    const raw = durationMs > 0 ? (elapsed.value - delayMs) / durationMs : 1;
    return Math.max(0, Math.min(1, raw));
  });
  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    const remaining = 1 - progress.value;
    return local >= 0 && local < durationMs ? remaining * remaining : 0;
  });
  const x = useDerivedValue(() => rect.x - (rect.width * settle * (1 - progress.value)) / 2);
  const y = useDerivedValue(() => rect.y - (rect.height * settle * (1 - progress.value)) / 2);
  const width = useDerivedValue(() => rect.width * (1 + settle * (1 - progress.value)));
  const height = useDerivedValue(() => rect.height * (1 + settle * (1 - progress.value)));

  return (
    <Group opacity={opacity}>
      {/* One rect, with the halo as a blur on it rather than as a second rect
          underneath. The original pair drew identical geometry and the upper
          one was opaque, so the lower was pure overdraw -- 128 draw calls for a
          full-board clear instead of 64. */}
      <RoundedRect x={x} y={y} width={width} height={height} r={radius} color={fill}>
        <BlurMask blur={radius * 0.9} style="solid" />
      </RoundedRect>
    </Group>
  );
}

function Ring({ primitive, elapsed }: { primitive: RingPrimitive; elapsed: SharedValue<number> }) {
  const { center, color, delayMs, durationMs, radius } = primitive;
  const startRadius = Math.max(1, radius * 0.18);

  const progress = useDerivedValue(() => {
    const raw = durationMs > 0 ? (elapsed.value - delayMs) / durationMs : 1;
    return Math.max(0, Math.min(1, raw));
  });
  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    return local >= 0 && local < durationMs ? 1 - progress.value : 0;
  });
  const animatedRadius = useDerivedValue(
    () => startRadius + (radius - startRadius) * progress.value,
  );

  return (
    <Circle
      cx={center.x}
      cy={center.y}
      r={animatedRadius}
      color={alpha(lighten(color, 0.35), 0.9)}
      opacity={opacity}
      style="stroke"
      strokeWidth={2}
    >
      <BlurMask blur={3} style="solid" />
    </Circle>
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
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const size = Math.max(1, Math.min(rect.width, rect.height) * 0.09);
  const contained = alpha(lighten(color, 0.45), 0.92);
  const firstX = Math.cos(angle) * distance;
  const firstY = Math.sin(angle) * distance;
  const secondX = Math.cos(angle + 0.42) * distance * 0.78;
  const secondY = Math.sin(angle + 0.42) * distance * 0.78;
  const thirdX = Math.cos(angle - 0.38) * distance * 0.62;
  const thirdY = Math.sin(angle - 0.38) * distance * 0.62;

  const progress = useDerivedValue(() => {
    const raw = durationMs > 0 ? (elapsed.value - delayMs) / durationMs : 1;
    return Math.max(0, Math.min(1, raw));
  });
  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    return local >= 0 && local < durationMs ? 1 - progress.value : 0;
  });
  const firstCx = useDerivedValue(() => centerX + firstX * progress.value);
  const firstCy = useDerivedValue(() => centerY + firstY * progress.value);
  const secondCx = useDerivedValue(() => centerX + secondX * progress.value);
  const secondCy = useDerivedValue(() => centerY + secondY * progress.value);
  const thirdCx = useDerivedValue(() => centerX + thirdX * progress.value);
  const thirdCy = useDerivedValue(() => centerY + thirdY * progress.value);

  if (distance === 0) {
    return (
      <RoundedRect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        r={Math.min(rect.width, rect.height) * 0.2}
        color={contained}
        opacity={opacity}
      />
    );
  }

  return (
    <Group opacity={opacity}>
      <Circle cx={firstCx} cy={firstCy} r={size} color={contained} />
      <Circle
        cx={secondCx}
        cy={secondCy}
        r={size * 0.78}
        color={alpha(lighten(color, 0.2), 0.95)}
      />
      <Circle cx={thirdCx} cy={thirdCy} r={size * 0.62} color={alpha(darken(color, 0.35), 0.9)} />
    </Group>
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

  const progress = useDerivedValue(() => {
    const raw = durationMs > 0 ? (elapsed.value - delayMs) / durationMs : 1;
    return Math.max(0, Math.min(1, raw));
  });
  const opacity = useDerivedValue(() => {
    const local = elapsed.value - delayMs;
    return local >= 0 && local < durationMs ? 1 - progress.value : 0;
  });
  const y = useDerivedValue(() => startY - riseBy * progress.value);

  return <Text x={x} y={y} text={text} font={font} color={lighten(color, 0.2)} opacity={opacity} />;
}

export function EffectsLayer({
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
      {scene.sweeps.map((primitive) => (
        <Sweep key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.flashes.map((primitive) => (
        <Flash key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.rings.map((primitive) => (
        <Ring key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {scene.bursts.map((primitive) => (
        <Burst key={primitive.key} primitive={primitive} elapsed={elapsed} />
      ))}
      {font
        ? scene.texts.map((primitive) => (
            <FloatingText key={primitive.key} primitive={primitive} elapsed={elapsed} font={font} />
          ))
        : null}
    </Group>
  );
}
