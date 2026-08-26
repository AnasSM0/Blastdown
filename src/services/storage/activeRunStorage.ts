import type { GameState } from "../../domain/gameTypes";
import { reportCaught } from "../diagnostics/reportError";
import { STORAGE_KEYS } from "./keys";
import { ACTIVE_RUN_SCHEMA_VERSION, parseActiveRun, type PersistedActiveRun } from "./schemas";
import type { StorageService } from "./StorageService";

/** Load and validate the saved run. Returns null on missing/corrupt/
 *  incompatible data (the caller starts fresh). */
export async function loadActiveRun(storage: StorageService): Promise<PersistedActiveRun | null> {
  const raw = await storage.getItem(STORAGE_KEYS.activeRun);
  return parseActiveRun(raw);
}

export async function clearActiveRun(storage: StorageService): Promise<void> {
  await storage.removeItem(STORAGE_KEYS.activeRun);
}

/** Write one run envelope. `seq` is monotonic per persister so a later read
 *  can tell newer from older; the persister below guarantees ordering. */
export async function writeActiveRun(
  storage: StorageService,
  state: GameState,
  seq: number,
  savedAt: number,
): Promise<void> {
  const envelope: PersistedActiveRun = {
    schemaVersion: ACTIVE_RUN_SCHEMA_VERSION,
    seq,
    savedAt,
    state,
  };
  await storage.setItem(STORAGE_KEYS.activeRun, JSON.stringify(envelope));
}

type Op = { kind: "save"; state: GameState } | { kind: "clear" };

export type ActiveRunPersister = {
  /** Queue a save of `state`. Coalesces with any not-yet-written op so only
   *  the newest survives — an older state can never land after a newer one. */
  save: (state: GameState) => Promise<void>;
  /** Queue a clear (End Run / settlement), ordered against saves. */
  clear: () => Promise<void>;
  /** Resolves once the queue is drained — used for background-flush. */
  whenIdle: () => Promise<void>;
  /** Highest sequence number written so far (diagnostics/tests). */
  readonly seq: number;
};

/** Serialized, coalescing writer for the active run. All saves/clears pass
 *  through a single drain loop, so writes complete strictly in request order
 *  and a stale async write can never overwrite a newer save (BUILD_SPEC.md
 *  §6.10 "save the updated active run", and the stale-write requirement). */
export function createActiveRunPersister(
  storage: StorageService,
  now: () => number = Date.now,
): ActiveRunPersister {
  let seq = 0;
  let pending: Op | null = null;
  let running: Promise<void> | null = null;

  async function drain(): Promise<void> {
    let firstFailure: unknown;
    let failed = false;
    try {
      while (pending !== null) {
        const op = pending;
        pending = null;
        try {
          if (op.kind === "clear") {
            await clearActiveRun(storage);
          } else {
            const nextSeq = seq + 1;
            await writeActiveRun(storage, op.state, nextSeq, now());
            seq = nextSeq;
          }
        } catch (error) {
          reportCaught("persistence", error, {
            operation: op.kind === "clear" ? "clear_active_run" : "save_active_run",
          });
          if (!failed) {
            failed = true;
            firstFailure = error;
          }
          // Do not retry the failed operation. A newer operation that was
          // queued while it was in flight may still drain once.
        }
      }
      if (failed) {
        throw firstFailure;
      }
    } finally {
      // A rejected set/remove must never leave the persister permanently
      // attached to a rejected promise. The next enqueue starts a fresh drain.
      running = null;
    }
  }

  function enqueue(op: Op): Promise<void> {
    // Newest op wins: an unwritten save/clear is replaced before it reaches
    // storage, which is exactly what makes stale overwrites impossible.
    pending = op;
    if (!running) {
      running = drain();
    }
    return running;
  }

  return {
    save: (state) => enqueue({ kind: "save", state }),
    clear: () => enqueue({ kind: "clear" }),
    whenIdle: () => running ?? Promise.resolve(),
    get seq() {
      return seq;
    },
  };
}
