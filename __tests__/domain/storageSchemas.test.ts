import { createInitialGameState } from "../../src/domain/game";
import {
  ACTIVE_RUN_SCHEMA_VERSION,
  PROFILE_SCHEMA_VERSION,
  SETTINGS_SCHEMA_VERSION,
  defaultProfile,
  defaultSettings,
  parseActiveRun,
  parseProfile,
  parseSettings,
  type PersistedActiveRun,
} from "../../src/services/storage/schemas";

const NOW = 1_752_800_000_000;

function validEnvelope(): PersistedActiveRun {
  return {
    schemaVersion: ACTIVE_RUN_SCHEMA_VERSION,
    seq: 3,
    savedAt: NOW,
    state: createInitialGameState("persist-seed", NOW),
  };
}

describe("parseActiveRun", () => {
  it("round-trips a valid saved run", () => {
    const raw = JSON.stringify(validEnvelope());
    const parsed = parseActiveRun(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.seq).toBe(3);
    expect(parsed?.state.seed).toBe("persist-seed");
    expect(parsed?.state.rngState).toBe(validEnvelope().state.rngState);
  });

  it("returns null for missing, non-JSON, or non-object data", () => {
    expect(parseActiveRun(null)).toBeNull();
    expect(parseActiveRun("not json{")).toBeNull();
    expect(parseActiveRun("42")).toBeNull();
  });

  it("returns null for an unknown envelope schema version", () => {
    const bad = { ...validEnvelope(), schemaVersion: 999 };
    expect(parseActiveRun(JSON.stringify(bad))).toBeNull();
  });

  it("returns null for an incompatible GameState version", () => {
    const env = validEnvelope();
    const bad = { ...env, state: { ...env.state, version: 999 } };
    expect(parseActiveRun(JSON.stringify(bad))).toBeNull();
  });

  it("returns null when a load-bearing field is corrupt", () => {
    const env = validEnvelope();
    const bad = { ...env, state: { ...env.state, rngState: "nope" } };
    expect(parseActiveRun(JSON.stringify(bad))).toBeNull();
  });
});

describe("parseProfile", () => {
  it("round-trips a valid profile", () => {
    const profile = { ...defaultProfile(NOW), bestScore: 5000, bolts: 40, totalRuns: 3 };
    const parsed = parseProfile(JSON.stringify(profile), NOW);
    expect(parsed.bestScore).toBe(5000);
    expect(parsed.bolts).toBe(40);
    expect(parsed.totalRuns).toBe(3);
  });

  it("falls back to defaults on corrupt or wrong-version data", () => {
    expect(parseProfile("garbage{", NOW)).toEqual(defaultProfile(NOW));
    expect(parseProfile(null, NOW)).toEqual(defaultProfile(NOW));
    const oldSchema = { ...defaultProfile(NOW), schemaVersion: PROFILE_SCHEMA_VERSION + 1 };
    expect(parseProfile(JSON.stringify(oldSchema), NOW)).toEqual(defaultProfile(NOW));
  });

  it("keeps valid numeric fields and drops corrupt ones", () => {
    const partial = { ...defaultProfile(NOW), bestScore: 900, bolts: Number.NaN };
    const parsed = parseProfile(JSON.stringify(partial), NOW);
    expect(parsed.bestScore).toBe(900);
    expect(parsed.bolts).toBe(0); // NaN rejected, default kept
  });
});

describe("parseSettings", () => {
  it("round-trips valid settings", () => {
    const settings = { ...defaultSettings(), soundEnabled: false, themeId: "midnight" };
    const parsed = parseSettings(JSON.stringify(settings));
    expect(parsed.soundEnabled).toBe(false);
    expect(parsed.themeId).toBe("midnight");
  });

  it("falls back to defaults on corrupt or wrong-version data", () => {
    expect(parseSettings("nope")).toEqual(defaultSettings());
    const wrong = { ...defaultSettings(), schemaVersion: SETTINGS_SCHEMA_VERSION + 5 };
    expect(parseSettings(JSON.stringify(wrong))).toEqual(defaultSettings());
  });

  it("accepts a null reduced-motion override (follow OS)", () => {
    const settings = { ...defaultSettings(), reducedMotionOverride: null };
    expect(parseSettings(JSON.stringify(settings)).reducedMotionOverride).toBeNull();
  });
});
