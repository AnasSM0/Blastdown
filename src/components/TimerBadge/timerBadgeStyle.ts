import type { ViewStyle } from "react-native";

import { glowFor, type ThemePalette } from "../../ui/themes";
import type { TimerVisualState } from "../../ui/timerStates";

/** The flattened visual description of a timer badge for one countdown/frozen
 *  state. Pure and theme-driven so the mapping is unit-testable without
 *  mounting the badge, mirroring src/ui/blockSurface.ts. */
export type BadgeVisual = {
  /** Badge diameter in px — bumped for the critical state's size emphasis. */
  size: number;
  ringColor: string;
  ringWidth: number;
  /** A dashed ring is the frozen state's non-color "held/paused" cue. */
  dashed: boolean;
  numeralColor: string;
  glow: ViewStyle | null;
  /** Which pulse profile drives motion. Calm and frozen states resolve to
   *  "normal", which getPulseConfig renders static — so frozen never breathes
   *  (its timer is paused) and the pulse gating stays in one place. */
  pulseState: TimerVisualState;
};

const BASE_SIZE = 24;
const WARNING_SIZE = 25;
/** Critical badges are visibly larger — a non-color size emphasis (spec P1-5). */
const URGENT_SIZE = 28;

/** Resolve a timer badge's look from its countdown state plus whether the run's
 *  freeze is active. Each named state (normal / warning-2 / critical-1 / frozen)
 *  differs from the others in at least one non-color attribute — ring width,
 *  size, or a dashed ring — so state is never communicated by color alone. The
 *  block color underneath is untouched; this styles only the floating badge. */
export function getBadgeVisual(
  visualState: TimerVisualState,
  frozen: boolean,
  theme: ThemePalette,
): BadgeVisual {
  // Freeze pauses every timer, so it overrides the countdown emphasis: an icy
  // ring, a dashed (held) outline, and no pulse.
  if (frozen) {
    const ring = theme.timerFrozen;
    return {
      size: BASE_SIZE,
      ringColor: ring,
      ringWidth: 2,
      dashed: true,
      numeralColor: ring,
      glow: glowFor(theme, ring, "low"),
      pulseState: "normal",
    };
  }

  switch (visualState) {
    case "urgent":
      // Critical (1 move): strongest danger ring, larger size, high glow, pulse.
      return {
        size: URGENT_SIZE,
        ringColor: theme.timerCritical,
        ringWidth: 3,
        dashed: false,
        numeralColor: theme.timerCritical,
        glow: glowFor(theme, theme.timerCritical, "high"),
        pulseState: "urgent",
      };
    case "warning":
      // Warning (2 moves): restrained amber emphasis — a medium-weight ring.
      return {
        size: WARNING_SIZE,
        ringColor: theme.timerWarning,
        ringWidth: 2.25,
        dashed: false,
        numeralColor: theme.timerWarning,
        glow: glowFor(theme, theme.timerWarning, "high"),
        pulseState: "warning",
      };
    case "caution":
      // Pre-warning (3–4 moves): a calm amber hint, thin ring, no pulse.
      return {
        size: BASE_SIZE,
        ringColor: theme.timerWarning,
        ringWidth: 1,
        dashed: false,
        numeralColor: theme.timerWarning,
        glow: glowFor(theme, theme.timerWarning, "low"),
        pulseState: "normal",
      };
    case "normal":
    default:
      return {
        size: BASE_SIZE,
        ringColor: theme.timerNormal,
        ringWidth: 1,
        dashed: false,
        numeralColor: theme.timerNormal,
        glow: glowFor(theme, theme.timerNormal, "low"),
        pulseState: "normal",
      };
  }
}
