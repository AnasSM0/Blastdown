/** Visual display states for timer countdowns per BUILD_SPEC.md §6.11 and
 *  docs/STYLE_GUIDE.md's timer-badge table. Display thresholds are visual
 *  spec, not gameplay balance — the countdown values themselves come from
 *  the domain. */
export type TimerVisualState = "normal" | "caution" | "warning" | "urgent";

export function getTimerVisualState(remainingTurns: number): TimerVisualState {
  if (remainingTurns <= 1) {
    return "urgent";
  }
  if (remainingTurns === 2) {
    return "warning";
  }
  if (remainingTurns <= 4) {
    return "caution";
  }
  return "normal";
}
