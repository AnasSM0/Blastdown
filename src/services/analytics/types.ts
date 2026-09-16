/** Analytics event taxonomy (docs/ANALYTICS.md). Every event is a closed,
 *  typed shape: a `name` literal plus a small, fixed set of *aggregate*
 *  properties. There is deliberately no place to attach free text, a device
 *  identifier, precise location, or raw game/board state — the type system is
 *  the first line of the privacy contract. `setting` is an enumerated id, not
 *  user input. */

/** Outcome of a rewarded placement, normalized for analytics. Maps the ad
 *  service's `RewardedResult` ("error" → "failed") plus the "unavailable"
 *  branch. The paired `*_offer` event marks that the ad was actually
 *  requested; the `*_result` event records how it resolved. */
export type RewardResultOutcome = "earned" | "closed" | "unavailable" | "failed";

/** The full set of events BlastDown emits. Discriminated on `name`. Properties
 *  are numbers, booleans, or enumerated ids only. */
export type AnalyticsEvent =
  // App / session lifecycle.
  | { name: "app_open" }
  | { name: "session_start" }
  | { name: "session_end"; durationMs: number }
  // Tutorial.
  | { name: "tutorial_start" }
  | { name: "tutorial_step"; step: number }
  | { name: "tutorial_complete" }
  | { name: "tutorial_skip"; step: number }
  // Run lifecycle.
  | { name: "run_start" }
  | { name: "piece_selected" }
  | { name: "piece_placed"; turn: number; combo: number }
  | { name: "piece_rejected" }
  | { name: "line_clear"; lineCount: number; combo: number }
  | { name: "piece_defused"; bonus: number }
  | { name: "explosion" }
  | { name: "rubble_cleared"; cellCount: number }
  // Rewarded offers / results.
  | { name: "freeze_offer" }
  | { name: "freeze_result"; result: RewardResultOutcome }
  | { name: "defuse_offer" }
  | { name: "defuse_result"; result: RewardResultOutcome }
  // Run end + results.
  | {
      name: "run_end";
      score: number;
      turn: number;
      bestCombo: number;
      linesCleared: number;
      piecesPlaced: number;
      piecesDefused: number;
      explosions: number;
      rubbleCleared: number;
      durationMs: number;
    }
  | { name: "results_view" }
  // Settings.
  | { name: "settings_changed"; setting: string; value: number };

/** Convenience: the string literal names of every event, for docs/tests. */
export type AnalyticsEventName = AnalyticsEvent["name"];

/** The seam every screen/hook talks to (never a vendor SDK directly). `track`
 *  is fire-and-forget and MUST NOT throw — implementations swallow their own
 *  errors, and `useAnalytics` wraps the call in a second guard so a failing
 *  provider can never affect gameplay. A real vendor adapter queues events and
 *  drops safely when the network/SDK is unavailable; the app never awaits it. */
export interface AnalyticsService {
  track(event: AnalyticsEvent): void;
}
