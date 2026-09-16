import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import type { PraiseResult, PraiseTier } from "../../ui/praise";
import { fonts } from "../../ui/theme";
import { glowFor } from "../../ui/themes";
import { useTheme } from "../../ui/ThemeProvider";

type PraiseOverlayProps = {
  praise: PraiseResult;
  reducedMotion: boolean;
  onComplete: (id: string) => void;
};

type PraiseMotion = {
  totalMs: number;
  enterMs: number;
  exitMs: number;
  startScale: number;
  fontSize: number;
};

const MOTION: Record<PraiseTier, PraiseMotion> = {
  1: { totalMs: 700, enterMs: 120, exitMs: 220, startScale: 1.14, fontSize: 24 },
  2: { totalMs: 850, enterMs: 140, exitMs: 240, startScale: 1.28, fontSize: 30 },
  3: { totalMs: 1000, enterMs: 160, exitMs: 260, startScale: 1.4, fontSize: 36 },
  4: { totalMs: 1100, enterMs: 170, exitMs: 280, startScale: 1.48, fontSize: 40 },
};

export function praiseMotionForTier(tier: PraiseTier): PraiseMotion {
  return MOTION[tier];
}

/** Renderer-independent primary praise. The keyed parent remounts it on
 * replacement, while id-scoped completion prevents an old exit clearing new copy. */
export function PraiseOverlay({ praise, reducedMotion, onComplete }: PraiseOverlayProps) {
  const theme = useTheme();
  const motion = praiseMotionForTier(praise.tier);
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(motion.startScale));
  const [translateY] = useState(() => new Animated.Value(reducedMotion ? 0 : 8));

  useEffect(() => {
    const holdMs = motion.totalMs - motion.enterMs - motion.exitMs;
    const fade = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: reducedMotion ? 100 : motion.enterMs,
        useNativeDriver: true,
      }),
      Animated.delay(reducedMotion ? motion.totalMs - 300 : holdMs),
      Animated.timing(opacity, {
        toValue: 0,
        duration: reducedMotion ? 200 : motion.exitMs,
        useNativeDriver: true,
      }),
    ]);
    const animation = reducedMotion
      ? fade
      : Animated.parallel([
          fade,
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 0.95,
              duration: Math.round(motion.enterMs * 0.7),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: Math.round(motion.enterMs * 0.3),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(translateY, {
            toValue: -12,
            duration: motion.totalMs,
            useNativeDriver: true,
          }),
        ]);
    animation.start(({ finished }) => {
      if (finished) {
        onComplete(praise.id);
      }
    });
    return () => animation.stop();
  }, [motion, onComplete, opacity, praise.id, reducedMotion, scale, translateY]);

  const color = praise.tier >= 3 ? theme.accent : praise.tier === 2 ? theme.score : theme.onSurface;
  return (
    <View pointerEvents="none" style={styles.layer} testID="praise-overlay">
      <Animated.Text
        accessibilityLiveRegion="polite"
        numberOfLines={1}
        testID="praise-text"
        style={[
          styles.text,
          glowFor(theme, color, praise.tier >= 2 ? "high" : "low"),
          { color, fontSize: motion.fontSize, opacity },
          reducedMotion ? null : { transform: [{ translateY }, { scale }, { skewX: "-7deg" }] },
        ]}
      >
        {praise.text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "18%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  text: {
    fontFamily: fonts.uiSemiBold,
    fontWeight: "800",
    letterSpacing: 1.4,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
