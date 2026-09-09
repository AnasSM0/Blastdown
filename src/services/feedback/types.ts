import type { SfxAssetName } from "../audio/types";

/** Renderer-independent feedback vocabulary. These names describe player
 * meaning, never a filename or animation implementation. */
export type SemanticFeedbackCue =
  | "uiTap"
  | "piecePickup"
  | "validPlacement"
  | "invalidPlacement"
  | "clearSingle"
  | "clearDouble"
  | "clearTriple"
  | "clearOverload"
  | "timerWarning2"
  | "timerWarning1"
  | "naturalDefuse"
  | "clutchDefuse"
  | "freezeApplied"
  | "defusePowerUpApplied"
  | "explosion"
  | "rubbleCleared"
  | "gameOver"
  | "newBest"
  | "rewardFailure";

/** One native haptic call per semantic event. Relative strength is expressed
 * here and translated to expo-haptics only by useHaptics. */
export type HapticPattern =
  | "none"
  | "selection"
  | "lightImpact"
  | "mediumImpact"
  | "heavyImpact"
  | "warningLight"
  | "warningStrong"
  | "success"
  | "successStrong"
  | "explosion"
  | "terminal";

export type FeedbackCueSpec = {
  asset: SfxAssetName;
  priority: number;
  volume: number;
  haptic: HapticPattern;
  ducks: boolean;
};

/** Identity is mandatory for service-level dedupe. Imperative interaction
 * callers get a generated identity from useFeedback; committed turns use a
 * stable session-generation + turn identity. */
export type FeedbackRequest = {
  identity: string;
  cue: SemanticFeedbackCue;
  semitones?: number;
};

export type ResolvedFeedback = FeedbackRequest & {
  haptic: HapticPattern;
};
