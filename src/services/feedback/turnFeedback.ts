import type { GameEvent } from "../../domain/events";
import { feedbackSpec } from "./catalog";
import type { ResolvedFeedback, SemanticFeedbackCue } from "./types";

export type TurnFeedbackInput = {
  sessionGeneration: number;
  turn: number;
  events: readonly GameEvent[];
  combo: number;
  newBest: boolean;
};

export function comboPitchSemitones(combo: number): number {
  return Math.min(12, Math.max(0, Math.floor(combo) - 1));
}

export function playbackRateForSemitones(semitones: number): number {
  return 2 ** (Math.min(12, Math.max(0, semitones)) / 12);
}

function clearCue(count: number): SemanticFeedbackCue | null {
  if (count >= 4) return "clearOverload";
  if (count === 3) return "clearTriple";
  if (count === 2) return "clearDouble";
  if (count === 1) return "clearSingle";
  return null;
}

/** Resolve one committed turn to one dominant semantic result. This is the
 * anti-soup boundary: placement, clear, defuse, warning, terminal and explosion
 * candidates may coexist in GameEvent[], but only the strongest meaningful
 * outcome is emitted. No board state or animation state is inspected. */
export function resolveTurnFeedback(input: TurnFeedbackInput): ResolvedFeedback | null {
  if (input.turn <= 0 || input.events.length === 0) {
    return null;
  }

  const candidates: SemanticFeedbackCue[] = [];
  let clearedLines = 0;
  let hasGameOver = false;

  for (const event of input.events) {
    switch (event.type) {
      case "piecePlaced":
        candidates.push("validPlacement");
        break;
      case "linesCleared":
        clearedLines = Math.max(clearedLines, event.rows.length + event.columns.length);
        break;
      case "pieceDefused":
        candidates.push(event.remainingTurns === 1 ? "clutchDefuse" : "naturalDefuse");
        break;
      case "timerWarning":
        if (event.remainingTurns === 1) candidates.push("timerWarning1");
        if (event.remainingTurns === 2) candidates.push("timerWarning2");
        break;
      case "explosionStarted":
        candidates.push("explosion");
        break;
      case "rubbleCleared":
        candidates.push("rubbleCleared");
        break;
      case "gameOver":
        hasGameOver = true;
        break;
      default:
        break;
    }
  }

  const resolvedClear = clearCue(clearedLines);
  if (resolvedClear) candidates.push(resolvedClear);
  if (hasGameOver) candidates.push(input.newBest ? "newBest" : "gameOver");

  const cue = candidates.sort((a, b) => feedbackSpec(b).priority - feedbackSpec(a).priority)[0];
  if (!cue) {
    return null;
  }
  const clear = cue.startsWith("clear");
  return {
    identity: `s${input.sessionGeneration}:t${input.turn}`,
    cue,
    haptic: feedbackSpec(cue).haptic,
    ...(clear ? { semitones: comboPitchSemitones(input.combo) } : {}),
  };
}
