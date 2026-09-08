import type { GameEvent } from "../domain/events";

export type ScoreImpactLevel = 1 | 2 | 3;
export type ScoreImpactReason =
  "singleClear" | "multiClear" | "overloadClear" | "naturalDefuse" | "majorDefuse";

export type ScoreImpact = {
  id: string;
  turn: number;
  level: ScoreImpactLevel;
  delta: number;
  reason: ScoreImpactReason;
};

/** Derive HUD impact from the committed outcome and its actual score delta.
 * It never recomputes scoring and intentionally ignores ordinary placement. */
export function resolveScoreImpactForTurn(
  events: readonly GameEvent[],
  turn: number,
): ScoreImpact | null {
  let delta: number | null = null;
  let lineCount = 0;
  const defuses: Extract<GameEvent, { type: "pieceDefused" }>[] = [];

  for (const event of events) {
    if (event.type === "scoreChanged") {
      delta = event.delta;
    } else if (event.type === "linesCleared") {
      lineCount += event.rows.length + event.columns.length;
    } else if (event.type === "pieceDefused") {
      defuses.push(event);
    }
  }
  if (delta === null || delta <= 0 || (lineCount === 0 && defuses.length === 0)) {
    return null;
  }

  let level: ScoreImpactLevel;
  let reason: ScoreImpactReason;
  const majorDefuse = defuses.length >= 2 || defuses.some((event) => event.remainingTurns === 1);
  if (majorDefuse) {
    level = 3;
    reason = "majorDefuse";
  } else if (lineCount >= 4) {
    level = 3;
    reason = "overloadClear";
  } else if (defuses.length > 0) {
    level = 2;
    reason = "naturalDefuse";
  } else if (lineCount >= 2) {
    level = 2;
    reason = "multiClear";
  } else {
    level = 1;
    reason = "singleClear";
  }

  return {
    id: `score-impact:${turn}:${level}:${delta}:${reason}`,
    turn,
    level,
    delta,
    reason,
  };
}
