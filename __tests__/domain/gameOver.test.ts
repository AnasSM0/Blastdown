import { canPlaceShapeAnywhere, isGameOver } from "../../src/domain/gameOver";
import type { GridCell, HandPiece } from "../../src/domain/gameTypes";
import { getShapeById } from "../../src/domain/shapes";

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function makeFullGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "normal", colorId: "cyan" })),
  );
}

function handOf(...shapeIds: string[]): HandPiece[] {
  return shapeIds.map((shapeId, index) => ({
    handId: `hand-${index}`,
    shapeId,
    colorId: "cyan",
  }));
}

describe("gameOver", () => {
  const single = getShapeById("single")!;
  const line2h = getShapeById("line2h")!;

  it("canPlaceShapeAnywhere is true for any shape on an empty board", () => {
    const grid = makeEmptyGrid(8);
    expect(canPlaceShapeAnywhere(grid, line2h)).toBe(true);
  });

  it("canPlaceShapeAnywhere is false when the board is completely full", () => {
    const grid = makeFullGrid(8);
    expect(canPlaceShapeAnywhere(grid, single)).toBe(false);
  });

  it("canPlaceShapeAnywhere is true when exactly one matching gap exists", () => {
    const grid = makeFullGrid(8);
    grid[3][3] = { kind: "empty" };
    expect(canPlaceShapeAnywhere(grid, single)).toBe(true);
  });

  it("canPlaceShapeAnywhere is false when the only gap is too small for the shape", () => {
    const grid = makeFullGrid(8);
    grid[3][3] = { kind: "empty" };
    expect(canPlaceShapeAnywhere(grid, line2h)).toBe(false);
  });

  it("isGameOver is false when the board is empty", () => {
    const grid = makeEmptyGrid(8);
    expect(isGameOver(grid, handOf("single", "line2h"))).toBe(false);
  });

  it("isGameOver is true when the board is full", () => {
    const grid = makeFullGrid(8);
    expect(isGameOver(grid, handOf("single", "line2h"))).toBe(true);
  });

  it("isGameOver is false if at least one hand piece still fits", () => {
    const grid = makeFullGrid(8);
    grid[3][3] = { kind: "empty" };
    expect(isGameOver(grid, handOf("single", "line2h"))).toBe(false);
  });

  it("isGameOver is true if the only gap fits none of the hand pieces", () => {
    const grid = makeFullGrid(8);
    grid[3][3] = { kind: "empty" };
    expect(isGameOver(grid, handOf("line2h"))).toBe(true);
  });

  it("rubble also blocks placement for game-over purposes", () => {
    const grid = makeEmptyGrid(8);
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        if (!(row === 3 && column === 3)) {
          grid[row][column] = { kind: "rubble", explosionId: "e1" };
        }
      }
    }
    expect(isGameOver(grid, handOf("line2h"))).toBe(true);
    expect(isGameOver(grid, handOf("single"))).toBe(false);
  });
});
