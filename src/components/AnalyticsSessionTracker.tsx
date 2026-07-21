import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useAnalytics } from "../services/analytics/AnalyticsServiceProvider";

/** Renders nothing; owns the app/session lifecycle events. Emits `app_open` and
 *  `session_start` once on mount, then `session_end` (with the elapsed session
 *  duration) when the app is backgrounded or the tree unmounts — exactly once
 *  per foreground session, and a fresh `session_start` on the next foreground.
 *  Duration is a coarse aggregate; no timestamps or identifiers are sent. */
export function AnalyticsSessionTracker({ now = Date.now }: { now?: () => number }): null {
  const { track } = useAnalytics();
  // Start-of-session wall clock; null while backgrounded (no active session).
  const sessionStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const startSession = (at: number) => {
      if (sessionStartedAtRef.current !== null) {
        return;
      }
      sessionStartedAtRef.current = at;
      track({ name: "session_start" });
    };
    const endSession = (at: number) => {
      const startedAt = sessionStartedAtRef.current;
      if (startedAt === null) {
        return;
      }
      sessionStartedAtRef.current = null;
      track({ name: "session_end", durationMs: Math.max(0, at - startedAt) });
    };

    track({ name: "app_open" });
    startSession(now());

    const onChange = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        endSession(now());
      } else if (next === "active") {
        startSession(now());
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => {
      // End the session before tearing down the listener, so a teardown error
      // in the subscription can never drop the terminal event.
      endSession(now());
      subscription.remove();
    };
    // Mount-once: `track` / `now` are stable for the app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
