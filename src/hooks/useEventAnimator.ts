import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GameEvent } from "../domain/events";
import type { GridCell } from "../domain/gameTypes";
import type { CellPosition } from "../domain/placement";
import {
  admitEffect,
  createEffectQueue,
  cueEffectId,
  holdsInputLock,
  priorityFor,
  resetSession,
  retireEffect,
  startEffect,
  turnEffectId,
  type EffectQueue,
  type LiveEffect,
} from "../ui/effects/effectQueue";
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
   *  a defused piece's footprint can be resolved (the event carries only an id). */
  grid: Grid;
  reducedMotion: boolean;
};

export type EventAnimator = {
  /** True while any admitted effect holds the input lock. */
  isAnimating: boolean;
  /** Every live effect, each with its own identity, priority and start time.
   *  A renderer may draw all of them concurrently. */
  effects: readonly LiveEffect[];
  /** The highest-priority live plan, for the React Native renderer, which draws
   *  one sequence at a time. */
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

  const clearAllTimers = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
  }, []);

  /** Schedule an effect's retirement `delayMs` from now, replacing any timer it
   *  already has.
   *
   *  Called twice in an effect's life: once at ADMISSION as a watchdog, and
   *  again on the first DRAW with the precise duration. The watchdog is not
   *  redundant. A renderer that never reports a draw -- the React Native
   *  fallback does not -- would otherwise leave the effect live forever, and
   *  since a required sequence holds the input lock, the board would freeze.
   *  Liveness must not depend on the renderer choosing to participate.
   *
   *  The watchdog is generous (duration plus a grace window) so that on a
   *  renderer which does report, the precise timer always supersedes it. */
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

  /** The renderer drew this effect for the first time. Stamp its clock and
   *  re-schedule its retirement from THAT moment, not from admission. */
  const startedDrawing = useCallback(
    (id: string, now: number) => {
      const live = queueRef.current.effects.find((effect) => effect.id === id);
      if (!live || live.startedAt !== null) {
        return;
      }
      setQueue((current) => startEffect(current, id, now));
      scheduleRetire(id, queueRef.current.sessionId, live.durationMs);
    },
    [scheduleRetire],
  );

  const playCue = useCallback(
    (kind: EffectCueKind, cells: readonly CellPosition[]) => {
      if (cells.length === 0) {
        return;
      }
      const cuePlan = buildCuePlan(kind, cells, reducedRef.current);
      cueCountRef.current += 1;
      const cueCount = cueCountRef.current;
      // No busy check. A cue is a rewarded outcome the player paid for, so it is
      // admitted alongside whatever is playing rather than instead of it. The id
      // is derived inside the updater so it always carries the live generation,
      // even if a reset landed between the tap and this call.
      setQueue((current) => {
        const id = cueEffectId(current.sessionId, cueCount);
        scheduleRetire(id, current.sessionId, cuePlan.durationMs + RETIRE_GRACE_MS);
        return admitEffect(current, {
          id,
          sessionId: current.sessionId,
          priority: priorityFor(cuePlan),
          plan: cuePlan,
          durationMs: cuePlan.durationMs,
        });
      });
    },
    [scheduleRetire],
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

    setQueue((current) => {
      const id = turnEffectId(current.sessionId, turn);
      scheduleRetire(id, current.sessionId, nextPlan.durationMs + RETIRE_GRACE_MS);
      return admitEffect(current, {
        id,
        sessionId: current.sessionId,
        priority: priorityFor(nextPlan),
        plan: nextPlan,
        durationMs: nextPlan.durationMs,
      });
    });
  }, [turn, scheduleRetire]);

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

  return {
    isAnimating: holdsInputLock(queue),
    effects: queue.effects,
    plan: primary?.plan ?? null,
    effectKey: primary?.id ?? null,
    startedDrawing,
    playCue,
    reset,
  };
}

/** Extra time the admission watchdog allows before retiring an effect the
 *  renderer never reported drawing. Long enough that a renderer which does
 *  report always supersedes it, short enough that a stuck effect clears within
 *  one beat rather than holding the input lock indefinitely. */
const RETIRE_GRACE_MS = 400;

const PRIORITY_ORDER = { critical: 3, high: 2, standard: 1 } as const;

/** Sort key for the single-plan view: priority first, then recency. */
function rank(effect: LiveEffect): number {
  return PRIORITY_ORDER[effect.priority] * 1_000_000 + effect.sequence;
}
