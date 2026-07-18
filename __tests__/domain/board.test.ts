import { BOARD_SIZE, createEmptyBoard } from "../../src/domain/board";

describe("board", () => {
  it("BOARD_SIZE is exactly 8", () => {
    expect(BOARD_SIZE).toBe(8);
  });

  it("creates an 8x8 board of empty cells", () => {
    const board = createEmptyBoard();
    expect(board).toHaveLength(8);
    for (const row of board) {
      expect(row).toHaveLength(8);
      for (const cell of row) {
        expect(cell).toEqual({ kind: "empty" });
      }
    }
  });

  it("creates independent row arrays (no shared references)", () => {
    const board = createEmptyBoard();
    board[0][0] = { kind: "normal", colorId: "cyan" };
    expect(board[1][0]).toEqual({ kind: "empty" });
  });

  it("creates a fresh board on every call", () => {
    const first = createEmptyBoard();
    const second = createEmptyBoard();
    first[3][3] = { kind: "rubble", explosionId: "e1" };
    expect(second[3][3]).toEqual({ kind: "empty" });
  });
});
