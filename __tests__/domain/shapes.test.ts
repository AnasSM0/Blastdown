import { SHAPE_CATALOG, getShapeById, type ShapeDefinition } from "../../src/domain/shapes";

describe("shapes catalog", () => {
  it("contains exactly 12 shapes with unique ids", () => {
    expect(SHAPE_CATALOG).toHaveLength(12);
    const ids = SHAPE_CATALOG.map((shape) => shape.id);
    expect(new Set(ids).size).toBe(12);
  });

  it("every shape has at least one cell, each with non-negative row/column", () => {
    for (const shape of SHAPE_CATALOG) {
      expect(shape.cells.length).toBeGreaterThan(0);
      for (const cell of shape.cells) {
        expect(cell.row).toBeGreaterThanOrEqual(0);
        expect(cell.column).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("every shape has no duplicate cells", () => {
    for (const shape of SHAPE_CATALOG) {
      const keys = shape.cells.map((cell) => `${cell.row},${cell.column}`);
      expect(new Set(keys).size).toBe(shape.cells.length);
    }
  });

  it("categorizes shapes as small, medium, or large", () => {
    const categories = new Set(SHAPE_CATALOG.map((shape) => shape.category));
    expect(categories).toEqual(new Set(["small", "medium", "large"]));
  });

  it("includes the required shapes by cell count", () => {
    const cellCounts = SHAPE_CATALOG.map((shape) => shape.cells.length).sort((a, b) => a - b);
    expect(cellCounts).toEqual([1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4]);
  });

  it("looks up a shape by id", () => {
    const single = getShapeById("single");
    expect(single?.cells).toEqual([{ row: 0, column: 0 }]);
    expect(getShapeById("does-not-exist")).toBeUndefined();
  });

  it("assigns a positive weight to every shape", () => {
    for (const shape of SHAPE_CATALOG) {
      expect(shape.weight).toBeGreaterThan(0);
    }
  });

  it("satisfies the ShapeDefinition shape", () => {
    const shape: ShapeDefinition = SHAPE_CATALOG[0];
    expect(typeof shape.id).toBe("string");
  });
});
