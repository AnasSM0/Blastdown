import type { FeedbackCueSpec, SemanticFeedbackCue } from "./types";
import { SFX_AUDIO_MANIFEST } from "../../config/audioManifest";

function cue(
  asset: FeedbackCueSpec["asset"],
  priority: number,
  haptic: FeedbackCueSpec["haptic"],
  ducks = false,
): FeedbackCueSpec {
  return {
    asset,
    priority,
    volume: SFX_AUDIO_MANIFEST[asset].defaultVolume,
    haptic,
    ducks,
  };
}

/** One mix policy for both imperative and committed feedback. Numeric priority
 * is deliberately internal; callers select semantics, never mix levels. */
const FEEDBACK_CATALOG: Record<SemanticFeedbackCue, FeedbackCueSpec> = {
  uiTap: cue("button", 10, "none"),
  piecePickup: cue("selection", 20, "selection"),
  validPlacement: cue("placement", 30, "lightImpact"),
  invalidPlacement: cue("invalid", 38, "warningLight"),
  timerWarning2: cue("timer2", 42, "warningLight"),
  timerWarning1: cue("timer1", 48, "warningStrong"),
  clearSingle: cue("lineClear", 55, "mediumImpact"),
  rubbleCleared: cue("rubbleClear", 58, "mediumImpact"),
  clearDouble: cue("clearDouble", 62, "heavyImpact"),
  clearTriple: cue("clearTriple", 68, "heavyImpact"),
  clearOverload: cue("clearOverload", 74, "heavyImpact"),
  naturalDefuse: cue("defuse", 78, "success"),
  defusePowerUpApplied: cue("defusePowerUp", 80, "success"),
  freezeApplied: cue("freeze", 81, "success"),
  clutchDefuse: cue("clutch", 88, "successStrong"),
  gameOver: cue("gameOver", 92, "terminal", true),
  newBest: cue("newBest", 94, "successStrong", true),
  explosion: cue("explosion", 100, "explosion", true),
  rewardFailure: cue("invalid", 35, "warningLight"),
};

export function feedbackSpec(cue: SemanticFeedbackCue): FeedbackCueSpec {
  return FEEDBACK_CATALOG[cue];
}
