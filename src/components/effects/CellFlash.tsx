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
};

/** A single cyan-white square that flashes and fades — the restrained
 *  "fragment" of a line clear (docs/ANIMATION_SPEC.md "Line sweep"). Mounts,
 *  plays once, and is unmounted by its parent when the sequence ends. */
export function CellFlash({ left, top, size, color, reducedMotion, delay = 0 }: CellFlashProps) {
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      // Brief highlight and fade, no stagger.
      const animation = Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 40, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]);
      animation.start();
      return () => animation.stop();
    }
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(opacity, { toValue: 0.95, duration: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 190, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flash,
        { left, top, width: size, height: size, backgroundColor: color, opacity },
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
