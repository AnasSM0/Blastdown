import { calculateTurnScore } from "../../src/domain/scoring";

describe("scoring", () => {
  it("awards 1 point per placed cell when no line clears", () => {
    const result = calculateTurnScore({
      cellsPlaced: 3,
      linesCleared: 0,
      previousCombo: 2,
    });
    expect(result.scoreDelta).toBe(3);
  });

  it("resets the combo to zero when no line clears", () => {
    const result = calculateTurnScore({
      cellsPlaced: 3,
      linesCleared: 0,
      previousCombo: 2,
    });
    expect(result.nextCombo).toBe(0);
  });

  it("increments the combo when a line clears", () => {
    const result = calculateTurnScore({
      cellsPlaced: 4,
      linesCleared: 1,
      previousCombo: 0,
    });
    expect(result.nextCombo).toBe(1);
  });

  it("scores placement plus a single line clear with the first-combo multiplier", () => {
    // placement: 4 * 1 = 4
    // line: 100 * 1x (single line) * 1.25x (combo 1) = 125
    const result = calculateTurnScore({
      cellsPlaced: 4,
      linesCleared: 1,
      previousCombo: 0,
    });
    expect(result.scoreDelta).toBe(129);
  });

  it("applies the multi-line bonus multiplier for a 2-line clear", () => {
    // line: 200 * 1.5x (2 lines) * 1.25x (combo 1) = 375
    const result = calculateTurnScore({
      cellsPlaced: 0,
      linesCleared: 2,
      previousCombo: 0,
    });
    expect(result.scoreDelta).toBe(375);
  });

  it("applies the 3x multi-line bonus multiplier for 4+ lines", () => {
    // combo goes 3 -> 4, comboMultiplier = 1 + 0.25*4 = 2
    // line: 400 * 3x (4+ lines) * 2x (combo 4) = 2400
    const result = calculateTurnScore({
      cellsPlaced: 0,
      linesCleared: 4,
      previousCombo: 3,
    });
    expect(result.scoreDelta).toBe(2400);
    expect(result.nextCombo).toBe(4);
  });

  it("caps the combo multiplier at 3x", () => {
    // combo goes 20 -> 21, raw multiplier would be 1 + 0.25*21 = 6.25, capped to 3
    // line: 100 * 1x (single line) * 3x (capped) = 300
    const result = calculateTurnScore({
      cellsPlaced: 0,
      linesCleared: 1,
      previousCombo: 20,
    });
    expect(result.scoreDelta).toBe(300);
  });

  it("always returns an integer score delta", () => {
    const result = calculateTurnScore({
      cellsPlaced: 3,
      linesCleared: 2,
      previousCombo: 5,
    });
    expect(Number.isInteger(result.scoreDelta)).toBe(true);
  });
});
