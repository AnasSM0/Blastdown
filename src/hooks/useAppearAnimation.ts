import { useEffect, useState } from "react";
import { Animated, type ViewStyle } from "react-native";

import { useReducedMotion } from "./useReducedMotion";

/** Appear transition duration + rise distance — short, within the Phase 2
 *  100–220 ms band, and a small translate so nothing reads as a big slide. */
const APPEAR_MS = 180;
const APPEAR_RISE = 12;

/** A short fade + upward-translate entrance for a modal/overlay panel. Plays
 *  once on mount. Under reduced motion it resolves instantly to the resting
 *  state with NO transform (no identity transform on a rounded panel — the
 *  Android hardware-layer guard). Native-driven; the returned object goes
 *  straight into the panel's `style`. */
export function useAppearAnimation(reducedMotion?: boolean): Animated.WithAnimatedValue<ViewStyle> {
  const osReducedMotion = useReducedMotion();
  const reduced = reducedMotion ?? osReducedMotion;
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: APPEAR_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduced, progress]);

  if (reduced) {
    return { opacity: 1 };
  }
  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [APPEAR_RISE, 0],
        }),
      },
    ],
  };
}
