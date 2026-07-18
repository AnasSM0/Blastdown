import { HAND_CATEGORY_WEIGHTS, HAND_SIZE, PIECE_COLOR_IDS } from "../config/balance";
import { nextInt, nextRandom } from "./seededRandom";
import { SHAPE_CATALOG, type ShapeCategory } from "./shapes";
import type { HandPiece } from "./gameTypes";

export type HandGenerationResult = {
  hand: HandPiece[];
  nextRngState: number;
};

function pickWeighted<T>(
  state: number,
  items: readonly T[],
  getWeight: (item: T) => number,
): { item: T; nextState: number } {
  const total = items.reduce((sum, item) => sum + getWeight(item), 0);
  const { value, nextState } = nextRandom(state);
  let threshold = value * total;
  for (const item of items) {
    threshold -= getWeight(item);
    if (threshold <= 0) {
      return { item, nextState };
    }
  }
  return { item: items[items.length - 1], nextState };
}

export type HandGenerationOptions = {
  handSize?: number;
  refillIndex?: number;
  categories?: readonly ShapeCategory[];
};

export function generateHand(
  rngState: number,
  options: HandGenerationOptions = {},
): HandGenerationResult {
  const handSize = options.handSize ?? HAND_SIZE;
  const refillIndex = options.refillIndex ?? 0;
  const allowedCategories =
    options.categories ?? (Object.keys(HAND_CATEGORY_WEIGHTS) as ShapeCategory[]);

  let state = rngState;
  const hand: HandPiece[] = [];

  for (let i = 0; i < handSize; i++) {
    const categoryPick = pickWeighted(
      state,
      allowedCategories,
      (category) => HAND_CATEGORY_WEIGHTS[category],
    );
    state = categoryPick.nextState;

    const shapesInCategory = SHAPE_CATALOG.filter((shape) => shape.category === categoryPick.item);
    const shapePick = pickWeighted(state, shapesInCategory, (shape) => shape.weight);
    state = shapePick.nextState;

    const colorPick = nextInt(state, PIECE_COLOR_IDS.length);
    state = colorPick.nextState;

    hand.push({
      handId: `hand-${refillIndex}-${i}`,
      shapeId: shapePick.item.id,
      colorId: PIECE_COLOR_IDS[colorPick.value],
    });
  }

  return { hand, nextRngState: state };
}
