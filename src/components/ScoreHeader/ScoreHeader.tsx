import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { spacing, typography } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { glowFor } from "../../ui/themes";
import { ComboIndicator } from "../ComboIndicator";
import { PressableFeedback } from "../PressableFeedback";
import { motionKey } from "../../ui/motionKey";
import type { ScoreImpact, ScoreImpactLevel } from "../../ui/scoreImpact";

type ScoreHeaderProps = {
  score: number;
  best: number;
  combo: number;
  impact?: ScoreImpact | null;
  onPause: () => void;
  /** Effective reduced-motion, for the pause control's press feedback, the
   *  score bump, and the combo emphasis. */
  reducedMotion?: boolean;
};

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** Cap runaway OS text scaling so the three HUD columns can't collide at large
 *  accessibility sizes. The digits still scale — they just stop before overlap.
 *  The current score keeps a tighter cap (it is the widest element) and also
 *  shrinks to fit its column as a final guard. */
const SCORE_MAX_SCALE = 1.4;
const LABEL_MAX_SCALE = 1.6;

/** A short magnitude-aware impulse for a meaningful committed outcome. It is
 * never inferred from score alone: ordinary placement and explosion changes
 * have no impact contract, and therefore receive no celebratory motion. */
type ScoreMotion = { scaleTo: number; lift: number; inMs: number };

const SCORE_MOTION: Record<ScoreImpactLevel, ScoreMotion> = {
  1: { scaleTo: 1.12, lift: -2, inMs: 90 },
  2: { scaleTo: 1.21, lift: -4, inMs: 105 },
  3: { scaleTo: 1.3, lift: -7, inMs: 120 },
};

export function scoreMotionForImpact(level: ScoreImpactLevel): ScoreMotion {
  return SCORE_MOTION[level];
}

export function ScoreHeader({
  score,
  best,
  combo,
  impact,
  onPause,
  reducedMotion,
}: ScoreHeaderProps) {
  const theme = useTheme();
  const [slam] = useState(() => new Animated.Value(1));
  const [lift] = useState(() => new Animated.Value(0));
  const previousScore = useRef(score);

  useEffect(() => {
    const rose = score > previousScore.current;
    previousScore.current = score;
    slam.stopAnimation();
    lift.stopAnimation();
    slam.setValue(1);
    lift.setValue(0);
    if (!rose || reducedMotion || !impact) {
      return;
    }
    const motion = scoreMotionForImpact(impact.level);
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(slam, {
          toValue: motion.scaleTo,
          duration: motion.inMs,
          useNativeDriver: true,
        }),
        Animated.spring(slam, {
          toValue: 1,
          damping: 12,
          stiffness: 210,
          mass: 0.7,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(lift, {
          toValue: motion.lift,
          duration: motion.inMs,
          useNativeDriver: true,
        }),
        Animated.spring(lift, {
          toValue: 0,
          damping: 14,
          stiffness: 220,
          mass: 0.7,
          useNativeDriver: true,
        }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [impact, lift, reducedMotion, score, slam]);

  return (
    <View style={styles.row} testID="score-header">
      <View style={styles.side}>
        <Text
          style={[typography.labelCaps, { color: theme.onSurfaceVariant }]}
          numberOfLines={1}
          maxFontSizeMultiplier={LABEL_MAX_SCALE}
        >
          BEST
        </Text>
        <Text
          style={[typography.numericValue, { color: theme.onSurfaceVariant }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={LABEL_MAX_SCALE}
          accessibilityLabel={`Best score ${formatNumber(best)}`}
          testID="best-value"
        >
          {formatNumber(best)}
        </Text>
      </View>

      <View style={styles.center}>
        <Animated.Text
          key={motionKey(reducedMotion)}
          style={[
            typography.scoreMobile,
            { color: theme.score },
            glowFor(theme, theme.score, "low"),
            // The glow carries Android elevation, so no identity transform is
            // bound here under reduced motion.
            reducedMotion ? null : { transform: [{ translateY: lift }, { scale: slam }] },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={SCORE_MAX_SCALE}
          accessibilityLabel={`Score ${formatNumber(score)}`}
          accessibilityHint={impact ? `Increased by ${formatNumber(impact.delta)}` : undefined}
          testID="score-value"
        >
          {formatNumber(score)}
        </Animated.Text>
        <ComboIndicator combo={combo} reducedMotion={reducedMotion} />
      </View>

      <View style={[styles.side, styles.sideRight]}>
        <PressableFeedback
          onPress={onPause}
          reducedMotion={reducedMotion}
          style={[styles.pauseButton, { borderColor: theme.outlineVariant }]}
          accessibilityRole="button"
          accessibilityLabel="Pause"
          accessibilityHint="Pauses the current run and opens the pause menu"
          testID="pause-button"
          hitSlop={4}
        >
          <View style={[styles.pauseBar, { backgroundColor: theme.onSurfaceVariant }]} />
          <View style={[styles.pauseBar, { backgroundColor: theme.onSurfaceVariant }]} />
        </PressableFeedback>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
  },
  side: {
    // Fixed, non-shrinking side columns keep the centered score truly centered
    // and give it a stable amount of room to shrink into at large text scales.
    // Wide enough for a realistic multi-digit best; the value also shrinks to
    // fit rather than truncating.
    width: 72,
    flexShrink: 0,
  },
  sideRight: {
    alignItems: "flex-end",
  },
  center: {
    // The score column takes the remaining width and can shrink (minWidth: 0)
    // so `adjustsFontSizeToFit` has room to work instead of overflowing.
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: spacing.xs,
  },
  pauseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  pauseBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
});
