import { generateHand } from "../../src/domain/handGeneration";
import { createInitialRngState } from "../../src/domain/seededRandom";
import { getShapeById } from "../../src/domain/shapes";
import { PIECE_COLOR_IDS } from "../../src/config/balance";

describe("handGeneration", () => {
  it("generates a hand of 3 pieces by default", () => {
    const state = createInitialRngState("hand-seed");
    const result = generateHand(state);
    expect(result.hand).toHaveLength(3);
  });

  it("generates a hand of the requested size", () => {
    const state = createInitialRngState("hand-seed");
    const result = generateHand(state, { handSize: 5 });
    expect(result.hand).toHaveLength(5);
  });

  it("prefixes handIds with the refill index so ids are unique across refills", () => {
    const state = createInitialRngState("hand-seed");
    const first = generateHand(state, { refillIndex: 0 });
    const second = generateHand(first.nextRngState, { refillIndex: 1 });
    const allIds = [...first.hand, ...second.hand].map((piece) => piece.handId);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("restricts generation to the requested categories", () => {
    let state = createInitialRngState("category-seed");
    for (let i = 0; i < 50; i++) {
      const result = generateHand(state, {
        categories: ["small", "medium"],
      });
      for (const piece of result.hand) {
        expect(getShapeById(piece.shapeId)!.category).not.toBe("large");
      }
      state = result.nextRngState;
    }
  });

  it("every generated piece references a real shape in the catalog", () => {
    const state = createInitialRngState("hand-seed");
    const result = generateHand(state);
    for (const piece of result.hand) {
      expect(getShapeById(piece.shapeId)).toBeDefined();
    }
  });

  it("every generated piece has a colorId from the palette", () => {
    const state = createInitialRngState("hand-seed");
    const result = generateHand(state);
    for (const piece of result.hand) {
      expect(PIECE_COLOR_IDS).toContain(piece.colorId);
    }
  });

  it("every generated piece in a hand has a unique handId", () => {
    const state = createInitialRngState("hand-seed");
    const result = generateHand(state, { handSize: 5 });
    const ids = result.hand.map((piece) => piece.handId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic for the same rng state", () => {
    const state = createInitialRngState("hand-seed");
    const first = generateHand(state);
    const second = generateHand(state);
    expect(first).toEqual(second);
  });

  it("returns a nextRngState different from the input state", () => {
    const state = createInitialRngState("hand-seed");
    const result = generateHand(state);
    expect(result.nextRngState).not.toBe(state);
  });

  it("distributes shape categories roughly per the 40/40/20 weighted bag over many draws", () => {
    let state = createInitialRngState("distribution-seed");
    const counts: Record<string, number> = { small: 0, medium: 0, large: 0 };
    const draws = 3000;

    for (let i = 0; i < draws; i++) {
      const result = generateHand(state, { handSize: 1 });
      const shape = getShapeById(result.hand[0].shapeId)!;
      counts[shape.category] += 1;
      state = result.nextRngState;
    }

    expect(counts.small / draws).toBeGreaterThan(0.3);
    expect(counts.small / draws).toBeLessThan(0.5);
    expect(counts.medium / draws).toBeGreaterThan(0.3);
    expect(counts.medium / draws).toBeLessThan(0.5);
    expect(counts.large / draws).toBeGreaterThan(0.1);
    expect(counts.large / draws).toBeLessThan(0.3);
  });
});
