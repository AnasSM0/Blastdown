import type { ShapeCategory } from "../domain/shapes";

export const HAND_CATEGORY_WEIGHTS: Record<ShapeCategory, number> = {
  small: 0.4,
  medium: 0.4,
  large: 0.2,
};

export const HAND_SIZE = 3;

export const PIECE_COLOR_IDS = ["cyan", "purple", "amber"] as const;

export const PLACEMENT_SCORE_PER_CELL = 1;

export const LINE_CLEAR_SCORE = 100;

export const MULTI_LINE_MULTIPLIERS: readonly {
  minLines: number;
  multiplier: number;
}[] = [
  { minLines: 4, multiplier: 3 },
  { minLines: 3, multiplier: 2 },
  { minLines: 2, multiplier: 1.5 },
  { minLines: 1, multiplier: 1 },
];

export const COMBO_MULTIPLIER_STEP = 0.25;

export const COMBO_MULTIPLIER_CAP = 3;
