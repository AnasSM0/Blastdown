import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { radius, spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { motionKey } from "../../ui/motionKey";

type ComboIndicatorProps = {
  combo: number;
  /** Effective reduced-motion; omits the emphasis pulse entirely. */
  reducedMotion?: boolean;
};

/** One short emphasis when the combo goes UP — a rise in the multiplier is the
 *  moment worth marking; a reset or an unchanged value is not. It stays inside
 *  the HUD pill, so nothing ever covers the board or the tray. */
const PULSE_SCALE = 1.12;
const PULSE_IN_MS = 90;
const PULSE_OUT_MS = 150;

export function ComboIndicator({ combo, reducedMotion = false }: ComboIndicatorProps) {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(1));
  const previousCombo = useRef(combo);

  useEffect(() => {
    const rose = combo > previousCombo.current;
    previousCombo.current = combo;
    // Never on mount, never on a reset or a decrease, never under reduced motion.
    if (!rose || reducedMotion) {
      return;
    }
    const animation = Animated.sequence([
      Animated.timing(pulse, {
        toValue: PULSE_SCALE,
        duration: PULSE_IN_MS,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, { toValue: 1, duration: PULSE_OUT_MS, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [combo, pulse, reducedMotion]);

  if (combo <= 0) {
    return null;
  }
  // The combo multiplier is a scoring flourish in the HUD, so it takes the
  // theme's score accent (per-theme) rather than a fixed amber — keeping it
  // consistent with the score numeral across all five themes.
  return (
    <Animated.View
      key={motionKey(reducedMotion)}
      style={[
        styles.pill,
        { borderColor: theme.score },
        // No identity transform under reduced motion: this pill is rounded, so
        // an idle transform would promote it to an Android hardware layer for
        // no benefit.
        reducedMotion ? null : { transform: [{ scale: pulse }] },
      ]}
      testID="combo-indicator"
      accessibilityLabel={`Combo x${combo}`}
      accessible
    >
      <Text
        style={[styles.text, { color: theme.score }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
      >{`x${combo}`}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "center",
  },
  text: {
    fontSize: 14,
    fontWeight: "700",
  },
});
