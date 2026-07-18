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

/** Starting countdown by run turn (BUILD_SPEC.md §6.9). Scanned for the
 *  highest minTurn <= turn, so keep entries sorted descending. */
export const TIMED_COUNTDOWN_TIERS: readonly {
  minTurn: number;
  countdown: number;
}[] = [
  { minTurn: 76, countdown: 4 },
  { minTurn: 41, countdown: 5 },
  { minTurn: 16, countdown: 6 },
  { minTurn: 1, countdown: 7 },
];

export const DEFUSE_BONUS_BASE = 25;

export const DEFUSE_BONUS_PER_REMAINING_TURN = 10;

/** Remaining-turn values that emit a timerWarning event (BUILD_SPEC.md §6.11). */
export const TIMER_WARNING_VALUES: readonly number[] = [2, 1];

export const EXPLOSION_SCORE_PENALTY = 50;

/** Max empty orthogonal neighbours converted to rubble per expired piece. */
export const EXPLOSION_ADJACENT_RUBBLE_MAX_PER_PIECE = 4;

/** Max adjacent rubble added across all expirations in one turn. */
export const EXPLOSION_ADJACENT_RUBBLE_MAX_PER_TURN = 6;

/** Successful placements a freeze lasts for (BUILD_SPEC.md §6.16). */
export const FREEZE_PLACEMENTS = 2;

export const MAX_REWARDED_FREEZES_PER_RUN = 2;

export const MAX_REWARDED_DEFUSES_PER_RUN = 2;

export const REVIVE_TIMER_BONUS = 2;

export const REVIVE_TIMER_CAP = 9;

export const REVIVE_HAND_CATEGORIES: readonly ShapeCategory[] = ["small", "medium"];
