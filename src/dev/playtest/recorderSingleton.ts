import type { AnalyticsEvent } from "../../services/analytics/types";
import type { PlaytestAction } from "../../services/playtest/types";
import { PlaytestRecorder } from "./PlaytestRecorder";

export const playtestRecorder = new PlaytestRecorder();

export function recordAnalytics(event: AnalyticsEvent): void {
  playtestRecorder.recordAnalytics(event);
}

export function recordAction(action: PlaytestAction): void {
  playtestRecorder.recordAction(action);
}

export function recordError(): void {
  playtestRecorder.recordError();
}
