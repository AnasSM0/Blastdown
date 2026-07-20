import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";

import { colors } from "../../ui/theme";

type BurstCellProps = {
  left: number;
  top: number;
  size: number;
  reducedMotion: boolean;
  /** Per-cell anticipation delay (ms) so a multi-cell blast reads clearly. */
  delay?: number;
};

/** One cell of an explosion: a brief anticipation, a compact neon burst
 *  (danger palette), then a fade that reveals the rubble already drawn beneath
 *  it (docs/ANIMATION_SPEC.md "Explosion sequence"). No fire/smoke, no
 *  full-screen flash. Parents omit this entirely under reduced motion. */
export function BurstCell({ left, top, size, reducedMotion, delay = 0 }: BurstCellProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const animation = Animated.sequence([
      Animated.delay(delay),
      // Anticipation flash in.
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.95, duration: 70, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.25, duration: 130, useNativeDriver: true }),
      ]),
      // Settle back and fade, revealing the rubble underneath.
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 230, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: 230, useNativeDriver: true }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, scale, reducedMotion, delay]);

  if (reducedMotion) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      testID="burst-cell"
      style={[
        styles.burst,
        { left, top, width: size, height: size, opacity, transform: [{ scale }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  burst: {
    position: "absolute",
    borderRadius: 3,
    backgroundColor: colors.scoreOrange,
    borderWidth: 1.5,
    borderColor: colors.urgentRed,
  },
});
