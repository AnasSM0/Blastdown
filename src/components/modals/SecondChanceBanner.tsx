import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { colors, radius, spacing, typography } from "../../ui/theme";

type SecondChanceBannerProps = {
  reducedMotion?: boolean;
};

/** Transient "SECOND CHANCE" banner shown across the board after a revive
 *  (Stitch 10). Cosmetic only. Under reduced motion it appears at full opacity
 *  with no fade; otherwise it fades in. The parent unmounts it on a timer, so
 *  it holds no dismissal logic of its own. */
export function SecondChanceBanner({ reducedMotion = false }: SecondChanceBannerProps) {
  const [opacity] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);

  return (
    // The full-screen box is a static, transparent layout container; only the
    // small text pill fades. Animating opacity on the full-screen view would
    // promote the whole screen to a compositing layer for a one-line banner.
    <View
      pointerEvents="none"
      style={styles.banner}
      testID="second-chance-banner"
      accessibilityLabel="Second chance"
      accessible
    >
      <Animated.Text style={[styles.text, { opacity }]}>SECOND CHANCE</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 11,
  },
  text: {
    ...typography.labelCaps,
    fontSize: 22,
    letterSpacing: 3,
    color: colors.onSurface,
    backgroundColor: "rgba(5, 5, 5, 0.85)",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
  },
});
