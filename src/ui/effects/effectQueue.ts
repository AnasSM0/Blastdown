import type { EffectPlan } from "./eventEffects";

/** Deterministic delivery for gameplay effects.
 *
 *  The renderer this replaces held ONE effect plan in a `useState` slot, keyed
 *  by turn, cleared by a `setTimeout`, and remounted whenever anything about it
 *  changed. Every reliability failure reported from the device follows from
 *  that shape:
 *
 *  - **Effects vanished.** A rewarded defuse or revive fired while a clear was
 *    still playing was dropped outright — the cue path returned early when the
 *    slot was busy. The player paid for an ad and saw nothing.
 *  - **Effects were truncated.** A second placement replaced the slot, so the
 *    first sequence's remaining beats never drew.
 *  - **Effects restarted mid-flight.** The animation clock was keyed on the
 *    effect scene, which is rebuilt when the theme, the board size or the
 *    reduced-motion setting changes. Any of those mid-sequence replayed it from
 *    zero.
 *  - **Effects outlived their run.** Cleanup was a JS `setTimeout`, and the JS
 *    thread is exactly what stalls while effects are heavy.
 *
 *  This module is the fix, and it is deliberately pure: no React, no timers, no
 *  clock. It decides WHICH effects are live and in what order. When each one
 *  starts is the renderer's business — see `startedAt` on `LiveEffect` and the
 *  note on late admission below.
 *
 *  ## Why the renderer owns the start time
 *
 *  An effect admitted at time T but first drawn at T+80ms must still play its
 *  full lifecycle from zero. Stamping the start time here would make it begin
 *  80ms in, which on a short beat means the player sees the tail or nothing at
 *  all — and the busier the frame, the more of the effect is eaten. That is
 *  precisely the "intermittently missing effects" symptom. The queue therefore
 *  admits effects with `startedAt: null`, and the renderer stamps it on the
 *  first frame it actually draws.
 *
 *  ## Why a session id
 *
 *  Restart, Home and unmount must drop everything in flight. A generation
 *  counter makes that a value comparison rather than a cleanup race: anything
 *  carrying an old session is not live, whatever else is happening. */

export type EffectPriority = "critical" | "high" | "standard";

/** Ordering used for eviction. Higher survives. */
const PRIORITY_RANK: Record<EffectPriority, number> = {
  critical: 3,
  high: 2,
  standard: 1,
};

/** What an effect is worth, and why these three tiers.
 *
 *  `critical` — the board changed in a way the player cannot undo, or they
 *  spent a rewarded ad to cause it. An explosion permanently rubbles cells; a
 *  revive or a rewarded defuse was bought. Dropping any of these is a
 *  correctness problem, not a polish one.
 *
 *  `high` — the player's own successful play. Line clears and in-turn defuses.
 *  Worth protecting from ordinary churn, but a clear is self-evident from the
 *  board even if its flourish is lost.
 *
 *  `standard` — commentary. Score floats and combo pulses. First to go. */
export function priorityFor(plan: EffectPlan): EffectPriority {
  if (plan.explosions.length > 0 || plan.cue !== null) {
    return "critical";
  }
  if (plan.rows.length > 0 || plan.columns.length > 0 || plan.defuses.length > 0) {
    return "high";
  }
  return "standard";
}

export type LiveEffect = {
  /** Unique and immutable for the life of the effect. Derived, never random, so
   *  the same run replays identically and a test can assert on it. */
  id: string;
  /** The run generation this belongs to. Anything from an older generation is
   *  ignored rather than cleaned up — see the module note. */
  sessionId: number;
  priority: EffectPriority;
  plan: EffectPlan;
  durationMs: number;
  /** Monotonic admission order. Ties in priority are broken by this, so
   *  eviction is total and deterministic rather than dependent on array order. */
  sequence: number;
  /** When the renderer first drew this, in its own clock's units. `null` until
   *  then. The queue never sets this; `startEffect` does, once. */
  startedAt: number | null;
};

/** What a renderer needs to draw one effect, and nothing more.
 *
 *  Deliberately narrower than `LiveEffect`: a renderer has no business seeing
 *  `startedAt`, `sequence` or `sessionId`, all of which are queue bookkeeping.
 *  Both renderers take a list of these, which is what makes the two paths
 *  testable against a single contract. */
export type EffectSequence = {
  id: string;
  priority: EffectPriority;
  plan: EffectPlan;
};

/** Drawing order: standard underneath, then high, critical on top.
 *
 *  Admission order is not drawing order. A score comment admitted after an
 *  explosion is still the less important of the two and must not cover it. */
const DRAW_ORDER: Record<EffectPriority, number> = {
  standard: 1,
  high: 2,
  critical: 3,
};

/** The live effects as a renderer should stack them, bottom first.
 *
 *  Ties fall back to admission order, so the sort is total and two effects of
 *  equal priority never swap places between renders — a swap would remount both
 *  and restart their animations. */
export function drawOrder(queue: EffectQueue): EffectSequence[] {
  return [...queue.effects]
    .sort((a, b) => DRAW_ORDER[a.priority] - DRAW_ORDER[b.priority] || a.sequence - b.sequence)
    .map(({ id, priority, plan }) => ({ id, priority, plan }));
}

export type EffectQueue = {
  effects: readonly LiveEffect[];
  sessionId: number;
  /** Next admission order number. */
  nextSequence: number;
};

/** How many effects may be live at once.
 *
 *  Six is chosen from what one turn can legitimately produce: a clear, a defuse,
 *  an explosion, a score float, plus room for a cue arriving on top. Beyond
 *  that the screen is unreadable anyway, and each live effect costs mounted
 *  components with their own progress. Capping is what makes "unbounded effects"
 *  impossible rather than merely unlikely. */
export const MAX_LIVE_EFFECTS = 6;

export function createEffectQueue(sessionId = 1): EffectQueue {
  return { effects: [], sessionId, nextSequence: 1 };
}

/** Build the id for a turn-driven effect. Derived from the generation and the
 *  turn, so two effects from the same turn never collide and the same run
 *  produces the same ids twice. */
export function turnEffectId(sessionId: number, turn: number): string {
  return `s${sessionId}:t${turn}`;
}

/** Build the id for an out-of-turn cue. Cues do not advance the turn counter,
 *  so they carry their own counter — without it, two rewarded defuses in one
 *  turn would share an id and the second would be treated as a duplicate. */
export function cueEffectId(sessionId: number, cueCount: number): string {
  return `s${sessionId}:c${cueCount}`;
}

/** Admit an effect.
 *
 *  Returns the queue unchanged when the effect is a duplicate or belongs to a
 *  dead session — both are ordinary, not errors. A duplicate happens whenever
 *  React re-runs an effect for a turn already admitted, which is the normal
 *  consequence of a re-render, and admitting it twice is how an effect used to
 *  restart mid-play. */
export function admitEffect(
  queue: EffectQueue,
  effect: Omit<LiveEffect, "sequence" | "startedAt">,
): EffectQueue {
  if (effect.sessionId !== queue.sessionId) {
    return queue;
  }
  if (queue.effects.some((live) => live.id === effect.id)) {
    return queue;
  }

  const admitted: LiveEffect = {
    ...effect,
    sequence: queue.nextSequence,
    startedAt: null,
  };
  const effects = [...queue.effects, admitted];

  return {
    sessionId: queue.sessionId,
    nextSequence: queue.nextSequence + 1,
    effects: effects.length > MAX_LIVE_EFFECTS ? evict(effects) : effects,
  };
}

/** Drop exactly one effect to get back under the cap.
 *
 *  The victim is the lowest priority, and among equals the oldest — so a burst
 *  of standard commentary can never push out a critical explosion, and repeated
 *  admissions evict in a stable, predictable order rather than by whatever
 *  happened to be at index 0.
 *
 *  Deliberately NOT "evict the newest": the newest effect is the one the player
 *  just caused, and dropping it is what makes feedback feel unreliable. */
function evict(effects: readonly LiveEffect[]): LiveEffect[] {
  let victim = effects[0];
  for (const candidate of effects) {
    const lowerPriority = PRIORITY_RANK[candidate.priority] < PRIORITY_RANK[victim.priority];
    const samePriorityAndOlder =
      PRIORITY_RANK[candidate.priority] === PRIORITY_RANK[victim.priority] &&
      candidate.sequence < victim.sequence;
    if (lowerPriority || samePriorityAndOlder) {
      victim = candidate;
    }
  }
  return effects.filter((effect) => effect !== victim);
}

/** Stamp an effect's start time, once.
 *
 *  Called by the renderer on the first frame it draws the effect. A second call
 *  is a no-op, so a re-render cannot restart a running effect — which is the
 *  bug that made a theme switch or a board resize replay whatever was on
 *  screen. */
export function startEffect(queue: EffectQueue, id: string, now: number): EffectQueue {
  let changed = false;
  const effects = queue.effects.map((effect) => {
    if (effect.id !== id || effect.startedAt !== null) {
      return effect;
    }
    changed = true;
    return { ...effect, startedAt: now };
  });
  return changed ? { ...queue, effects } : queue;
}

/** Remove every effect whose lifetime has elapsed.
 *
 *  Retirement is driven by the renderer's clock rather than a `setTimeout`,
 *  which is the other half of the "cleanup exactly once" requirement: a timer
 *  can fire late, fire after unmount, or be throttled in the background, and
 *  all three were happening. An effect that has not started yet is never
 *  retired, however long it has been queued — otherwise a frame the app spent
 *  stalled would silently eat it. */
export function retireFinished(queue: EffectQueue, now: number): EffectQueue {
  const effects = queue.effects.filter(
    (effect) => effect.startedAt === null || now - effect.startedAt < effect.durationMs,
  );
  return effects.length === queue.effects.length ? queue : { ...queue, effects };
}

/** Drop one effect by id, whatever its state. */
export function retireEffect(queue: EffectQueue, id: string): EffectQueue {
  const effects = queue.effects.filter((effect) => effect.id !== id);
  return effects.length === queue.effects.length ? queue : { ...queue, effects };
}

/** End the current generation and start a new one.
 *
 *  Everything in flight is dropped and, because admission checks the session,
 *  anything still being scheduled for the old run is refused rather than racing.
 *  This is what restart, Home and unmount call. */
export function resetSession(queue: EffectQueue): EffectQueue {
  return { effects: [], sessionId: queue.sessionId + 1, nextSequence: 1 };
}

/** True while any admitted effect still holds the input lock.
 *
 *  Only effects whose plan declares a required sequence lock input; commentary
 *  and cues never do. An effect that has not started yet counts as holding the
 *  lock, so input stays held across a stalled frame rather than unlocking and
 *  then re-locking. */
export function holdsInputLock(queue: EffectQueue): boolean {
  return queue.effects.some((effect) => effect.plan.hasRequiredSequence);
}

/** Give each live effect a stable clock slot.
 *
 *  The cinematic board holds a fixed pool of `MAX_LIVE_EFFECTS` animation clocks
 *  because a hook cannot be called in a loop. Handing those out by position in
 *  draw order looks equivalent and is not: draw order is a sort, so admitting a
 *  critical effect or retiring a standard one MOVES every other effect. The
 *  survivor then finds a different clock under it, its slot reads as "new id
 *  here", and its animation restarts from zero — one effect completing resetting
 *  another, which is the exact failure the per-effect clocks exist to prevent.
 *
 *  Slots are therefore leased by effect id: an effect keeps the clock it was
 *  first given until it retires, whatever happens to its neighbours. Freed slots
 *  are reused lowest-first so the assignment is deterministic and testable.
 *
 *  Mutates and returns `leases`; the caller owns that map across renders. An
 *  effect that finds no free slot is omitted, which cannot happen while the
 *  queue cap and the pool size agree but is not worth crashing over if they
 *  ever drift. */
export function assignClockSlots(
  leases: Map<string, number>,
  sequences: readonly EffectSequence[],
  capacity: number,
): { sequence: EffectSequence; slot: number }[] {
  const live = new Set(sequences.map((sequence) => sequence.id));
  for (const id of [...leases.keys()]) {
    if (!live.has(id)) {
      leases.delete(id);
    }
  }

  const taken = new Set(leases.values());
  const assigned: { sequence: EffectSequence; slot: number }[] = [];

  for (const sequence of sequences) {
    let slot = leases.get(sequence.id);
    if (slot === undefined) {
      for (let candidate = 0; candidate < capacity; candidate += 1) {
        if (!taken.has(candidate)) {
          slot = candidate;
          break;
        }
      }
      if (slot === undefined) {
        continue;
      }
      leases.set(sequence.id, slot);
      taken.add(slot);
    }
    assigned.push({ sequence, slot });
  }

  return assigned;
}
