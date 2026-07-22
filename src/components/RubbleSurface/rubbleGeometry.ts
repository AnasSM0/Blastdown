/** A single crack line across a rubble tile, positioned and sized in percentages
 *  of the cell so it scales with the board. `fissure` marks the one crack that
 *  also carries the restrained warm ember seam. */
export type RubbleCrack = {
  topPct: number;
  leftPct: number;
  lengthPct: number;
  rotateDeg: number;
  fissure: boolean;
};

/** A subtle angular patch that gives the tile broken-surface depth. */
export type RubbleFacet = {
  topPct: number;
  leftPct: number;
  widthPct: number;
  heightPct: number;
  rotateDeg: number;
};

export type RubbleGeometry = {
  cracks: RubbleCrack[];
  facets: RubbleFacet[];
};

// Preset crack layouts — each has two or three irregular cracks with exactly one
// fissure. Chosen (not randomized) per cell so a board of rubble looks varied but
// renders deterministically: the same cell always draws the same damage.
const CRACK_SETS: readonly RubbleCrack[][] = [
  [
    { topPct: 20, leftPct: 6, lengthPct: 72, rotateDeg: 26, fissure: true },
    { topPct: 60, leftPct: 22, lengthPct: 50, rotateDeg: -44, fissure: false },
    { topPct: 46, leftPct: 54, lengthPct: 32, rotateDeg: 68, fissure: false },
  ],
  [
    { topPct: 32, leftPct: 12, lengthPct: 64, rotateDeg: -20, fissure: true },
    { topPct: 66, leftPct: 34, lengthPct: 44, rotateDeg: 38, fissure: false },
  ],
  [
    { topPct: 24, leftPct: 24, lengthPct: 56, rotateDeg: 48, fissure: false },
    { topPct: 54, leftPct: 10, lengthPct: 66, rotateDeg: -16, fissure: true },
    { topPct: 74, leftPct: 44, lengthPct: 30, rotateDeg: 22, fissure: false },
  ],
  [
    { topPct: 28, leftPct: 16, lengthPct: 60, rotateDeg: 12, fissure: true },
    { topPct: 58, leftPct: 40, lengthPct: 46, rotateDeg: -52, fissure: false },
  ],
];

const FACET_SETS: readonly RubbleFacet[][] = [
  [{ topPct: 8, leftPct: 42, widthPct: 48, heightPct: 42, rotateDeg: 18 }],
  [
    { topPct: 48, leftPct: 6, widthPct: 42, heightPct: 46, rotateDeg: -12 },
    { topPct: 10, leftPct: 52, widthPct: 34, heightPct: 30, rotateDeg: 26 },
  ],
];

/** Deterministic damage for the rubble at (row, column): no random values, so a
 *  cell renders identically every frame and across sessions, and a full board of
 *  rubble still shows varied cracking. */
export function getRubbleGeometry(row: number, column: number): RubbleGeometry {
  const crackIndex =
    (((row * 3 + column * 7) % CRACK_SETS.length) + CRACK_SETS.length) % CRACK_SETS.length;
  const facetIndex = (((row + column) % FACET_SETS.length) + FACET_SETS.length) % FACET_SETS.length;
  return { cracks: CRACK_SETS[crackIndex], facets: FACET_SETS[facetIndex] };
}
