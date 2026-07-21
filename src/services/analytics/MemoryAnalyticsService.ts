import type { AnalyticsEvent, AnalyticsEventName, AnalyticsService } from "./types";

export type MemoryAnalyticsService = AnalyticsService & {
  /** Every event recorded, in call order — for test assertions. */
  readonly events: AnalyticsEvent[];
  /** Events matching a name, in order. */
  byName<N extends AnalyticsEventName>(name: N): Extract<AnalyticsEvent, { name: N }>[];
  /** How many events of a given name were recorded. */
  count(name: AnalyticsEventName): number;
  /** Drop all recorded events. */
  reset(): void;
};

/** In-memory `AnalyticsService` for development and tests: records every event
 *  synchronously, no network, no vendor SDK. Optionally `throwOnTrack` to prove
 *  a failing analytics backend never crashes gameplay (the `useAnalytics`
 *  wrapper swallows it). */
export function createMemoryAnalyticsService(
  options: { throwOnTrack?: boolean } = {},
): MemoryAnalyticsService {
  const events: AnalyticsEvent[] = [];
  return {
    events,
    track(event: AnalyticsEvent) {
      if (options.throwOnTrack) {
        throw new Error("analytics backend unavailable");
      }
      events.push(event);
    },
    byName(name) {
      return events.filter((event) => event.name === name) as Extract<
        AnalyticsEvent,
        { name: typeof name }
      >[];
    },
    count(name) {
      return events.reduce((total, event) => total + (event.name === name ? 1 : 0), 0);
    },
    reset() {
      events.length = 0;
    },
  };
}
