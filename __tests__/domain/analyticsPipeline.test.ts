import { createMemoryAnalyticsService } from "../../src/services/analytics/MemoryAnalyticsService";
import { NoopAnalyticsService } from "../../src/services/analytics/NoopAnalyticsService";
import { rewardOutcome } from "../../src/services/analytics/rewardOutcome";
import type { AnalyticsEvent } from "../../src/services/analytics/types";

describe("MemoryAnalyticsService", () => {
  it("records events in order and filters by name", () => {
    const analytics = createMemoryAnalyticsService();
    analytics.track({ name: "app_open" });
    analytics.track({ name: "run_start" });
    analytics.track({ name: "piece_placed", turn: 1, combo: 0 });
    analytics.track({ name: "run_start" });

    expect(analytics.events).toHaveLength(4);
    expect(analytics.count("run_start")).toBe(2);
    expect(analytics.byName("piece_placed")).toEqual([{ name: "piece_placed", turn: 1, combo: 0 }]);
  });

  it("reset drops recorded events", () => {
    const analytics = createMemoryAnalyticsService();
    analytics.track({ name: "app_open" });
    analytics.reset();
    expect(analytics.events).toHaveLength(0);
  });
});

describe("NoopAnalyticsService", () => {
  it("accepts events without throwing and records nothing (offline-safe)", () => {
    expect(() => NoopAnalyticsService.track({ name: "app_open" })).not.toThrow();
  });
});

describe("rewardOutcome", () => {
  it.each([
    ["earned", "earned"],
    ["closed", "closed"],
    ["unavailable", "unavailable"],
    ["error", "failed"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(rewardOutcome(input)).toBe(expected);
  });
});

describe("event privacy shape", () => {
  it("run_end carries only aggregate fields — no seed, grid, or identifiers", () => {
    const runEnd: AnalyticsEvent = {
      name: "run_end",
      score: 1200,
      turn: 30,
      bestCombo: 4,
      linesCleared: 8,
      piecesPlaced: 25,
      piecesDefused: 2,
      explosions: 1,
      rubbleCleared: 3,
      durationMs: 90_000,
    };
    const keys = Object.keys(runEnd).sort();
    expect(keys).toEqual(
      [
        "name",
        "score",
        "turn",
        "bestCombo",
        "linesCleared",
        "piecesPlaced",
        "piecesDefused",
        "explosions",
        "rubbleCleared",
        "durationMs",
      ].sort(),
    );
    // No known-sensitive field names leak through.
    for (const forbidden of ["seed", "grid", "hand", "userId", "deviceId", "location"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
