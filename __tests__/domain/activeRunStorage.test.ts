import { createInitialGameState } from "../../src/domain/game";
import type { GameState } from "../../src/domain/gameTypes";
import { createMemoryErrorReporter } from "../../src/services/diagnostics/MemoryErrorReporter";
import {
  resetActiveErrorReporter,
  setActiveErrorReporter,
} from "../../src/services/diagnostics/reportError";
import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { STORAGE_KEYS } from "../../src/services/storage/keys";
import {
  clearActiveRun,
  createActiveRunPersister,
  loadActiveRun,
  writeActiveRun,
} from "../../src/services/storage/activeRunStorage";

const NOW = 1_752_800_000_000;

function runWithTimer(): GameState {
  const base = createInitialGameState("run-seed", NOW);
  const grid = base.grid.map((row) => row.slice());
  grid[0][0] = { kind: "timed", pieceInstanceId: "piece-1", colorId: "cyan" };
  return {
    ...base,
    status: "playing",
    turn: 1,
    piecesPlaced: 1,
    grid,
    activeTimers: {
      "piece-1": {
        id: "piece-1",
        shapeId: "single",
        remainingTurns: 3,
        placedOnTurn: 1,
        colorId: "cyan",
      },
    },
  };
}

describe("active run save/load", () => {
  afterEach(() => resetActiveErrorReporter());

  it("restores state and RNG identically (round-trip)", async () => {
    const storage = createMemoryStorageService();
    const state = runWithTimer();
    await writeActiveRun(storage, state, 1, NOW);

    const loaded = await loadActiveRun(storage);
    expect(loaded).not.toBeNull();
    expect(loaded?.state).toEqual(state);
    expect(loaded?.state.rngState).toBe(state.rngState);
    expect(loaded?.state.seed).toBe(state.seed);
  });

  it("restores an older active run containing the deprecated revive marker", async () => {
    const storage = createMemoryStorageService();
    const state = { ...runWithTimer(), reviveUsed: true };
    await writeActiveRun(storage, state, 1, NOW);

    const loaded = await loadActiveRun(storage);
    expect(loaded?.state).toEqual(state);
    expect(loaded?.state.status).toBe("playing");
  });

  it("leaves timers unchanged after a simulated closure", async () => {
    const storage = createMemoryStorageService();
    const state = runWithTimer();
    await writeActiveRun(storage, state, 1, NOW);

    // Simulated app closure + relaunch is just a fresh load — move-based timers
    // carry no wall-clock, so remaining turns must be byte-identical.
    const loaded = await loadActiveRun(storage);
    expect(loaded?.state.activeTimers["piece-1"].remainingTurns).toBe(3);
    expect(loaded?.state.activeTimers).toEqual(state.activeTimers);
  });

  it("clears the saved run", async () => {
    const storage = createMemoryStorageService();
    await writeActiveRun(storage, runWithTimer(), 1, NOW);
    await clearActiveRun(storage);
    expect(await loadActiveRun(storage)).toBeNull();
  });

  it("reports and removes corrupt JSON without touching unrelated records", async () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    const profile = '{"bestScore":4321}';
    const settings = '{"soundEnabled":false}';
    const storage = createMemoryStorageService({
      [STORAGE_KEYS.activeRun]: "not-json{",
      [STORAGE_KEYS.profile]: profile,
      [STORAGE_KEYS.settings]: settings,
    });

    await expect(loadActiveRun(storage)).resolves.toBeNull();

    expect(storage.store.has(STORAGE_KEYS.activeRun)).toBe(false);
    expect(storage.store.get(STORAGE_KEYS.profile)).toBe(profile);
    expect(storage.store.get(STORAGE_KEYS.settings)).toBe(settings);
    expect(reporter.bySurface("persistence")).toEqual([
      expect.objectContaining({
        message: "Invalid active-run payload",
        context: { operation: "load_active_run", reason: "invalid_json" },
      }),
    ]);
  });

  it("reports a corrupt nested shape exactly once and cleans it", async () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    const state = runWithTimer();
    const corrupt = {
      schemaVersion: 1,
      seq: 1,
      savedAt: NOW,
      state: { ...state, hand: [{ handId: "h", shapeId: "missing", colorId: "cyan" }] },
    };
    const storage = createMemoryStorageService({
      [STORAGE_KEYS.activeRun]: JSON.stringify(corrupt),
    });

    await expect(loadActiveRun(storage)).resolves.toBeNull();

    expect(reporter.bySurface("persistence")).toEqual([
      expect.objectContaining({
        message: "Invalid active-run payload",
        context: { operation: "load_active_run", reason: "invalid_game_state" },
      }),
    ]);
    expect(storage.store.has(STORAGE_KEYS.activeRun)).toBe(false);
  });
});

describe("createActiveRunPersister", () => {
  afterEach(() => resetActiveErrorReporter());

  it("persists the latest state and increments the sequence", async () => {
    const storage = createMemoryStorageService();
    const persister = createActiveRunPersister(storage, () => NOW);
    const first = runWithTimer();
    const second = { ...first, score: 500 };

    await persister.save(first);
    await persister.save(second);
    await persister.whenIdle();

    const loaded = await loadActiveRun(storage);
    expect(loaded?.state.score).toBe(500);
    expect(persister.seq).toBeGreaterThanOrEqual(2);
  });

  it("never lets an older write overwrite a newer one (writes land in order)", async () => {
    // Record every write's order through a slow (deferred) setItem, then fire
    // two saves without awaiting between them. The serialized drain issues the
    // second write only after the first completes, so the newer state is always
    // the last thing written — an older save can never clobber it.
    const writes: number[] = [];
    const memory = createMemoryStorageService();
    const storage = {
      ...memory,
      setItem: async (key: string, value: string) => {
        await Promise.resolve();
        writes.push(JSON.parse(value).state.score);
        await memory.setItem(key, value);
      },
    };
    const persister = createActiveRunPersister(storage, () => NOW);
    const older = runWithTimer();
    const newer = { ...older, score: 999 };

    void persister.save(older);
    void persister.save(newer);
    await persister.whenIdle();

    expect(writes[writes.length - 1]).toBe(999);
    const loaded = await loadActiveRun(memory);
    expect(loaded?.state.score).toBe(999);
  });

  it("orders a clear after prior saves (End Run wins)", async () => {
    const storage = createMemoryStorageService();
    const persister = createActiveRunPersister(storage, () => NOW);
    await persister.save(runWithTimer());
    await persister.clear();
    await persister.whenIdle();
    expect(await loadActiveRun(storage)).toBeNull();
  });

  it("recovers after a rejected set and persists a later save", async () => {
    const memory = createMemoryStorageService();
    let rejectNextSet = true;
    const storage = {
      ...memory,
      setItem: async (key: string, value: string) => {
        if (rejectNextSet) {
          rejectNextSet = false;
          throw new Error("set failed");
        }
        await memory.setItem(key, value);
      },
    };
    const persister = createActiveRunPersister(storage, () => NOW);

    await expect(persister.save(runWithTimer())).rejects.toThrow("set failed");

    const recovered = { ...runWithTimer(), score: 700 };
    await expect(persister.save(recovered)).resolves.toBeUndefined();
    await expect(persister.whenIdle()).resolves.toBeUndefined();
    expect((await loadActiveRun(memory))?.state.score).toBe(700);
  });

  it("recovers after a rejected remove and persists a later save", async () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    const memory = createMemoryStorageService();
    await writeActiveRun(memory, runWithTimer(), 1, NOW);
    let rejectNextRemove = true;
    const storage = {
      ...memory,
      removeItem: async (key: string) => {
        if (rejectNextRemove) {
          rejectNextRemove = false;
          throw new Error("remove failed");
        }
        await memory.removeItem(key);
      },
    };
    const persister = createActiveRunPersister(storage, () => NOW);

    await expect(persister.clear()).rejects.toThrow("remove failed");
    expect(reporter.bySurface("persistence")).toEqual([
      expect.objectContaining({
        surface: "persistence",
        message: "remove failed",
        context: { operation: "clear_active_run" },
      }),
    ]);

    const recovered = { ...runWithTimer(), score: 900 };
    await expect(persister.save(recovered)).resolves.toBeUndefined();
    await expect(persister.whenIdle()).resolves.toBeUndefined();
    expect((await loadActiveRun(memory))?.state.score).toBe(900);
  });

  it("reports one diagnostic for one failed operation", async () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    const memory = createMemoryStorageService();
    const storage = {
      ...memory,
      setItem: async () => {
        throw new Error("set failed once");
      },
    };
    const persister = createActiveRunPersister(storage, () => NOW);

    await expect(persister.save(runWithTimer())).rejects.toThrow("set failed once");

    expect(reporter.bySurface("persistence")).toEqual([
      expect.objectContaining({
        surface: "persistence",
        message: "set failed once",
        context: { operation: "save_active_run" },
      }),
    ]);
  });

  it("coalesces multiple queued snapshots deterministically to the newest pending state", async () => {
    let releaseFirstWrite: (() => void) | undefined;
    let markFirstStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const scores: number[] = [];
    const memory = createMemoryStorageService();
    const storage = {
      ...memory,
      setItem: async (key: string, value: string) => {
        const score = (JSON.parse(value) as { state: { score: number } }).state.score;
        scores.push(score);
        if (scores.length === 1) {
          markFirstStarted?.();
          await firstWriteGate;
        }
        await memory.setItem(key, value);
      },
    };
    const persister = createActiveRunPersister(storage, () => NOW);
    const first = { ...runWithTimer(), score: 100 };
    const superseded = { ...runWithTimer(), score: 200 };
    const newest = { ...runWithTimer(), score: 300 };

    const firstSave = persister.save(first);
    await firstStarted;
    const supersededSave = persister.save(superseded);
    const newestSave = persister.save(newest);
    releaseFirstWrite?.();
    await Promise.all([firstSave, supersededSave, newestSave]);

    expect(scores).toEqual([100, 300]);
    expect((await loadActiveRun(memory))?.state.score).toBe(300);
  });

  it("flush waits for the newest pending authoritative snapshot", async () => {
    let releaseFirstWrite: (() => void) | undefined;
    let markFirstStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const writes: number[] = [];
    const memory = createMemoryStorageService();
    const storage = {
      ...memory,
      setItem: async (key: string, value: string) => {
        const score = (JSON.parse(value) as { state: { score: number } }).state.score;
        writes.push(score);
        if (writes.length === 1) {
          markFirstStarted?.();
          await firstWriteGate;
        }
        await memory.setItem(key, value);
      },
    };
    const persister = createActiveRunPersister(storage, () => NOW);

    const firstSave = persister.save({ ...runWithTimer(), score: 100 });
    await firstStarted;
    const newestSave = persister.save({ ...runWithTimer(), score: 900 });
    let flushed = false;
    const flush = persister.flush().then(() => {
      flushed = true;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);

    releaseFirstWrite?.();
    await Promise.all([firstSave, newestSave, flush]);

    expect(writes).toEqual([100, 900]);
    expect((await loadActiveRun(memory))?.state.score).toBe(900);
  });

  it("allows a later flush to succeed after an earlier write rejection", async () => {
    const memory = createMemoryStorageService();
    let rejectNextSet = true;
    const storage = {
      ...memory,
      setItem: async (key: string, value: string) => {
        if (rejectNextSet) {
          rejectNextSet = false;
          throw new Error("first write failed");
        }
        await memory.setItem(key, value);
      },
    };
    const persister = createActiveRunPersister(storage, () => NOW);

    await expect(persister.save(runWithTimer())).rejects.toThrow("first write failed");
    const recoveredSave = persister.save({ ...runWithTimer(), score: 777 });
    await expect(persister.flush()).resolves.toBeUndefined();
    await expect(recoveredSave).resolves.toBeUndefined();

    expect((await loadActiveRun(memory))?.state.score).toBe(777);
  });
});
