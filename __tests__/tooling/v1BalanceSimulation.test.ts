import {
  POWER_UP_LIMITS,
  SIMULATION_STRATEGIES,
  simulatePopulation,
  simulateRun,
} from "../../scripts/balance-simulation/v1BalanceSimulation";

describe("V1 deterministic balance simulation", () => {
  it.each(SIMULATION_STRATEGIES)("replays %s identically from the same seed", (strategy) => {
    expect(simulateRun(strategy, "deterministic-seed", 120)).toEqual(
      simulateRun(strategy, "deterministic-seed", 120),
    );
  });

  it.each(SIMULATION_STRATEGIES)("uses the real engine without corrupting %s runs", (strategy) => {
    const run = simulateRun(strategy, `integrity-${strategy}`, 120);
    expect(run.turns).toBeGreaterThan(0);
    expect(run.finalOccupancy).toBeLessThanOrEqual(64);
    expect(run.finalRubble + run.finalNormal + run.finalTimed).toBe(run.finalOccupancy);
    expect(run.handRefills).toBeGreaterThanOrEqual(1);
    expect(run.finalTail.length).toBeLessThanOrEqual(5);
    expect(run.rubbleCreated).toBeGreaterThanOrEqual(run.finalRubble);
    expect(run.earlyPhases.first5.turnsObserved).toBeLessThanOrEqual(5);
    expect(run.earlyPhases.first10.turnsObserved).toBeLessThanOrEqual(10);
    expect(run.earlyPhases.first20.turnsObserved).toBeLessThanOrEqual(20);
    expect(run.freezeUses).toBeLessThanOrEqual(POWER_UP_LIMITS.freeze);
    expect(run.defuseUses).toBeLessThanOrEqual(POWER_UP_LIMITS.defuse);
  });

  it("produces deterministic population percentiles and separates strategies", () => {
    const first = simulatePopulation("randomLegal", 8, 120);
    const second = simulatePopulation("randomLegal", 8, 120);
    const survival = simulatePopulation("survival", 8, 120);

    expect(first).toEqual(second);
    expect(first.runs).toBe(8);
    expect(survival.distributions.turns.median).toBeGreaterThanOrEqual(
      first.distributions.turns.median,
    );
  });
});
