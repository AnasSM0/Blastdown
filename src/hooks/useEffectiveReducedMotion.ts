import { useReducedMotion } from "./useReducedMotion";
import { useSettings } from "../state/SettingsProvider";

/** Combines the persisted reduced-motion override with the OS accessibility
 *  setting (goal §6):
 *  - `null`  → follow the OS setting
 *  - `true`  → force reduced motion regardless of OS
 *  - `false` → use normal motion (explicit opt-out)
 *  Reads live settings, so a change in the Settings screen takes effect
 *  immediately for every animation gated on it. */
export function useEffectiveReducedMotion(): boolean {
  const osReduced = useReducedMotion();
  const { settings } = useSettings();
  const override = settings.reducedMotionOverride;
  if (override === null) {
    return osReduced;
  }
  return override;
}
