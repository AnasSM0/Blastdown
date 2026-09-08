import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GameEvent } from "../domain/events";
import type { GridCell } from "../domain/gameTypes";
import type { CellPosition } from "../domain/placement";
import {
  admitEffect,
  drawOrder,
  createEffectQueue,
  cueEffectId,
  hasRequiredSequence,
  priorityFor,
  resetSession,
  retireEffect,
  startEffect,
  turnEffectId,
  type EffectQueue,
  type EffectSequence,
  type LiveEffect,
} from "../ui/effects/effectQueue";
import { recordEffectEnqueue, recordQueueTransition } from "../ui/effects/effectDiagnostics";
import {
  buildCuePlan,
  buildEffectPlan,
  type EffectCueKind,
  type EffectPlan,
} from "../ui/effects/eventEffects";

type Grid = readonly (readonly GridCell[])[];

type UseEventAnimatorArgs = {
  /** The domain turn counter — increments once per applied placement. */
  turn: number;
  /** Events emitted by the placement that produced the current `turn`. */
  events: readonly GameEvent[];
  /** The current authoritative grid. The hook keeps the previous turn's grid so
   *  a defused piece's footprint can be resolved (the event carries no cells). */
  grid: Grid;
  reducedMotion: boolean;
};

export type EventAnimator = {
  /** True while a required presentation sequence is active. Observational only;
   * gameplay input must never depend on it. */
  isAnimating: boolean;
  /** The current run generation. Bumped by `reset`, carried by every effect id.
   *  Diagnostics and tests read it; renderers have no business with it. */
  sessionId: number;
  /** Every live effect, each with its own identity, priority and start time.
   *  A renderer may draw all of them concurrently. */
  effects: readonly LiveEffect[];
  /** Every live effect in drawing order (standard lowest, critical highest).
   *  This is what both renderers draw; all of it, concurrently. */
  sequences: readonly EffectSequence[];
  /** The highest-priority live plan. Drives the board-level explosion shake,
   *  which belongs to the board rather than to any one effect. */
  plan: EffectPlan | null;
  /** Identity of whatever `plan` currently is, so the single-plan renderer can
   *  remount cleanly between sequences. */
  effectKey: string | null;
  /** Called by the renderer on the first frame it actually draws an effect.
   *  This is what starts the effect's clock — see `effectQueue.ts` for why the
   *  queue refuses to stamp it at admission. */
  startedDrawing: (id: string, now: number) => void;
  /** Play an out-of-turn cue (rewarded defuse / revive). Those actions don't
   *  advance the turn counter, so they can't come from the event stream; the
   *  caller supplies the cells it read from authoritative state before applying
   *  the action. */
  playCue: (kind: EffectCueKind, cells: readonly CellPosition[]) => void;
  /** End this run's effects and start a new generation (restart/navigation). */
  reset: () => void;
};

/** Drives visual effects from the domain's own event stream.
 *
 *  It never computes gameplay — it consumes `placePiece` output and schedules
 *  purely cosmetic beats. Domain state stays authoritative and is applied by the
 *  controller independently.
 *
 *  ## What changed, and why
 *
 *  This hook used to hold ONE plan in a state slot, replace it on every turn,
 *  and clear it with a single shared `setTimeout`. On device that produced
 *  intermittently missing effects, and the mechanism was not subtle once traced:
 *
 *  - A cue arriving while a turn sequence played was **dropped entirely** — the
 *    old `playCue` returned early when the animator was busy. A rewarded defuse
 *    bought with an ad showed nothing at all.
 *  - A turn arriving while anything else played **replaced** it, so the first
 *    sequence's remaining beats never drew.
 *  - One `timerRef` was shared by turns and cues, so each cancelled the other's
 *    cleanup.
 *  - An ordinary placement called `stop()`, wiping a cue that was still playing.
 *
 *  Effects now go into a bounded, prioritised queue (`ui/effects/effectQueue.ts`)
 *  and every live effect can draw concurrently with its own clock. Retirement is
 *  scheduled from the moment the renderer first DRAWS an effect rather than from
 *  the moment it was queued, so a stalled frame delays an effect instead of
 *  eating it. */
export function useEventAnimator({
  turn,
  events,
  grid,
  reducedMotion,
}: UseEventAnimatorArgs): EventAnimator {
  const [queue, setQueue] = useState<EffectQueue>(() => createEffectQueue());

  const lastTurnRef = useRef(turn);
  const cueCountRef = useRef(0);
  // One retirement timer per effect id. Per-effect rather than shared: the
  // single shared timer was why a cue and a turn cancelled each other's
  // cleanup, ending one early or leaving it on screen.
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Latched true the first time any renderer reports a draw. Distinguishes "the
  // renderer is slow" from "this renderer does not report at all", which is the
  // difference between waiting for an effect and eating it.
  const rendererReportsRef = useRef(false);
  // Effect ids that already have a precise (post-draw) retirement timer, so the
  // scheduling effect does not keep extending their lifetime on every render.
  const precisedRef = useRef(new Set<string>());
  // Mirrors the queue for reads inside `startedDrawing`, which the renderer
  // calls from a draw — after commit — so the committed value is current.
  // Written in the effect below rather than during render.
  const queueRef = useRef(queue);

  const eventsRef = useRef(events);
  const reducedRef = useRef(reducedMotion);
  const latestGridRef = useRef(grid);
  // The grid as it stood BEFORE the turn being animated, so a defused piece's
  // footprint can still be located. Advanced only inside the turn effect.
  const preTurnGridRef = useRef(grid);
  useEffect(() => {
    queueRef.current = queue;
    eventsRef.current = events;
    reducedRef.current = reducedMotion;
    latestGridRef.current = grid;
  });

  // Effect delivery diagnostics, derived from COMMITTED queue transitions.
  //
  // Recording from inside the state updater would be the obvious place — it is
  // where admission and eviction actually happen — and it is wrong: an updater
  // is re-invoked on a rebase and twice under StrictMode, so every counter would
  // inflate under re-render. Inflated counters lie in the direction of
  // "everything is fine", which is the most expensive way for a diagnostic to be
  // wrong. Observing a committed pair is idempotent instead.
  const observedRef = useRef(queue);
  useEffect(() => {
    recordQueueTransition(observedRef.current, queue, Date.now());
    observedRef.current = queue;
  }, [queue]);

  const clearAllTimers = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    precisedRef.current.clear();
  }, []);

  /** Retire an effect after `delayMs`, replacing any timer it already has.
   *
   *  Used for the PRECISE timer only — scheduled on the first draw, for exactly
   *  the effect's duration. See `scheduleWatchdog` for the other half. */
  const scheduleRetire = useCallback((id: string, sessionId: number, delayMs: number) => {
    const existing = timersRef.current.get(id);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      setQueue((current) =>
        // The session check is what makes a late timer harmless: one from a run
        // the player already left cannot disturb the new one.
        current.sessionId === sessionId ? retireEffect(current, id) : current,
      );
    }, delayMs);
    timersRef.current.set(id, timer);
  }, []);

  const scheduleWatchdog = useCallback((id: string, sessionId: number, durationMs: number) => {
    armWatchdog(
      {
        timers: timersRef.current,
        readQueue: () => queueRef.current,
        rendererReports: () => rendererReportsRef.current,
        setQueue,
      },
      id,
      sessionId,
      durationMs,
      0,
    );
  }, []);

  /** The renderer drew this effect for the first time.
   *
   *  Deliberately reads NOTHING from `queueRef`, and that is the whole point.
   *
   *  React runs child effects before parent effects. `useEventAnimator` lives
   *  in the game screen; the effect layers are its descendants. So on the very
   *  render where an effect first appears, the layer's mount effect fires
   *  BEFORE the parent effect that syncs `queueRef` — meaning the ref still
   *  holds the previous queue, without the new effect in it.
   *
   *  An earlier version looked the effect up in that ref and returned early
   *  when it was missing. Since a layer reports exactly once per effect id,
   *  that one report was always swallowed: `startedAt` was never set,
   *  `rendererReports` never latched, and the entire mechanism stayed inert
   *  while looking wired. The unit tests missed it because `act()` flushes all
   *  effects before assertions, which hides the ordering the real app has.
   *
   *  The functional updater always sees current state, so the stamp goes there.
   *  The precise retirement timer is scheduled by the effect below, from the
   *  queue itself, once the stamp has actually landed. */
  const startedDrawing = useCallback((id: string, now: number) => {
    // Latched unconditionally: a renderer called this, which is what the flag
    // means. Whether the queue has caught up yet is irrelevant to that fact.
    rendererReportsRef.current = true;
    setQueue((current) => startEffect(current, id, now));
  }, []);

  // Give every newly started effect its precise retirement, replacing the
  // admission watchdog. Driven off the queue rather than off `startedDrawing`
  // so it cannot run before the stamp exists.
  useEffect(() => {
    for (const effect of queue.effects) {
      if (effect.startedAt === null || precisedRef.current.has(effect.id)) {
        continue;
      }
      precisedRef.current.add(effect.id);
      scheduleRetire(effect.id, queue.sessionId, effect.durationMs);
    }
  }, [queue, scheduleRetire]);

  const playCue = useCallback(
    (kind: EffectCueKind, cells: readonly CellPosition[]) => {
      if (cells.length === 0) {
        return;
      }
      const cuePlan = buildCuePlan(kind, cells, reducedRef.current);
      cueCountRef.current += 1;
      const cueCount = cueCountRef.current;
      // The attempt, counted before the queue sees it. A refused admission
      // leaves no trace in the queue — nothing is added — so this is the only
      // evidence that a cue the player paid for was ever offered.
      recordEffectEnqueue(
        cueEffectId(queueRef.current.sessionId, cueCount),
        queueRef.current.sessionId,
        Date.now(),
      );
      // No busy check. A cue is a rewarded outcome the player paid for, so it is
      // admitted alongside whatever is playing rather than instead of it. The id
      // is derived inside the updater so it always carries the live generation,
      // even if a reset landed between the tap and this call.
      setQueue((current) => {
        const id = cueEffectId(current.sessionId, cueCount);
        scheduleWatchdog(id, current.sessionId, cuePlan.durationMs);
        return admitEffect(current, {
          id,
          sessionId: current.sessionId,
          priority: priorityFor(cuePlan),
          plan: cuePlan,
          durationMs: cuePlan.durationMs,
        });
      });
    },
    [scheduleWatchdog],
  );

  const reset = useCallback(() => {
    clearAllTimers();
    lastTurnRef.current = 0;
    cueCountRef.current = 0;
    preTurnGridRef.current = latestGridRef.current;
    setQueue((current) => resetSession(current));
  }, [clearAllTimers]);

  useEffect(() => {
    // Only a forward turn is a new placement; a reset to 0 (restart) clears.
    if (turn <= lastTurnRef.current) {
      lastTurnRef.current = turn;
      preTurnGridRef.current = latestGridRef.current;
      return;
    }
    lastTurnRef.current = turn;

    const nextPlan = buildEffectPlan(eventsRef.current, reducedRef.current, {
      previousGrid: preTurnGridRef.current,
    });
    preTurnGridRef.current = latestGridRef.current;

    // A plain placement produces no beats worth queueing. Every placement
    // scores, so admitting on score alone would queue an effect every single
    // turn -- churn, and eviction pressure against the effects that matter.
    //
    // Note what does NOT happen here any more: this used to clear whatever was
    // on screen, so an ordinary placement wiped a cue that was still playing.
    if (!nextPlan.hasRequiredSequence) {
      return;
    }

    recordEffectEnqueue(
      turnEffectId(queueRef.current.sessionId, turn),
      queueRef.current.sessionId,
      Date.now(),
    );
    setQueue((current) => {
      const id = turnEffectId(current.sessionId, turn);
      scheduleWatchdog(id, current.sessionId, nextPlan.durationMs);
      return admitEffect(current, {
        id,
        sessionId: current.sessionId,
        priority: priorityFor(nextPlan),
        plan: nextPlan,
        durationMs: nextPlan.durationMs,
      });
    });
  }, [turn, scheduleWatchdog]);

  // Cancel every pending retirement on unmount. Each timer is also session
  // guarded, so one that somehow survives cannot touch a later run.
  useEffect(() => clearAllTimers, [clearAllTimers]);

  // The single-plan view, for the React Native renderer, which draws one
  // sequence at a time: the highest-priority live effect and, among equals, the
  // newest — the one the player just caused.
  const primary = useMemo(() => {
    let best: LiveEffect | null = null;
    for (const effect of queue.effects) {
      if (best === null || rank(effect) > rank(best)) {
        best = effect;
      }
    }
    return best;
  }, [queue.effects]);

  // What the renderers actually draw: every live effect, bottom-first. Memoized
  // because both renderers key children off this array, and a fresh identity on
  // every screen render would defeat their memoization even though the contents
  // are unchanged.
  const sequences = useMemo(() => drawOrder(queue), [queue]);

  return {
    isAnimating: hasRequiredSequence(queue),
    sessionId: queue.sessionId,
    effects: queue.effects,
    /** Every live effect in drawing order. Both renderers consume this. */
    sequences,
    // The collapsed view. Kept for the board's own explosion shake, which is a
    // property of the board rather than of an effect, and NOT a description of
    // what is on screen — the renderers draw `sequences`, all of it.
    plan: primary?.plan ?? null,
    effectKey: primary?.id ?? null,
    startedDrawing,
    playCue,
    reset,
  };
}

type WatchdogContext = {
  timers: Map<string, ReturnType<typeof setTimeout>>;
  readQueue: () => EffectQueue;
  rendererReports: () => boolean;
  setQueue: (update: (current: EffectQueue) => EffectQueue) => void;
};

/** The safety net for an effect the renderer has not drawn yet.
 *
 *  Getting this wrong once already reintroduced the bug the queue exists to
 *  fix, so the reasoning is worth spelling out.
 *
 *  A first version retired unconditionally after duration plus a grace window.
 *  That silently ate any effect the renderer took longer than the grace to
 *  draw — which is exactly the "intermittently missing under load" symptom,
 *  since a stalled frame is when the delay is longest. It also contradicted
 *  `effectQueue.ts`, which promises an unstarted effect is never retired
 *  however long it waits.
 *
 *  Waiting forever is not available either: the React Native fallback renderer
 *  never reports draws at all, so a required sequence would remain mounted
 *  indefinitely.
 *
 *  The two cases are distinguishable. A renderer that has EVER reported a draw
 *  is participating, so the watchdog waits again rather than cutting the effect
 *  short. One that has never reported is not going to start, so its effects
 *  retire on schedule.
 *
 *  Re-arming is bounded: a participating renderer whose board unmounts mid
 *  sequence must not keep stale presentation mounted indefinitely.
 *
 *  Module level rather than a `useCallback` because it recurses, and a callback
 *  cannot reference its own identity. */
function armWatchdog(
  context: WatchdogContext,
  id: string,
  sessionId: number,
  durationMs: number,
  extension: number,
): void {
  const existing = context.timers.get(id);
  if (existing !== undefined) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    context.timers.delete(id);
    const queue = context.readQueue();
    if (queue.sessionId !== sessionId) {
      return;
    }
    const live = queue.effects.find((effect) => effect.id === id);
    if (live === undefined) {
      return;
    }

    if (
      live.startedAt === null &&
      context.rendererReports() &&
      extension < MAX_WATCHDOG_EXTENSIONS
    ) {
      // A participating renderer simply has not got to it yet. Wait.
      armWatchdog(context, id, sessionId, durationMs, extension + 1);
      return;
    }

    context.setQueue((current) =>
      current.sessionId === sessionId ? retireEffect(current, id) : current,
    );
  }, durationMs + RETIRE_GRACE_MS);

  context.timers.set(id, timer);
}

/** Grace beyond an effect's own duration before the watchdog considers it
 *  stuck. On a renderer that reports draws the precise timer always supersedes
 *  this; on one that does not, it is the whole lifetime. */
const RETIRE_GRACE_MS = 400;

/** How many times the watchdog will wait again for a participating renderer
 *  that has not yet drawn an effect. Bounded so a board unmounted mid-sequence
 *  cannot retain it forever; generous enough that an ordinary stall never
 *  truncates an effect. */
const MAX_WATCHDOG_EXTENSIONS = 3;

const PRIORITY_ORDER = { critical: 3, high: 2, standard: 1 } as const;

/** Sort key for the single-plan view: priority first, then recency. */
function rank(effect: LiveEffect): number {
  return PRIORITY_ORDER[effect.priority] * 1_000_000 + effect.sequence;
}
