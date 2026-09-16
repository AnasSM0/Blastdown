import { createInitialGameState } from "../../src/domain/game";
import type { GameEvent } from "../../src/domain/events";
import type { GameState } from "../../src/domain/gameTypes";
import { PlaytestRecorder, PLAYTEST_STORAGE_KEY } from "../../src/dev/playtest/PlaytestRecorder";
import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { parsePlaytestDataset, summarizePlaytests } from "../../src/services/playtest/summary";

const ENVIRONMENT = {
  appVersion: "1.0.0",
  deviceMetadata: { platform: "android" as const, osVersion: "15", renderer: "views" as const },
};

function recorder() {
  let sequence = 0;
  return new PlaytestRecorder({
    now: () => 10_000 + sequence,
    createId: (prefix) => `${prefix}-${++sequence}`,
    persistDelayMs: -1,
  });
}

async function configuredRecorder() {
  const storage = createMemoryStorageService();
  const value = recorder();
  await value.configure(storage, ENVIRONMENT);
  value.recordAnalytics({ name: "session_start" });
  return { value, storage };
}

function stateAt(base: GameState, turn: number, patch: Partial<GameState> = {}): GameState {
  return { ...base, turn, lastUpdatedAt: base.startedAt + turn * 1000, ...patch };
}

function observe(
  value: PlaytestRecorder,
  state: GameState,
  events: GameEvent[] = [],
  sessionGeneration = 1,
) {
  value.observeGame({ state, events, hasActiveRun: true, sessionGeneration });
}

describe("human playtest recorder", () => {
  it("starts one run once and does not duplicate it on rerender", async () => {
    const { value } = await configuredRecorder();
    const state = createInitialGameState("once", 100);
    observe(value, state);
    observe(value, state);
    expect(value.getCurrentSession()?.runs).toHaveLength(1);
  });

  it("records early milestones and all once-only first events exactly once", async () => {
    const { value } = await configuredRecorder();
    const base = createInitialGameState("milestones", 100);
    const turn1 = stateAt(base, 1, { score: 12, piecesPlaced: 1 });
    const turnEvents: GameEvent[] = [
      { type: "piecePlaced", handId: "h", pieceId: "p", cells: [{ row: 0, column: 0 }] },
      { type: "timerWarning", pieceId: "p", remainingTurns: 2 },
      { type: "timerWarning", pieceId: "p", remainingTurns: 1 },
      { type: "linesCleared", rows: [0], columns: [0] },
      { type: "pieceDefused", pieceId: "p", bonus: 10, remainingTurns: 1 },
      { type: "explosionStarted", explosionId: "x", pieceId: "p2", sourceCells: [] },
      { type: "rubbleCreated", explosionId: "x", cells: [{ row: 1, column: 1 }] },
      { type: "rubbleCleared", cells: [{ row: 1, column: 1 }] },
    ];
    observe(value, turn1, turnEvents);
    observe(value, turn1, turnEvents);
    for (const turn of [5, 10, 20]) observe(value, stateAt(base, turn));

    const run = value.getCurrentSession()?.runs[0];
    expect(run?.earlyGameMilestones.map((item) => item.turn)).toEqual([1, 5, 10, 20]);
    expect(run).toMatchObject({
      firstTimerAssignedTurn: 1,
      firstTimer2Turn: 1,
      firstTimer1Turn: 1,
      firstNaturalDefuseTurn: 1,
      firstClutchDefuseTurn: 1,
      firstExplosionTurn: 1,
      firstRubbleClearTurn: 1,
      firstMultiClearTurn: 1,
      multiClears: 1,
      clutchDefuses: 1,
      rubbleCreated: 1,
    });
  });

  it("records an authoritative clear as recovery within five turns of an explosion", async () => {
    const { value } = await configuredRecorder();
    const base = createInitialGameState("recovery", 100);
    observe(value, stateAt(base, 2), [
      { type: "explosionStarted", explosionId: "x", pieceId: "p", sourceCells: [] },
    ]);
    observe(value, stateAt(base, 4), [{ type: "linesCleared", rows: [0], columns: [] }]);
    expect(value.getCurrentSession()?.runs[0]).toMatchObject({
      explosionEpisodes: 1,
      explosionRecoveriesWithinFiveTurns: 1,
      firstExplosionRecoveryTurn: 4,
    });
  });

  it("detects repeated and all-three shape hands without touching generation", async () => {
    const { value } = await configuredRecorder();
    const base = createInitialGameState("hands", 100);
    const hand = [
      { handId: "a", shapeId: "square-2", colorId: "cyan" },
      { handId: "b", shapeId: "square-2", colorId: "amber" },
      { handId: "c", shapeId: "square-2", colorId: "cyan" },
    ];
    observe(value, { ...base, hand });
    const evidence = value.getCurrentSession()?.runs[0].hands[0];
    expect(evidence).toMatchObject({
      uniqueShapeCount: 1,
      hasDuplicate: true,
      allThreeMatch: true,
    });
  });

  it("records compact Game Over context and five-turn recovery window", async () => {
    const { value } = await configuredRecorder();
    const base = createInitialGameState("failure", 100);
    for (let turn = 1; turn <= 4; turn++) {
      const events: GameEvent[] =
        turn === 2
          ? [{ type: "explosionStarted", explosionId: "x", pieceId: "p", sourceCells: [] }]
          : turn === 4
            ? [{ type: "pieceDefused", pieceId: "p", bonus: 10, remainingTurns: 2 }]
            : [];
      observe(value, stateAt(base, turn), events);
    }
    const grid = base.grid.map((row) => [...row]);
    grid[0][0] = { kind: "rubble", explosionId: "x" };
    observe(value, stateAt(base, 5, { status: "gameOver", grid, score: 99 }), [
      { type: "gameOver" },
    ]);
    const context = value.getCurrentSession()?.runs[0].gameOverContext;
    expect(context).toMatchObject({
      turn: 5,
      score: 99,
      rubbleCount: 1,
      legalPlacements: 0,
      explosionsPreviousFiveTurns: 1,
      defusesPreviousFiveTurns: 1,
      lastMeaningfulOutcome: "defuse",
    });
  });

  it("detects immediate replay and gives the next run a unique ID", async () => {
    const { value } = await configuredRecorder();
    const first = stateAt(createInitialGameState("first", 100), 7, { status: "gameOver" });
    observe(value, first, [{ type: "gameOver" }]);
    value.recordAction("play_again");
    const second = createInitialGameState("second", 200);
    observe(value, second);
    const runs = value.getCurrentSession()?.runs ?? [];
    expect(runs).toHaveLength(2);
    expect(runs[0].immediateReplay).toBe(true);
    expect(runs[0].runId).not.toBe(runs[1].runId);
  });

  it("uses session generation to distinguish an exact-state restart", async () => {
    const { value } = await configuredRecorder();
    const state = createInitialGameState("same", 100);
    observe(value, state, [], 1);
    observe(value, state, [], 2);
    const runs = value.getCurrentSession()?.runs ?? [];
    expect(runs.map((run) => run.sessionGeneration)).toEqual([1, 2]);
    expect(runs[0].runId).not.toBe(runs[1].runId);
  });

  it("starts one foreground session and a fresh one after session end", async () => {
    const { value } = await configuredRecorder();
    value.recordAnalytics({ name: "session_start" });
    expect(value.getSessions()).toHaveLength(1);
    value.recordAnalytics({ name: "session_end", durationMs: 1000 });
    value.recordAnalytics({ name: "session_start" });
    expect(value.getSessions()).toHaveLength(2);
  });

  it("records Results to Home as a non-replay", async () => {
    const { value } = await configuredRecorder();
    observe(value, stateAt(createInitialGameState("home", 100), 3, { status: "gameOver" }), [
      { type: "gameOver" },
    ]);
    value.recordAction("results_home");
    expect(value.getCurrentSession()?.runs[0].immediateReplay).toBe(false);
  });

  it("captures eligibility, consideration, and authoritative use counts", async () => {
    const { value } = await configuredRecorder();
    const base = createInitialGameState("powers", 100);
    const activeTimers = {
      p: { id: "p", shapeId: "single", remainingTurns: 3, placedOnTurn: 1, colorId: "cyan" },
    };
    observe(value, stateAt(base, 1, { activeTimers }));
    value.recordAnalytics({ name: "freeze_offer" });
    value.recordAnalytics({ name: "defuse_offer" });
    observe(value, stateAt(base, 1, { activeTimers, rewardedFreezeUses: 1 }));
    const run = value.getCurrentSession()?.runs[0];
    expect(run).toMatchObject({
      freezeEligibleCount: 1,
      defuseEligibleCount: 1,
      freezeConsideredCount: 1,
      defuseConsideredCount: 1,
      freezeUsedCount: 1,
      firstPowerUpUseTurn: 1,
    });
  });

  it("summarizes sessions without manufacturing missing first events", async () => {
    const { value } = await configuredRecorder();
    observe(value, stateAt(createInitialGameState("summary", 100), 8, { score: 80 }));
    value.recordError();
    const summary = summarizePlaytests(value.getSessions());
    expect(summary).toMatchObject({
      sessions: 1,
      runs: 1,
      medianTurns: 8,
      medianScore: 80,
      errorCount: 1,
    });
    expect(summary.medianFirstExplosionTurn).toBeNull();
  });

  it("does not consume or mutate gameplay RNG/state", async () => {
    const { value } = await configuredRecorder();
    const state = createInitialGameState("determinism", 100);
    const before = JSON.stringify(state);
    const rngBefore = state.rngState;
    observe(value, state);
    expect(state.rngState).toBe(rngBefore);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("contains storage failure and keeps gameplay callable", async () => {
    const failingStorage = {
      getItem: async () => {
        throw new Error("offline");
      },
      setItem: async () => {
        throw new Error("full");
      },
      removeItem: async () => {
        throw new Error("locked");
      },
      multiRemove: async () => undefined,
    };
    const value = recorder();
    await expect(value.configure(failingStorage, ENVIRONMENT)).resolves.toBeUndefined();
    expect(() => observe(value, createInitialGameState("safe", 100))).not.toThrow();
    await expect(value.flush()).resolves.toBeUndefined();
    await expect(value.reset()).resolves.toBeUndefined();
  });

  it("reset clears only the isolated playtest key", async () => {
    const storage = createMemoryStorageService({ "blastdown/profile/v1": "keep" });
    const value = recorder();
    await value.configure(storage, ENVIRONMENT);
    observe(value, createInitialGameState("reset", 100));
    await value.flush();
    expect(storage.store.has(PLAYTEST_STORAGE_KEY)).toBe(true);
    await value.reset();
    expect(storage.store.has(PLAYTEST_STORAGE_KEY)).toBe(false);
    expect(storage.store.get("blastdown/profile/v1")).toBe("keep");
  });

  it("exports renderer metadata and no PII-capable fields", async () => {
    const { value } = await configuredRecorder();
    observe(value, createInitialGameState("privacy", 100));
    const exported = value.export(20_000);
    expect(exported.sessions[0].deviceMetadata.renderer).toBe("views");
    const keys: string[] = [];
    const visit = (input: unknown): void => {
      if (!input || typeof input !== "object") return;
      if (Array.isArray(input)) return input.forEach(visit);
      for (const [key, child] of Object.entries(input)) {
        keys.push(key.toLowerCase());
        visit(child);
      }
    };
    visit(exported);
    expect(JSON.stringify(exported)).not.toContain('"grid"');
    expect(JSON.stringify(exported)).not.toContain('"activeTimers"');
    expect(keys).not.toEqual(
      expect.arrayContaining([
        "name",
        "email",
        "phone",
        "location",
        "contact",
        "advertisingid",
        "serial",
        "freetext",
      ]),
    );
  });

  it("rejects simulator or unknown data instead of mixing it", () => {
    expect(
      parsePlaytestDataset({ schemaVersion: 1, kind: "blastdown-simulator", sessions: [] }),
    ).toBeNull();
    expect(
      parsePlaytestDataset({ schemaVersion: 1, kind: "blastdown-human-playtest", sessions: [] }),
    ).not.toBeNull();
  });
});
