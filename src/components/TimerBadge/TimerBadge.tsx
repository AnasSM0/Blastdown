import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { useTheme } from "../../ui/ThemeProvider";
import { getTimerVisualState } from "../../ui/timerStates";
import { getPulseConfig } from "../../ui/timerPulse";
import { getBadgeVisual } from "./timerBadgeStyle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { motionKey } from "../../ui/motionKey";

/** Value-change tick tuning — brief and within the Phase 2 100–220 ms band. */
const TICK_SCALE = 1.16;
const TICK_IN_MS = 80;
const TICK_OUT_MS = 130;

type TimerBadgeProps = {
  pieceId: string;
  remainingTurns: number;
  colorId: string;
  /** True while the run's rewarded freeze is active — pauses the countdown and
   *  switches the badge to its icy, static frozen cue. */
  frozen?: boolean;
  /** Effective reduced-motion (OS combined with the persisted override),
   *  supplied by the board. Falls back to the OS setting alone when omitted
   *  (isolated renders), so the persisted override is honored on the real
   *  screen — the OS-only hook would ignore it. */
  reducedMotion?: boolean;
};

export function TimerBadge({
  pieceId,
  remainingTurns,
  frozen = false,
  reducedMotion: reducedMotionProp,
}: TimerBadgeProps) {
  const theme = useTheme();
  const visualState = getTimerVisualState(remainingTurns);
  const badge = getBadgeVisual(visualState, frozen, theme);
  const osReducedMotion = useReducedMotion();
  const reducedMotion = reducedMotionProp ?? osReducedMotion;
  const [scale] = useState(() => new Animated.Value(1));
  // A one-shot "tick" emphasis played when the countdown value actually changes
  // (a placement consumed a move). Multiplied over the pulse scale so both can
  // coexist. Rests at 1; never fires on first mount, when frozen, or under
  // reduced motion.
  const [tick] = useState(() => new Animated.Value(1));
  const previousTurns = useRef(remainingTurns);

  // Pulse keys on the resolved pulse state (a primitive), so ordinary rerenders
  // never restart the loop — only a genuine state change or a reduced-motion
  // toggle does. Frozen and calm states resolve to a static (null) pulse.
  useEffect(() => {
    const pulse = getPulseConfig(badge.pulseState, reducedMotion);
    if (!pulse) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: pulse.scaleTo,
          duration: pulse.halfCycleMs,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: pulse.halfCycleMs,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
    };
  }, [badge.pulseState, reducedMotion, scale]);

  // Play the tick when the value changes (not on mount, not while frozen).
  useEffect(() => {
    const changed = previousTurns.current !== remainingTurns;
    previousTurns.current = remainingTurns;
    if (!changed || reducedMotion || frozen) {
      tick.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.timing(tick, { toValue: TICK_SCALE, duration: TICK_IN_MS, useNativeDriver: true }),
      Animated.timing(tick, { toValue: 1, duration: TICK_OUT_MS, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [remainingTurns, reducedMotion, frozen, tick]);

  // Under reduced motion the pulse/tick never run, so scale stays 1 — omit the
  // transform entirely rather than binding an identity one. A rounded, glowing
  // (elevated) view carrying a transform promotes to an Android hardware layer,
  // the black-render trap; no transform, no promotion. Otherwise the discrete
  // tick rides on top of the (possibly pulsing) scale via a product.
  const badgeTransform = reducedMotion
    ? undefined
    : { transform: [{ scale: Animated.multiply(scale, tick) }] };
  return (
    <Animated.View
      key={motionKey(reducedMotion)}
      style={[
        styles.badge,
        {
          width: badge.size,
          height: badge.size,
          borderRadius: badge.size / 2,
          backgroundColor: theme.appBackground,
          borderColor: badge.ringColor,
          borderWidth: badge.ringWidth,
          borderStyle: badge.dashed ? "dashed" : "solid",
        },
        badgeTransform,
        badge.glow,
      ]}
      testID={`timer-badge-${pieceId}`}
      accessibilityLabel={`${remainingTurns} moves left${frozen ? ", frozen" : ""}`}
      accessibilityHint={`Timer state: ${frozen ? "frozen" : visualState}`}
      accessible
    >
      {/* The numeral is a spatial indicator sized to the badge; it must not grow
          past the ring at large OS text sizes (the count is also in the
          accessibility label). */}
      <Text
        style={[styles.digit, { color: badge.numeralColor }]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {remainingTurns}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
