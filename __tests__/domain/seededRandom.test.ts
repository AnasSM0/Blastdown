import { createInitialRngState, nextInt, nextRandom } from "../../src/domain/seededRandom";

describe("seededRandom", () => {
  it("derives a numeric initial state deterministically from a string seed", () => {
    expect(createInitialRngState("run-seed-1")).toBe(createInitialRngState("run-seed-1"));
  });

  it("derives different states for different seeds", () => {
    expect(createInitialRngState("seed-a")).not.toBe(createInitialRngState("seed-b"));
  });

  it("nextRandom is a pure function of its input state", () => {
    const state = createInitialRngState("pure-check");
    const first = nextRandom(state);
    const second = nextRandom(state);
    expect(first).toEqual(second);
  });

  it("nextRandom returns a value in [0, 1)", () => {
    let state = createInitialRngState("range-check");
    for (let i = 0; i < 100; i++) {
      const result = nextRandom(state);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(1);
      state = result.nextState;
    }
  });

  it("reproduces an identical sequence from the same seed", () => {
    const runSequence = (seed: string): number[] => {
      let state = createInitialRngState(seed);
      const values: number[] = [];
      for (let i = 0; i < 10; i++) {
        const result = nextRandom(state);
        values.push(result.value);
        state = result.nextState;
      }
      return values;
    };

    expect(runSequence("deterministic-seed")).toEqual(runSequence("deterministic-seed"));
  });

  it("nextInt returns an integer within [0, maxExclusive)", () => {
    let state = createInitialRngState("int-check");
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const result = nextInt(state, 6);
      expect(Number.isInteger(result.value)).toBe(true);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(6);
      seen.add(result.value);
      state = result.nextState;
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });
});
