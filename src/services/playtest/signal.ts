import type { AnalyticsEvent } from "../analytics/types";
import type { PlaytestAction } from "./types";

/** Development-only bridge. The direct `__DEV__` condition and nested require
 * are load-bearing: Metro folds the recorder dependency out of release bundles. */
export function recordPlaytestAnalytics(event: AnalyticsEvent): void {
  if (__DEV__) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const runtime = require("../../dev/playtest/recorderSingleton") as {
        recordAnalytics: (value: AnalyticsEvent) => void;
      };
      runtime.recordAnalytics(event);
    } catch {
      // Playtest evidence is optional and must never affect the app.
    }
  }
}

export function recordPlaytestAction(action: PlaytestAction): void {
  if (__DEV__) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const runtime = require("../../dev/playtest/recorderSingleton") as {
        recordAction: (value: PlaytestAction) => void;
      };
      runtime.recordAction(action);
    } catch {
      // Playtest evidence is optional and must never affect navigation.
    }
  }
}

export function recordPlaytestError(): void {
  if (__DEV__) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const runtime = require("../../dev/playtest/recorderSingleton") as {
        recordError: () => void;
      };
      runtime.recordError();
    } catch {
      // Playtest evidence is optional and must never affect error reporting.
    }
  }
}
