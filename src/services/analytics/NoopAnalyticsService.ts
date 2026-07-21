import type { AnalyticsService } from "./types";

/** Does nothing. The default when no provider is mounted and the safe fallback
 *  offline: dropping an event is always allowed, and it never touches the
 *  network — so gameplay is unaffected whether analytics is wired or not. */
export const NoopAnalyticsService: AnalyticsService = {
  track() {
    // Intentionally empty — events are dropped.
  },
};
