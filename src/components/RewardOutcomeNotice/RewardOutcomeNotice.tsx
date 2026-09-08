import { StyleSheet, Text } from "react-native";

import { colors, typography } from "../../ui/theme";
import type { RewardActionPhase } from "../../ui/effects/rewardPhase";

type RewardOutcomeNoticeProps = {
  phase: RewardActionPhase;
  /** Shown instead of the generic wording when the reward is ruled out by the
   *  game itself rather than by an ad outcome (e.g. already used this run). */
  unavailable?: boolean;
  testID?: string;
};

/** Wording matched to the dock's own captions so an outcome reads the same on
 *  every reward surface. Kept short: this is a status line, not an apology. */
function captionFor(phase: RewardActionPhase, unavailable: boolean): string | null {
  if (unavailable) {
    return "NOT AVAILABLE";
  }
  switch (phase) {
    case "pending":
      return "LOADING AD…";
    case "success":
      return "✓ DONE";
    case "failure":
      return "AD FAILED · NOTHING SPENT";
    case "cancelled":
      return "CANCELLED · NOTHING SPENT";
    case "unapplied":
      // The ad played but the reward could not land (already used this run, or
      // the game rejected it). Say so plainly — never as a success.
      return "ALREADY USED · NOT APPLIED";
    case "idle":
      return null;
  }
}

function colorFor(phase: RewardActionPhase, unavailable: boolean): string {
  if (unavailable) {
    return colors.onSurfaceVariant;
  }
  switch (phase) {
    case "success":
      return colors.cyanBlock;
    case "failure":
    case "unapplied":
      return colors.urgentRed;
    default:
      return colors.onSurfaceVariant;
  }
}

/** @deprecated Dormant legacy presentation with no V1 production caller.
 * The shared success / cancelled / failure / unavailable line for the reward
 *  surfaces that have no dock button of their own (game-over Revive, results
 *  Double Bolts). Static text — the outcome is conveyed by words, never by
 *  color or motion alone, and it stays legible under reduced motion because it
 *  never animates. */
export function RewardOutcomeNotice({
  phase,
  unavailable = false,
  testID,
}: RewardOutcomeNoticeProps) {
  const caption = captionFor(phase, unavailable);
  if (caption === null) {
    return null;
  }
  return (
    <Text
      style={[styles.notice, { color: colorFor(phase, unavailable) }]}
      testID={testID}
      accessibilityLiveRegion="polite"
      numberOfLines={2}
    >
      {caption}
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: {
    ...typography.labelCaps,
    fontSize: 10,
    textAlign: "center",
  },
});
