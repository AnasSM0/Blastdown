import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import type {
  ExplosionFragment,
  IdentifiedExplosionPresentation,
} from "../../ui/effects/eventEffects";
import { BOARD_CONTENT_INSET } from "../../ui/boardGeometry";
import { spacing } from "../../ui/theme";

type Props = {
  explosion: IdentifiedExplosionPresentation;
  cellSize: number;
  criticalColor: string;
  hotColor: string;
  reducedMotion: boolean;
  fragmentLimit: number;
};

function withAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

/** Fallback explosion rendering driven by one native clock for the whole
 * simultaneous phase. Every child interpolates that clock; there is no
 * per-cell driver and no frame-driven React state. */
export function ExplosionPresentationLayer({
  explosion,
  cellSize,
  criticalColor,
  hotColor,
  reducedMotion,
  fragmentLimit,
}: Props) {
  const [elapsed] = useState(() => new Animated.Value(0));
  const timing = explosion.timing;
  const pitch = cellSize + spacing.gridGutter;
  const left = (column: number) => BOARD_CONTENT_INSET + column * pitch;
  const top = (row: number) => BOARD_CONTENT_INSET + row * pitch;
  const centerX = (column: number) => left(column) + cellSize / 2;
  const centerY = (row: number) => top(row) + cellSize / 2;

  useEffect(() => {
    elapsed.stopAnimation();
    elapsed.setValue(0);
    const animation = Animated.timing(elapsed, {
      toValue: timing.recoveryEndMs,
      duration: timing.recoveryEndMs,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [elapsed, timing.recoveryEndMs]);

  const flashOpacity = elapsed.interpolate({
    inputRange: [0, Math.max(1, timing.criticalFlashEndMs * 0.35), timing.criticalFlashEndMs],
    outputRange: [0.78, 1, 0],
    extrapolate: "clamp",
  });
  const detonationOpacity = elapsed.interpolate({
    inputRange: [timing.detonationStartMs, timing.detonationEndMs, timing.recoveryEndMs],
    outputRange: [0.92, 0.5, 0],
    extrapolate: "clamp",
  });
  const detonationScale = elapsed.interpolate({
    inputRange: [timing.detonationStartMs, timing.detonationEndMs],
    outputRange: [0.45, 1.45],
    extrapolate: "clamp",
  });
  const shockwaveOpacity = elapsed.interpolate({
    inputRange: [
      timing.detonationStartMs,
      timing.detonationEndMs,
      timing.fragmentsEndMs || timing.recoveryEndMs,
    ],
    outputRange: [0.9, 0.62, 0],
    extrapolate: "clamp",
  });
  const shockwaveScale = elapsed.interpolate({
    inputRange: [timing.detonationStartMs, timing.fragmentsEndMs || timing.recoveryEndMs],
    outputRange: [0.34, 1.75],
    extrapolate: "clamp",
  });
  const rubbleOpacity = elapsed.interpolate({
    inputRange: [timing.rubbleSettleStartMs, timing.rubbleSettleEndMs, timing.recoveryEndMs],
    outputRange: [0.82, 0.24, 0],
    extrapolate: "clamp",
  });
  const rubbleScale = elapsed.interpolate({
    inputRange: [timing.rubbleSettleStartMs, timing.rubbleSettleEndMs],
    outputRange: [1.24, 1],
    extrapolate: "clamp",
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="explosion-presentation">
      {explosion.blasts.flatMap((blast) =>
        blast.sourceCells.map((cell) => (
          <Animated.View
            key={`critical-${blast.explosionId}-${cell.row}-${cell.column}`}
            pointerEvents="none"
            testID={`explosion-critical-${blast.explosionId}-${cell.row}-${cell.column}`}
            style={[
              styles.sourceFlash,
              {
                left: left(cell.column),
                top: top(cell.row),
                width: cellSize,
                height: cellSize,
                backgroundColor: withAlpha(hotColor, "F2"),
                borderColor: criticalColor,
                opacity: flashOpacity,
              },
            ]}
          />
        )),
      )}

      {explosion.blasts.map((blast) => {
        const diameter = cellSize * 2.5;
        const x = centerX(blast.origin.column) - diameter / 2;
        const y = centerY(blast.origin.row) - diameter / 2;
        return (
          <View key={`detonation-${blast.explosionId}`} pointerEvents="none">
            <Animated.View
              pointerEvents="none"
              testID={`explosion-bloom-${blast.explosionId}`}
              style={[
                styles.radial,
                {
                  left: x,
                  top: y,
                  width: diameter,
                  height: diameter,
                  borderRadius: diameter / 2,
                  backgroundColor: withAlpha(criticalColor, "8F"),
                  opacity: detonationOpacity,
                },
                reducedMotion ? null : { transform: [{ scale: detonationScale }] },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              testID={`explosion-shockwave-${blast.explosionId}`}
              style={[
                styles.shockwave,
                {
                  left: x,
                  top: y,
                  width: diameter,
                  height: diameter,
                  borderRadius: diameter / 2,
                  borderColor: withAlpha(hotColor, "E6"),
                  opacity: shockwaveOpacity,
                },
                reducedMotion ? null : { transform: [{ scale: shockwaveScale }] },
              ]}
            />
          </View>
        );
      })}

      {reducedMotion
        ? null
        : explosion.fragments
            .slice(0, fragmentLimit)
            .map((fragment) => (
              <Fragment
                key={fragment.key}
                fragment={fragment}
                elapsed={elapsed}
                cellSize={cellSize}
                left={left}
                top={top}
                color={hotColor}
                startMs={timing.fragmentsStartMs}
                endMs={timing.fragmentsEndMs}
              />
            ))}

      {explosion.newRubbleCells.map((cell) => (
        <Animated.View
          key={`rubble-impact-${cell.row}-${cell.column}`}
          pointerEvents="none"
          testID={`rubble-impact-${cell.row}-${cell.column}`}
          style={[
            styles.rubbleImpact,
            {
              left: left(cell.column),
              top: top(cell.row),
              width: cellSize,
              height: cellSize,
              borderColor: withAlpha(criticalColor, "CC"),
              backgroundColor: withAlpha(criticalColor, "38"),
              opacity: rubbleOpacity,
            },
            reducedMotion ? null : { transform: [{ scale: rubbleScale }] },
          ]}
        />
      ))}
    </View>
  );
}

function Fragment({
  fragment,
  elapsed,
  cellSize,
  left,
  top,
  color,
  startMs,
  endMs,
}: {
  fragment: ExplosionFragment;
  elapsed: Animated.Value;
  cellSize: number;
  left: (column: number) => number;
  top: (row: number) => number;
  color: string;
  startMs: number;
  endMs: number;
}) {
  const localStart = Math.min(endMs - 1, startMs + fragment.delayMs);
  const peakAt = Math.min(endMs - 1, localStart + 45);
  const distance = cellSize * fragment.distanceCells;
  const translateX = elapsed.interpolate({
    inputRange: [localStart, endMs],
    outputRange: [0, Math.cos(fragment.angle) * distance],
    extrapolate: "clamp",
  });
  const translateY = elapsed.interpolate({
    inputRange: [localStart, endMs],
    outputRange: [0, Math.sin(fragment.angle) * distance],
    extrapolate: "clamp",
  });
  const opacity = elapsed.interpolate({
    inputRange: [localStart, peakAt, endMs],
    outputRange: [0, 0.95, 0],
    extrapolate: "clamp",
  });
  const size = Math.max(2, cellSize * 0.11);
  return (
    <Animated.View
      pointerEvents="none"
      testID="burst-cell"
      accessibilityLabel={fragment.key}
      style={[
        styles.fragment,
        {
          left: center(left(fragment.origin.column), cellSize) - size / 2,
          top: center(top(fragment.origin.row), cellSize) - size / 2,
          width: size * 2.2,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate: `${fragment.angle}rad` }],
        },
      ]}
    />
  );
}

function center(origin: number, cellSize: number): number {
  return origin + cellSize / 2;
}

const styles = StyleSheet.create({
  sourceFlash: {
    position: "absolute",
    borderRadius: 4,
    borderWidth: 2,
  },
  radial: {
    position: "absolute",
  },
  shockwave: {
    position: "absolute",
    borderWidth: 2,
  },
  fragment: {
    position: "absolute",
  },
  rubbleImpact: {
    position: "absolute",
    borderRadius: 4,
    borderWidth: 2,
  },
});
