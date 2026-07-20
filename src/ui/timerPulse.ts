import type { TimerVisualState } from "./timerStates";

export type PulseConfig = {
  /** Peak scale of the breathing pulse. */
  scaleTo: number;
  /** Half-cycle duration in ms (grow, then shrink). */
  halfCycleMs: number;
};

/** The warning/urgent timer badges breathe (docs/ANIMATION_SPEC.md "Timer
 *  badge states"): warning (2 moves) is a restrained pulse, urgent (1 move) a
 *  stronger, faster one. Returns null — meaning "render static" — for the calm
 *  states and, crucially, whenever reduced motion is on, so the same code path
 *  gates every looping transform (BUILD_SPEC.md §19). Pure and synchronous so
 *  the gating is unit-testable without mounting Animated. */
export function getPulseConfig(
  visualState: TimerVisualState,
  reducedMotion: boolean,
): PulseConfig | null {
  if (reducedMotion) {
    return null;
  }
  if (visualState === "urgent") {
    return { scaleTo: 1.14, halfCycleMs: 550 };
  }
  if (visualState === "warning") {
    return { scaleTo: 1.06, halfCycleMs: 1000 };
  }
  return null;
}
