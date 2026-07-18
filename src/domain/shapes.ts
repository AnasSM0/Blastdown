export type ShapeCell = {
  row: number;
  column: number;
};

export type ShapeCategory = "small" | "medium" | "large";

export type ShapeDefinition = {
  id: string;
  cells: readonly ShapeCell[];
  category: ShapeCategory;
  weight: number;
};

export const SHAPE_CATALOG: readonly ShapeDefinition[] = [
  {
    id: "single",
    cells: [{ row: 0, column: 0 }],
    category: "small",
    weight: 1,
  },
  {
    id: "line2h",
    cells: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
    ],
    category: "small",
    weight: 1,
  },
  {
    id: "line2v",
    cells: [
      { row: 0, column: 0 },
      { row: 1, column: 0 },
    ],
    category: "small",
    weight: 1,
  },
  {
    id: "line3h",
    cells: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ],
    category: "medium",
    weight: 1,
  },
  {
    id: "line3v",
    cells: [
      { row: 0, column: 0 },
      { row: 1, column: 0 },
      { row: 2, column: 0 },
    ],
    category: "medium",
    weight: 1,
  },
  {
    id: "line4h",
    cells: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 0, column: 3 },
    ],
    category: "large",
    weight: 1,
  },
  {
    id: "line4v",
    cells: [
      { row: 0, column: 0 },
      { row: 1, column: 0 },
      { row: 2, column: 0 },
      { row: 3, column: 0 },
    ],
    category: "large",
    weight: 1,
  },
  {
    id: "square2x2",
    cells: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ],
    category: "medium",
    weight: 1,
  },
  {
    id: "lSmall",
    cells: [
      { row: 0, column: 0 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ],
    category: "small",
    weight: 1,
  },
  {
    id: "lSmallMirrored",
    cells: [
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ],
    category: "small",
    weight: 1,
  },
  {
    id: "lLarge",
    cells: [
      { row: 0, column: 0 },
      { row: 1, column: 0 },
      { row: 2, column: 0 },
      { row: 2, column: 1 },
    ],
    category: "large",
    weight: 1,
  },
  {
    id: "tShape",
    cells: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 1, column: 1 },
    ],
    category: "large",
    weight: 1,
  },
];

export function getShapeById(id: string): ShapeDefinition | undefined {
  return SHAPE_CATALOG.find((shape) => shape.id === id);
}
