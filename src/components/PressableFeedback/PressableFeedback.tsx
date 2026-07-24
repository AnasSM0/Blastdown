import { forwardRef, useState } from "react";
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type View,
} from "react-native";

import { useReducedMotion } from "../../hooks/useReducedMotion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Restrained press feedback tuning (Phase 2 motion rules: 100–220 ms, no
 *  overshoot). Press-in is quicker than release so the control feels responsive
 *  and settles gently. */
const PRESSED_OPACITY = 0.6;
const PRESSED_SCALE = 0.96;
const PRESS_IN_MS = 80;
const PRESS_OUT_MS = 130;

export type PressFeedbackStyle = "dim" | "scale";

export type PressableFeedbackProps = PressableProps & {
  /** Effective reduced-motion (OS + persisted override) from the screen; falls
   *  back to the OS hook. When on, the press animation is skipped — the control
   *  still works and its disabled/state styling is unchanged. */
  reducedMotion?: boolean;
  /** "dim" (default) fades opacity — transform-free, so it is safe on rounded,
   *  glowing (elevated) controls that must never take a transform (the Android
   *  hardware-layer black-render trap). "scale" nudges the scale down and is for
   *  controls with no elevation/overflow whose own state styling already drives
   *  opacity (the reward dock). */
  pressStyle?: PressFeedbackStyle;
};

/** A Pressable with a short, restrained press animation. Forwards every
 *  Pressable prop (onPress, disabled, testID, accessibility*) untouched, so it
 *  is a drop-in for a plain Pressable. Disabled/pending controls never animate,
 *  so a press can't replay motion on a control that won't act. */
export const PressableFeedback = forwardRef<View, PressableFeedbackProps>(
  function PressableFeedback(
    {
      reducedMotion: reducedMotionProp,
      pressStyle = "dim",
      style,
      onPressIn,
      onPressOut,
      disabled,
      ...rest
    },
    ref,
  ) {
    const osReducedMotion = useReducedMotion();
    const reducedMotion = reducedMotionProp ?? osReducedMotion;
    // One value rests at 1 for both modes (opacity 1 / scale 1).
    const [value] = useState(() => new Animated.Value(1));
    const animates = !reducedMotion && !disabled;

    const handlePressIn = (event: GestureResponderEvent) => {
      if (animates) {
        Animated.timing(value, {
          toValue: pressStyle === "scale" ? PRESSED_SCALE : PRESSED_OPACITY,
          duration: PRESS_IN_MS,
          useNativeDriver: true,
        }).start();
      }
      onPressIn?.(event);
    };

    const handlePressOut = (event: GestureResponderEvent) => {
      if (animates) {
        Animated.timing(value, {
          toValue: 1,
          duration: PRESS_OUT_MS,
          useNativeDriver: true,
        }).start();
      }
      onPressOut?.(event);
    };

    // Scale rides a transform, so under reduced motion it is omitted entirely
    // (no identity transform to promote a rounded control to an Android layer).
    // Dim is opacity-only — no transform — so it is always safe to bind.
    const animatedStyle =
      pressStyle === "scale"
        ? reducedMotion
          ? null
          : { transform: [{ scale: value }] }
        : { opacity: value };

    return (
      <AnimatedPressable
        ref={ref}
        style={[animatedStyle, style as object]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        {...rest}
      />
    );
  },
);
