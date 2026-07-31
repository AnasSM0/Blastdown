import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GameEvent } from "../domain/events";
import type { CellPosition } from "../domain/placement";
import type { EffectCueKind } from "../ui/effects/eventEffects";

import { harnessScenario, type HarnessStep } from "./effectHarness";

/** Plays a harness scenario through the gameplay entry points.
 *
 *  ## Why steps are scheduled rather than looped
 *
 *  The obvious implementation applies a scenario's steps in a loop. React
 *  batches state updates, so six "turn" steps in one loop become ONE commit with
 *  the turn counter jumping from 0 to 6 and only the last turn's events visible.
 *  The animator would build a single plan and admit a single effect, and "six
 *  rapid effects" would silently be testing one.
 *
 *  Draining one step per commit instead is closer, and still wrong in a way that
 *  is easy to miss: the runner's effect and the animator's turn effect then land
 *  in the same flush, and which runs first is decided by the order the two hooks
 *  happen to be called in. A scenario whose ordering depends on that is not a
 *  procedure — a cue scripted to follow a clear was admitted before it.
 *
 *  So each step is scheduled on its own timer, one frame apart. Every step gets
 *  a whole task to itself, React commits and flushes the animator's effects
 *  between them, and the order a scenario declares is the order that happens.
 *  One frame is also an honest reading of "rapid": faster than any sequence of
 *  taps, slow enough to be one turn per frame rather than six in an instant. */

/** Gap between scripted steps. One frame at 60Hz. */
export const HARNESS_STEP_MS = 16;

export type HarnessRunnerHooks = {
  /** The animator's out-of-turn cue entry point. */
  playCue: (kind: EffectCueKind, cells: readonly CellPosition[]) => void;
  /** The animator's generation reset — what Restart and Home call. */
  reset: () => void;
};

export type EffectHarnessRunner = {
  /** Turn counter, exactly as the domain's would be. */
  turn: number;
  /** The current turn's events, exactly as `placePiece` would emit them. */
  events: readonly GameEvent[];
  /** Cells of the piece placed this turn, for the board's placement snap. A
   *  plain placement queues no effect — the snap is a board prop — so without
   *  this the "placement only" scenario would show nothing at all. */
  placedCells: readonly CellPosition[];
  placementNonce: number;
  activeScenarioId: string | null;
  /** True when every step of the last scenario has been applied. */
  idle: boolean;
  run: (scenarioId: string) => void;
};

const NO_EVENTS: readonly GameEvent[] = [];
const NO_STEPS: readonly HarnessStep[] = [];
const NO_CELLS: readonly CellPosition[] = [];

export function useEffectHarnessRunner(hooks: HarnessRunnerHooks): EffectHarnessRunner {
  const [turn, setTurn] = useState(0);
  const [events, setEvents] = useState<readonly GameEvent[]>(NO_EVENTS);
  const [pending, setPending] = useState<readonly HarnessStep[]>(NO_STEPS);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // The cue and reset entry points come from the animator, which is built from
  // this hook's own output — so the identity of `hooks` changes on every render
  // of the screen that ties them together. Reading them through a ref keeps that
  // out of the scheduling effect's dependencies, where it would cancel and
  // re-arm the pending step on every render.
  const hooksRef = useRef(hooks);
  useEffect(() => {
    hooksRef.current = hooks;
  });

  useEffect(() => {
    if (pending.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      const [step, ...rest] = pending;
      switch (step.kind) {
        case "turn":
          setEvents(step.events);
          setTurn((current) => current + 1);
          break;
        case "cue":
          hooksRef.current.playCue(step.cue, step.cells);
          break;
        case "reset":
          // Restart: end the generation and put the turn counter back, which is
          // what the game screen does when the player restarts a run.
          hooksRef.current.reset();
          setTurn(0);
          setEvents(NO_EVENTS);
          break;
      }
      setPending(rest);
    }, HARNESS_STEP_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const run = useCallback((scenarioId: string) => {
    const scenario = harnessScenario(scenarioId);
    if (scenario === undefined) {
      return;
    }
    setActiveScenarioId(scenarioId);
    setPending(scenario.steps);
  }, []);

  const placedCells = useMemo(() => {
    const event = events.find((candidate) => candidate.type === "piecePlaced");
    return event && event.type === "piecePlaced" ? event.cells : NO_CELLS;
  }, [events]);

  return {
    turn,
    events,
    placedCells,
    placementNonce: turn,
    activeScenarioId,
    idle: pending.length === 0,
    run,
  };
}
