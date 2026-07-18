import { startingCountdownForTurn } from "../../src/domain/timers";
import { TIMED_COUNTDOWN_TIERS } from "../../src/config/balance";

describe("timers", () => {
  it("uses the balance tiers: 1-15 -> 7, 16-40 -> 6, 41-75 -> 5, 76+ -> 4", () => {
    expect(startingCountdownForTurn(1)).toBe(7);
    expect(startingCountdownForTurn(15)).toBe(7);
    expect(startingCountdownForTurn(16)).toBe(6);
    expect(startingCountdownForTurn(40)).toBe(6);
    expect(startingCountdownForTurn(41)).toBe(5);
    expect(startingCountdownForTurn(75)).toBe(5);
    expect(startingCountdownForTurn(76)).toBe(4);
    expect(startingCountdownForTurn(500)).toBe(4);
  });

  it("reads values from the central balance config, not hardcoded copies", () => {
    const firstTier = TIMED_COUNTDOWN_TIERS.find((tier) => tier.minTurn === 1)!;
    expect(startingCountdownForTurn(1)).toBe(firstTier.countdown);
  });
});
