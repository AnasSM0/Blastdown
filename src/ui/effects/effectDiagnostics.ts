import { isDevelopmentBuild } from "../../config/environment";
import { isCinematicRendererEnabled } from "../../config/renderer";

import {
  MAX_LIVE_EFFECTS,
  type EffectPriority,
  type EffectQueue,
  type LiveEffect,
} from "./effectQueue";
import type { EffectPlan } from "./eventEffects";

/** A ledger of what actually happened to every effect.
 *
 *  ## Why this exists
 *
 *  "The effect did not appear" is not a report anyone can act on. On a device it
 *  is the same sentence for five different faults:
 *
 *   - the queue refused the admission (a duplicate, or a dead generation),
 *   - the effect was evicted under pressure,
 *   - the renderer never drew it, so it never started,
 *   - the renderer drew it but never reported, so the watchdog cut it short,
 *   - a restart cleared the generation out from under it.
 *
 *  Each has a different fix and none is distinguishable from the sofa. The
 *  counters here name which one happened.
 *
 *  ## Why it derives from committed transitions
 *
 *  The obvious implementation records from inside the queue's state updater,
 *  where admission and eviction actually happen. That is wrong twice over: a
 *  React updater is not guaranteed to run once (it is re-invoked on a rebase,
 *  and twice under StrictMode), and a counter that inflates under re-render
 *  would lie in the direction of "everything is fine" — the single most
 *  expensive way for a diagnostic to be wrong.
 *
 *  So the recorder is fed committed before/after pairs and derives the rest.
 *  Observing the same commit twice is a no-op, which is what makes the counters
 *  safe to trust.
 *
 *  The one thing a committed pair cannot show is an admission that was REFUSED:
 *  nothing is added, so the transition is empty. Attempts are therefore counted
 *  separately at the call site, and `dropped` is the difference. */

export const EFFECT_LOG_KINDS = [
  "enqueue",
  "accepted",
  "startedDrawing",
  "completed",
  "evicted",
  "sessionCleared",
] as const;

export type EffectLogKind = (typeof EFFECT_LOG_KINDS)[number];

export type EffectLogEntry = {
  kind: EffectLogKind;
  /** The effect this concerns, or null for a whole-generation event. */
  id: string | null;
  sessionId: number;
  at: number;
  priority?: EffectPriority;
  /** Free-form extra: the effect's type, or how many a session change dropped. */
  detail?: string;
};

export type EffectDiagnosticsLogger = (entry: EffectLogEntry) => void;

/** One live effect, as the overlay shows it. */
export type EffectDiagnosticsRow = {
  id: string;
  priority: EffectPriority;
  /** What the plan is: `clear`, `explosion`, `defuse`, `cue:revive`, … */
  type: string;
  /** The cinematic clock slot leased to this effect, or null when the cinematic
   *  renderer is not mounted (the fallback holds no clock pool). */
  slot: number | null;
  /** How long this effect has been waiting to be drawn. Zero once drawn. */
  waitingMs: number;
  /** Enqueue to first draw report, or null while it has not been drawn. */
  latencyMs: number | null;
};

export type EffectDiagnosticsSnapshot = {
  queueDepth: number;
  /** Live effects a renderer has reported drawing. */
  renderedCount: number;
  accepted: number;
  startedDrawing: number;
  completed: number;
  evicted: number;
  dropped: number;
  sessionCleared: number;
  sessionId: number;
  /** Whether this build resolved to the cinematic renderer. */
  cinematic: boolean;
  effects: readonly EffectDiagnosticsRow[];
  /** Age of the oldest effect still waiting for its first draw. This is the
   *  number that separates "the renderer is slow" from "the renderer never
   *  reports": under the former it settles, under the latter it climbs. */
  oldestWaitingMs: number;
  lastLatencyMs: number | null;
  maxLatencyMs: number | null;
};

/** How often the overlay re-reads the ledger.
 *
 *  Deliberately far slower than a frame. The overlay exists to diagnose dropped
 *  frames, so an overlay that re-rendered per frame would be measuring itself. */
export const DIAGNOSTICS_REFRESH_MS = 250;

type Tracked = {
  enqueuedAt: number;
  latencyMs: number | null;
};

type Counters = {
  accepted: number;
  startedDrawing: number;
  completed: number;
  evicted: number;
  sessionCleared: number;
  attempts: number;
};

const PRIORITY_RANK: Record<EffectPriority, number> = { critical: 3, high: 2, standard: 1 };

let counters: Counters = emptyCounters();
let tracked = new Map<string, Tracked>();
let leases = new Map<string, number>();
let observed: EffectQueue | null = null;
let lastLatencyMs: number | null = null;
let maxLatencyMs: number | null = null;
let logger: EffectDiagnosticsLogger | null = null;

function emptyCounters(): Counters {
  return {
    accepted: 0,
    startedDrawing: 0,
    completed: 0,
    evicted: 0,
    sessionCleared: 0,
    attempts: 0,
  };
}

/** Install a sink for the six lifecycle events, or `null` for none.
 *
 *  Null by default, and that is the shipped state: a log per effect is fine, a
 *  log per frame is not, and the difference is one careless call site. Only the
 *  six kinds above are ever emitted, and only on a change — reading a snapshot
 *  never logs. */
export function setEffectDiagnosticsLogger(next: EffectDiagnosticsLogger | null): void {
  logger = next;
}

export function resetEffectDiagnostics(): void {
  counters = emptyCounters();
  tracked = new Map();
  leases = new Map();
  observed = null;
  lastLatencyMs = null;
  maxLatencyMs = null;
}

function emit(entry: EffectLogEntry): void {
  logger?.(entry);
}

/** Note that an admission was attempted.
 *
 *  Called by the animator before it hands the effect to the queue, because a
 *  refused admission leaves no trace in the queue itself. */
export function recordEffectEnqueue(id: string, sessionId: number, at: number): void {
  if (!isDevelopmentBuild()) {
    return;
  }
  counters.attempts += 1;
  if (!tracked.has(id)) {
    // First attempt wins: a duplicate must not reset the clock the latency is
    // measured from, or a re-admitted effect would look instantaneous.
    tracked.set(id, { enqueuedAt: at, latencyMs: null });
  }
  emit({ kind: "enqueue", id, sessionId, at });
}

/** Observe one committed queue transition. Idempotent for the same pair. */
export function recordQueueTransition(before: EffectQueue, after: EffectQueue, at: number): void {
  if (!isDevelopmentBuild() || before === after) {
    return;
  }
  observed = after;

  if (before.sessionId !== after.sessionId) {
    counters.sessionCleared += 1;
    emit({
      kind: "sessionCleared",
      id: null,
      sessionId: after.sessionId,
      at,
      detail: `dropped ${before.effects.length}`,
    });
    // Everything in flight belonged to the run the player just left. Counting
    // it as completed would report a healthy run that drew nothing.
    tracked = new Map();
    leases = new Map();
    return;
  }

  const beforeById = new Map(before.effects.map((effect) => [effect.id, effect]));
  const afterById = new Map(after.effects.map((effect) => [effect.id, effect]));

  // Acceptances are counted from the sequence counter rather than from what
  // survived, so an effect admitted and evicted inside one commit still counts
  // as accepted — otherwise it would be miscounted as dropped.
  const acceptedCount = Math.max(0, after.nextSequence - before.nextSequence);
  counters.accepted += acceptedCount;

  for (const effect of after.effects) {
    if (!beforeById.has(effect.id)) {
      if (!tracked.has(effect.id)) {
        tracked.set(effect.id, { enqueuedAt: at, latencyMs: null });
      }
      emit({
        kind: "accepted",
        id: effect.id,
        sessionId: after.sessionId,
        at,
        priority: effect.priority,
        detail: effectTypeOf(effect.plan),
      });
    }
  }

  for (const effect of after.effects) {
    const previous = beforeById.get(effect.id);
    if (previous === undefined || previous.startedAt !== null || effect.startedAt === null) {
      continue;
    }
    counters.startedDrawing += 1;
    const entry = tracked.get(effect.id);
    const latency = entry ? Math.max(0, effect.startedAt - entry.enqueuedAt) : 0;
    if (entry) {
      entry.latencyMs = latency;
    }
    lastLatencyMs = latency;
    maxLatencyMs = maxLatencyMs === null ? latency : Math.max(maxLatencyMs, latency);
    emit({
      kind: "startedDrawing",
      id: effect.id,
      sessionId: after.sessionId,
      at,
      priority: effect.priority,
      detail: `${latency}ms`,
    });
  }

  const removed = before.effects.filter((effect) => !afterById.has(effect.id));
  if (removed.length === 0) {
    return;
  }

  // How many of the removals were evictions rather than retirements. The queue
  // evicts only to get back under the cap, so the count is arithmetic: whatever
  // the cap could not hold. The WHICH is the queue's own rule — lowest priority,
  // then oldest — replayed here rather than guessed, so the two cannot drift
  // apart silently.
  const evictedCount = Math.min(
    removed.length,
    Math.max(0, before.effects.length + acceptedCount - MAX_LIVE_EFFECTS),
  );
  const byEvictionOrder = [...removed].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.sequence - b.sequence,
  );

  for (let index = 0; index < byEvictionOrder.length; index += 1) {
    const effect = byEvictionOrder[index];
    const kind: EffectLogKind = index < evictedCount ? "evicted" : "completed";
    if (kind === "evicted") {
      counters.evicted += 1;
    } else {
      counters.completed += 1;
    }
    emit({
      kind,
      id: effect.id,
      sessionId: after.sessionId,
      at,
      priority: effect.priority,
      detail: effectTypeOf(effect.plan),
    });
    tracked.delete(effect.id);
  }
}

/** Publish the cinematic board's clock leases.
 *
 *  Reported by the board rather than derived here: the lease map is the board's
 *  own memory, and a second copy computed from draw order would be exactly the
 *  positional assignment the leases exist to replace. */
export function recordClockLeases(next: ReadonlyMap<string, number>): void {
  if (!isDevelopmentBuild()) {
    return;
  }
  leases = new Map(next);
}

/** What a plan is, in one word, for the overlay's per-effect table. */
export function effectTypeOf(plan: EffectPlan): string {
  if (plan.cue !== null) {
    return `cue:${plan.cue}`;
  }
  if (plan.explosions.length > 0) {
    return "explosion";
  }
  if (plan.rows.length > 0 || plan.columns.length > 0) {
    return "clear";
  }
  if (plan.defuses.length > 0) {
    return "defuse";
  }
  return "placement";
}

function rowFor(effect: LiveEffect, now: number): EffectDiagnosticsRow {
  const entry = tracked.get(effect.id);
  return {
    id: effect.id,
    priority: effect.priority,
    type: effectTypeOf(effect.plan),
    slot: leases.get(effect.id) ?? null,
    waitingMs:
      effect.startedAt === null && entry !== undefined ? Math.max(0, now - entry.enqueuedAt) : 0,
    latencyMs: entry?.latencyMs ?? null,
  };
}

/** Read the ledger. Never logs and never mutates — the overlay calls this on a
 *  timer, and a read with a side effect would make the diagnostic part of what
 *  it is diagnosing. */
export function readEffectDiagnostics(now: number): EffectDiagnosticsSnapshot {
  const effects = observed?.effects ?? [];
  const rows = effects.map((effect) => rowFor(effect, now));
  let oldestWaitingMs = 0;
  for (const row of rows) {
    if (row.waitingMs > oldestWaitingMs) {
      oldestWaitingMs = row.waitingMs;
    }
  }

  return {
    queueDepth: effects.length,
    renderedCount: effects.filter((effect) => effect.startedAt !== null).length,
    accepted: counters.accepted,
    startedDrawing: counters.startedDrawing,
    completed: counters.completed,
    evicted: counters.evicted,
    // Every attempt that never became a live effect: a duplicate id, or one
    // aimed at a generation the player had already left.
    dropped: Math.max(0, counters.attempts - counters.accepted),
    sessionCleared: counters.sessionCleared,
    sessionId: observed?.sessionId ?? 1,
    cinematic: isCinematicRendererEnabled(),
    effects: rows,
    oldestWaitingMs,
    lastLatencyMs,
    maxLatencyMs,
  };
}
