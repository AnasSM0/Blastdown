import {
  defaultProfile,
  parseProfile,
  PROFILE_SCHEMA_VERSION,
} from "../../src/services/storage/schemas";

describe("profile theme-ownership migration", () => {
  it("defaults to owning only Reactor", () => {
    expect(defaultProfile(0).unlockedThemeIds).toEqual(["neon-reactor"]);
    expect(PROFILE_SCHEMA_VERSION).toBe(2);
  });

  it("migrates a v1 profile forward, keeping Bolts and stats", () => {
    const v1 = JSON.stringify({
      schemaVersion: 1,
      bestScore: 4200,
      bolts: 1250,
      totalRuns: 12,
      piecesPlaced: 300,
      linesCleared: 45,
      piecesDefused: 9,
      explosions: 3,
      rubbleCleared: 7,
      bestCombo: 5,
      revivesUsed: 1,
      tutorialCompleted: true,
      createdAt: 100,
      updatedAt: 200,
    });
    const migrated = parseProfile(v1, 999);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.bolts).toBe(1250);
    expect(migrated.bestScore).toBe(4200);
    expect(migrated.tutorialCompleted).toBe(true);
    // No ownership in v1 -> defaults to Reactor.
    expect(migrated.unlockedThemeIds).toEqual(["neon-reactor"]);
  });

  it("preserves valid v2 ownership", () => {
    const v2 = JSON.stringify({
      ...defaultProfile(0),
      bolts: 300,
      unlockedThemeIds: ["neon-reactor", "arctic", "void"],
    });
    const parsed = parseProfile(v2, 0);
    expect(parsed.unlockedThemeIds).toEqual(["neon-reactor", "arctic", "void"]);
    expect(parsed.bolts).toBe(300);
  });

  it("recovers from corrupt ownership data safely", () => {
    const corrupt = JSON.stringify({
      ...defaultProfile(0),
      unlockedThemeIds: ["nope", "arctic", "arctic", 42, null],
    });
    const parsed = parseProfile(corrupt, 0);
    // Unknown/duplicate/non-string dropped; Reactor guaranteed present.
    expect(parsed.unlockedThemeIds).toEqual(["neon-reactor", "arctic"]);
  });

  it("discards an unknown future schema version", () => {
    const future = JSON.stringify({ ...defaultProfile(0), schemaVersion: 99, bolts: 5 });
    const parsed = parseProfile(future, 7);
    expect(parsed.bolts).toBe(0); // fell back to a fresh default
    expect(parsed.unlockedThemeIds).toEqual(["neon-reactor"]);
  });
});
