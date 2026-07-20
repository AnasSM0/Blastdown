import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** True when the OS "reduce motion" accessibility setting is on. Every looping
 *  or large-transform animation must gate on this and fall back to a static
 *  equivalent (docs/ANIMATION_SPEC.md "Reduced motion — mandatory gating",
 *  BUILD_SPEC.md §19). A persisted in-app toggle is added in Phase 5; until
 *  then the OS setting is the source of truth. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) {
          setReduced(value);
        }
      })
      .catch(() => {
        // Absence of the API is treated as "motion allowed".
      });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}
