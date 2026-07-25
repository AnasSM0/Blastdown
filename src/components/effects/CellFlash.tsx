import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";

type CellFlashProps = {
  left: number;
  top: number;
  size: number;
  color: string;
  reducedMotion: boolean;
  /** Per-cell start delay (ms) so a group of cells reads as a sweep. */
  delay?: number;
  /** Peak opacity of the flash. A lower peak gives the restrained "recovery"
   *  read used by the revive wave; the default is the line-clear intensity. */
  peak?: number;
  /** Play a small settle: the flash shrinks slightly as it fades, so cleared
   *  cells read as collapsing together rather than merely blinking out. Never
   *  applied under reduced motion. */
  settle?: boolean;
  testID?: string;
};

const SETTLE_SCALE = 0.86;

/** A single square that flashes and fades — the restrained "fragment" of a line
 *  clear, and (at a lower peak) the restored cell of a revive wave
 *  (docs/ANIMATION_SPEC.md "Line sweep"). Mounts, plays once, and is unmounted
 *  by its parent when the sequence ends. */
export function CellFlash({
  left,
  top,
  size,
  color,
  reducedMotion,
  delay = 0,
  peak = 0.95,
  settle = false,
  testID,
}: CellFlashProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion) {
      // Brief highlight and fade: no stagger, no scale.
      const animation = Animated.sequence([
        Animated.timing(opacity, {
          toValue: Math.min(peak, 0.55),
          duration: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]);
      animation.start();
      return () => animation.stop();
    }
    const fade = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(opacity, { toValue: peak, duration: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 190, useNativeDriver: true }),
    ]);
    const animation = settle
      ? Animated.parallel([
          fade,
          Animated.sequence([
            Animated.delay(delay + 90),
            Animated.timing(scale, {
              toValue: SETTLE_SCALE,
              duration: 190,
              useNativeDriver: true,
            }),
          ]),
        ])
      : fade;
    animation.start();
    return () => animation.stop();
  }, [opacity, scale, reducedMotion, delay, peak, settle]);

  return (
    <Animated.View
      pointerEvents="none"
      testID={testID}
      style={[
        styles.flash,
        { left, top, width: size, height: size, backgroundColor: color, opacity },
        // No transform under reduced motion, and none when the cell isn't
        // settling — an identity transform would promote this rounded view to an
        // Android hardware layer for nothing.
        reducedMotion || !settle ? null : { transform: [{ scale }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  flash: {
    position: "absolute",
    borderRadius: 2,
  },
});
