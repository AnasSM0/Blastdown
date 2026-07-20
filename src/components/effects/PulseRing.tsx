import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";

type PulseRingProps = {
  centerX: number;
  centerY: number;
  /** Final diameter of the ring in px. */
  size: number;
  color: string;
  reducedMotion: boolean;
};

/** One outward ring pulse used for a successful defuse (cyan success, never
 *  the explosion palette — docs/ANIMATION_SPEC.md). Skipped visuals under
 *  reduced motion collapse to a single brief fade with no scale. */
export function PulseRing({ centerX, centerY, size, color, reducedMotion }: PulseRingProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(reducedMotion ? 1 : 0.4));

  useEffect(() => {
    if (reducedMotion) {
      const animation = Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 50, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]);
      animation.start();
      return () => animation.stop();
    }
    const animation = Animated.parallel([
      Animated.timing(scale, { toValue: 1.4, duration: 320, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, scale, reducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          left: centerX - size / 2,
          top: centerY - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
});
