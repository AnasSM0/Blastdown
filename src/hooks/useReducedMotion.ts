import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** True when the OS "reduce motion" accessibility setting is on. Every looping
 *  or large-transform animation must gate on this and fall back to a static
 *  equivalent (docs/ANIMATION_SPEC.md "Reduced motion — mandatory gating",
 *  BUILD_SPEC.md §19). The persisted in-app override is layered on top by
 *  `useEffectiveReducedMotion`.
 *
 *  The OS setting can only be read asynchronously, so there is an unavoidable
 *  window at startup where the answer is unknown. This hook reports `true`
 *  during that window — motion is withheld until it is known to be wanted,
 *  rather than assumed.
 *
 *  That default is deliberate and load-bearing, for two reasons.
 *
 *  Accessibility: guessing "motion allowed" and correcting a moment later
 *  animates at least one frame for a user who asked for no animation, and does
 *  it during the app's busiest moment.
 *
 *  Correctness on Android: the gated components omit `transform` entirely under
 *  reduced motion rather than animating to identity (the hardware-layer
 *  black-render trap, DECISIONS 2026-07-22). So a flip in this value changes the
 *  *presence* of a style prop, not just its value. Guessing wrong meant binding
 *  a native-driven transform and then REMOVING it a few hundred milliseconds
 *  later — and RN 0.86's Fabric renderer asserts on exactly that: a view with
 *  synchronous mount props whose committed `transform` is no longer an Array
 *  crashes in `SurfaceMountingManager.overridePropsReadableMap`. See
 *  `docs/debug/2026-07-28-fabric-consent-crash/crash-context.txt`.
 *
 *  Starting reduced makes the only startup transition the safe direction:
 *  ADDING a transform, which registers a well-formed Array before anything is
 *  animating it. Removal never happens at launch in either configuration. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) {
          setReduced(value);
        }
      })
      .catch(() => {
        // The API being absent means the OS cannot express a preference, so
        // motion is allowed — the same answer this hook gave before it started
        // withholding motion during the unknown window.
        if (mounted) {
          setReduced(false);
        }
      });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}
