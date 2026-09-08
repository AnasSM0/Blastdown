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

function envelopeWithTimedPiece(): PersistedActiveRun {
  const envelope = validEnvelope();
  return {
    ...envelope,
    state: {
      ...envelope.state,
      turn: 1,
      piecesPlaced: 1,
      grid: envelope.state.grid.map((row, rowIndex) =>
        row.map((cell, columnIndex) =>
          rowIndex === 0 && columnIndex === 0
            ? {
                kind: "timed" as const,
                pieceInstanceId: "piece-1",
                colorId: "cyan",
              }
            : cell,
        ),
      ),
      activeTimers: {
        "piece-1": {
          id: "piece-1",
          shapeId: "single",
          remainingTurns: 7,
          placedOnTurn: 1,
          colorId: "cyan",
        },
      },
    },
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

  it.each([
    [
      "7x8",
      (envelope: PersistedActiveRun) => ({
        ...envelope,
        state: { ...envelope.state, grid: envelope.state.grid.slice(0, 7) },
      }),
    ],
    [
      "8x7",
      (envelope: PersistedActiveRun) => ({
        ...envelope,
        state: {
          ...envelope.state,
          grid: envelope.state.grid.map((row) => row.slice(0, 7)),
        },
      }),
    ],
  ])("rejects a malformed %s grid", (_label, mutate) => {
    expect(parseActiveRun(JSON.stringify(mutate(validEnvelope())))).toBeNull();
  });

  it.each([
    ["unknown kind", { kind: "portal" }],
    ["normal without color", { kind: "normal" }],
    ["unknown normal color", { kind: "normal", colorId: "green" }],
    ["timed without piece id", { kind: "timed", colorId: "cyan" }],
    ["rubble without explosion id", { kind: "rubble" }],
  ])("rejects an invalid nested cell: %s", (_label, invalidCell) => {
    const envelope = validEnvelope();
    const grid = envelope.state.grid.map((row) => row.slice());
    grid[0][0] = invalidCell as (typeof grid)[number][number];
    expect(
      parseActiveRun(JSON.stringify({ ...envelope, state: { ...envelope.state, grid } })),
    ).toBeNull();
  });

  it.each([
    ["non-array", { invalid: true }],
    ["empty", []],
    ["too many pieces", [...validEnvelope().state.hand, ...validEnvelope().state.hand]],
    ["unknown shape", [{ handId: "h", shapeId: "missing", colorId: "cyan" }]],
    ["unknown color", [{ handId: "h", shapeId: "single", colorId: "green" }]],
    [
      "duplicate hand ids",
      [
        { handId: "duplicate", shapeId: "single", colorId: "cyan" },
        { handId: "duplicate", shapeId: "line2h", colorId: "amber" },
      ],
    ],
  ])("rejects a malformed hand: %s", (_label, hand) => {
    const envelope = validEnvelope();
    expect(
      parseActiveRun(JSON.stringify({ ...envelope, state: { ...envelope.state, hand } })),
    ).toBeNull();
  });

  it.each([
    [
      "missing timer record",
      (envelope: PersistedActiveRun) => ({
        ...envelope,
        state: { ...envelope.state, activeTimers: {} },
      }),
    ],
    [
      "timer key/id mismatch",
      (envelope: PersistedActiveRun) => ({
        ...envelope,
        state: {
          ...envelope.state,
          activeTimers: {
            wrong: { ...envelope.state.activeTimers["piece-1"], id: "piece-1" },
          },
        },
      }),
    ],
    [
      "zero remaining turns",
      (envelope: PersistedActiveRun) => ({
        ...envelope,
        state: {
          ...envelope.state,
          activeTimers: {
            "piece-1": { ...envelope.state.activeTimers["piece-1"], remainingTurns: 0 },
          },
        },
      }),
    ],
    [
      "future placement turn",
      (envelope: PersistedActiveRun) => ({
        ...envelope,
        state: {
          ...envelope.state,
          activeTimers: {
            "piece-1": { ...envelope.state.activeTimers["piece-1"], placedOnTurn: 2 },
          },
        },
      }),
    ],
    [
      "unknown timer shape",
      (envelope: PersistedActiveRun) => ({
        ...envelope,
        state: {
          ...envelope.state,
          activeTimers: {
            "piece-1": { ...envelope.state.activeTimers["piece-1"], shapeId: "missing" },
          },
        },
      }),
    ],
  ])("rejects a malformed timer record: %s", (_label, mutate) => {
    expect(parseActiveRun(JSON.stringify(mutate(envelopeWithTimedPiece())))).toBeNull();
  });

  it("rejects broken timer/grid cross-references", () => {
    const envelope = envelopeWithTimedPiece();
    const mismatchedGrid = envelope.state.grid.map((row) => row.slice());
    mismatchedGrid[0][0] = {
      kind: "timed",
      pieceInstanceId: "piece-1",
      colorId: "amber",
    };
    expect(
      parseActiveRun(
        JSON.stringify({ ...envelope, state: { ...envelope.state, grid: mismatchedGrid } }),
      ),
    ).toBeNull();

    const orphanTimer = {
      ...envelope,
      state: {
        ...envelope.state,
        grid: validEnvelope().state.grid,
      },
    };
    expect(parseActiveRun(JSON.stringify(orphanTimer))).toBeNull();
  });

  it.each([
    ["negative score", { score: -1 }],
    ["non-finite score", { score: Number.POSITIVE_INFINITY }],
    ["fractional turn", { turn: 1.5 }],
    ["turn/counter mismatch", { turn: 2, piecesPlaced: 1 }],
    ["negative freeze", { freezeTurnsRemaining: -1 }],
    ["invalid rng state", { rngState: 2 ** 40 }],
    ["backwards timestamp", { startedAt: NOW, lastUpdatedAt: NOW - 1 }],
    ["invalid status", { status: "sleeping" }],
  ])("rejects invalid gameplay state values: %s", (_label, statePatch) => {
    const envelope = validEnvelope();
    expect(
      parseActiveRun(JSON.stringify({ ...envelope, state: { ...envelope.state, ...statePatch } })),
    ).toBeNull();
  });

  it("migrates the supported v1 envelope deterministically and validates the result", () => {
    expect(ACTIVE_RUN_SCHEMA_VERSION).toBe(2);
    const legacy = { ...validEnvelope(), schemaVersion: 1 };

    const first = parseActiveRun(JSON.stringify(legacy));
    const second = parseActiveRun(JSON.stringify(legacy));

    expect(first).toEqual(second);
    expect(first?.schemaVersion).toBe(ACTIVE_RUN_SCHEMA_VERSION);
    expect(first?.state).toEqual(legacy.state);
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
