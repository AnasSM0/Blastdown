import { createInitialGameState } from "../../src/domain/game";
import type { GameState } from "../../src/domain/gameTypes";
import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import {
  clearActiveRun,
  createActiveRunPersister,
  loadActiveRun,
  writeActiveRun,
} from "../../src/services/storage/activeRunStorage";

const NOW = 1_752_800_000_000;

function runWithTimer(): GameState {
  const base = createInitialGameState("run-seed", NOW);
  return {
    ...base,
    status: "playing",
    activeTimers: {
      t1: { id: "t1", shapeId: "single", remainingTurns: 3, placedOnTurn: 1, colorId: "cyan" },
    },
  };
}

describe("active run save/load", () => {
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

  it("leaves timers unchanged after a simulated closure", async () => {
    const storage = createMemoryStorageService();
    const state = runWithTimer();
    await writeActiveRun(storage, state, 1, NOW);

    // Simulated app closure + relaunch is just a fresh load — move-based timers
    // carry no wall-clock, so remaining turns must be byte-identical.
    const loaded = await loadActiveRun(storage);
    expect(loaded?.state.activeTimers.t1.remainingTurns).toBe(3);
    expect(loaded?.state.activeTimers).toEqual(state.activeTimers);
  });

  it("clears the saved run", async () => {
    const storage = createMemoryStorageService();
    await writeActiveRun(storage, runWithTimer(), 1, NOW);
    await clearActiveRun(storage);
    expect(await loadActiveRun(storage)).toBeNull();
  });
});

describe("createActiveRunPersister", () => {
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
});
