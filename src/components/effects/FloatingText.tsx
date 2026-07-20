import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";

type FloatingTextProps = {
  text: string;
  color: string;
  /** Center x within the board content area. */
  centerX: number;
  /** Top y within the board content area. */
  top: number;
  reducedMotion: boolean;
};

/** Restrained "+N" / "DEFUSED" feedback that floats up and fades
 *  (docs/ANIMATION_SPEC.md "Floating score feedback"). Reduced motion holds
 *  position and only fades. */
export function FloatingText({ text, color, centerX, top, reducedMotion }: FloatingTextProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      const animation = Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]);
      animation.start();
      return () => animation.stop();
    }
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(160),
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
      Animated.timing(translateY, { toValue: -28, duration: 560, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, translateY, reducedMotion]);

  return (
    <Animated.Text
      pointerEvents="none"
      numberOfLines={1}
      style={[
        styles.text,
        { left: centerX - 60, top, color, opacity, transform: [{ translateY }] },
      ]}
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: "absolute",
    width: 120,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
