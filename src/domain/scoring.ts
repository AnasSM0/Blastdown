import {
  COMBO_MULTIPLIER_CAP,
  COMBO_MULTIPLIER_STEP,
  LINE_CLEAR_SCORE,
  MULTI_LINE_MULTIPLIERS,
  PLACEMENT_SCORE_PER_CELL,
} from "../config/balance";

export type TurnScoreInput = {
  cellsPlaced: number;
  linesCleared: number;
  previousCombo: number;
};

export type TurnScoreResult = {
  scoreDelta: number;
  nextCombo: number;
};

function getMultiLineMultiplier(linesCleared: number): number {
  const tier = MULTI_LINE_MULTIPLIERS.find((entry) => linesCleared >= entry.minLines);
  return tier?.multiplier ?? 0;
}

function getComboMultiplier(combo: number): number {
  return Math.min(1 + COMBO_MULTIPLIER_STEP * combo, COMBO_MULTIPLIER_CAP);
}

export function calculateTurnScore(input: TurnScoreInput): TurnScoreResult {
  const placementScore = input.cellsPlaced * PLACEMENT_SCORE_PER_CELL;

  if (input.linesCleared <= 0) {
    return { scoreDelta: placementScore, nextCombo: 0 };
  }

  const nextCombo = input.previousCombo + 1;
  const multiLineMultiplier = getMultiLineMultiplier(input.linesCleared);
  const comboMultiplier = getComboMultiplier(nextCombo);
  const lineScore = Math.round(
    input.linesCleared * LINE_CLEAR_SCORE * multiLineMultiplier * comboMultiplier,
  );

  return { scoreDelta: placementScore + lineScore, nextCombo };
}
