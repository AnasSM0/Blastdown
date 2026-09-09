import type { FeedbackCueSpec, SemanticFeedbackCue } from "./types";

/** One mix policy for both imperative and committed feedback. Numeric priority
 * is deliberately internal; callers select semantics, never mix levels. */
const FEEDBACK_CATALOG: Record<SemanticFeedbackCue, FeedbackCueSpec> = {
  uiTap: { asset: "button", priority: 10, volume: 0.42, haptic: "none", ducks: false },
  piecePickup: {
    asset: "selection",
    priority: 20,
    volume: 0.48,
    haptic: "selection",
    ducks: false,
  },
  validPlacement: {
    asset: "placement",
    priority: 30,
    volume: 0.58,
    haptic: "lightImpact",
    ducks: false,
  },
  invalidPlacement: {
    asset: "invalid",
    priority: 38,
    volume: 0.62,
    haptic: "warningLight",
    ducks: false,
  },
  timerWarning2: {
    asset: "selection",
    priority: 42,
    volume: 0.58,
    haptic: "warningLight",
    ducks: false,
  },
  timerWarning1: {
    asset: "invalid",
    priority: 48,
    volume: 0.72,
    haptic: "warningStrong",
    ducks: false,
  },
  clearSingle: {
    asset: "lineClear",
    priority: 55,
    volume: 0.7,
    haptic: "mediumImpact",
    ducks: false,
  },
  rubbleCleared: {
    asset: "rubbleClear",
    priority: 58,
    volume: 0.7,
    haptic: "mediumImpact",
    ducks: false,
  },
  clearDouble: {
    asset: "lineClear",
    priority: 62,
    volume: 0.78,
    haptic: "heavyImpact",
    ducks: false,
  },
  clearTriple: {
    asset: "lineClear",
    priority: 68,
    volume: 0.88,
    haptic: "heavyImpact",
    ducks: false,
  },
  clearOverload: {
    asset: "lineClear",
    priority: 74,
    volume: 1,
    haptic: "heavyImpact",
    ducks: false,
  },
  naturalDefuse: {
    asset: "defuse",
    priority: 78,
    volume: 0.82,
    haptic: "success",
    ducks: false,
  },
  defusePowerUpApplied: {
    asset: "defuse",
    priority: 80,
    volume: 0.85,
    haptic: "success",
    ducks: false,
  },
  freezeApplied: {
    asset: "freeze",
    priority: 81,
    volume: 0.82,
    haptic: "success",
    ducks: false,
  },
  clutchDefuse: {
    asset: "defuse",
    priority: 88,
    volume: 1,
    haptic: "successStrong",
    ducks: false,
  },
  gameOver: {
    asset: "gameOver",
    priority: 92,
    volume: 0.9,
    haptic: "terminal",
    ducks: true,
  },
  newBest: {
    asset: "freeze",
    priority: 94,
    volume: 0.9,
    haptic: "successStrong",
    ducks: true,
  },
  explosion: {
    asset: "explosion",
    priority: 100,
    volume: 1,
    haptic: "explosion",
    ducks: true,
  },
  rewardFailure: {
    asset: "invalid",
    priority: 35,
    volume: 0.55,
    haptic: "warningLight",
    ducks: false,
  },
};

export function feedbackSpec(cue: SemanticFeedbackCue): FeedbackCueSpec {
  return FEEDBACK_CATALOG[cue];
}
