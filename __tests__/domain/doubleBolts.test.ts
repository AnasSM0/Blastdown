import { createInitialGameState } from "../../src/domain/game";
import { applyDoubleBolts, computeBoltsEarned } from "../../src/services/profile/settlement";
import { defaultProfile, type PersistedProfile } from "../../src/services/storage/schemas";

const NOW = 1_752_800_000_000;

function profileWith(bolts: number): PersistedProfile {
  return { ...defaultProfile(NOW), bolts };
}

describe("applyDoubleBolts", () => {
  it("banks the run's earned Bolts a second time", () => {
    const state = { ...createInitialGameState("s", NOW), score: 1200, piecesDefused: 3 };
    const earned = computeBoltsEarned(state); // floor(1200/250) + 3 = 4 + 3 = 7
    const before = profileWith(100);

    const after = applyDoubleBolts(before, earned);

    expect(after.bolts).toBe(107);
  });

  it("clamps a negative amount to zero (never reduces a balance)", () => {
    const before = profileWith(50);
    expect(applyDoubleBolts(before, -20).bolts).toBe(50);
  });

  it("does not mutate the input profile", () => {
    const before = profileWith(50);
    applyDoubleBolts(before, 10);
    expect(before.bolts).toBe(50);
  });
});
