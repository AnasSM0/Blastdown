import { isDevelopmentBuild } from "../config/environment";
import type { GameEvent } from "../domain/events";
import type { CellPosition } from "../domain/placement";
import type { EffectCueKind } from "../ui/effects/eventEffects";

export { isDevelopmentBuild };

/** A scripted effect-delivery procedure, for a phone.
 *
 *  ## Why a harness rather than "play the game and watch"
 *
 *  The multi-effect contract makes claims a build machine cannot check: six
 *  effects live at once, a seventh evicting the oldest of the lowest priority, a
 *  rewarded cue surviving a burst of clears, a survivor not restarting when the
 *  effect beneath it retires. Reaching any of those by playing means waiting for
 *  the board to happen to produce a double clear plus two expiring timers on the
 *  same turn, then trusting an unaided eye to notice which of the two effects
 *  restarted. That is not a procedure, and the faults this queue exists to fix
 *  were all intermittent — exactly the kind that survive "I played for a while
 *  and it looked fine".
 *
 *  ## What makes it a fair test
 *
 *  Every scenario is a list of steps applied through the SAME entry points
 *  gameplay uses: a turn counter plus that turn's `GameEvent[]` into
 *  `useEventAnimator`, `playCue` for the two out-of-turn rewards, and `reset`
 *  for a restart. The harness reaches nothing else. It cannot fabricate a live
 *  effect, cannot stamp a start time and cannot touch a renderer, so an effect
 *  that appears here is one that delivery genuinely produced — and one that does
 *  not appear is a delivery fault rather than the player's luck.
 *
 *  The events themselves are fixed data, so the same button produces the same
 *  effects in the same order on every device and every run. A tester comparing
 *  two phones is then comparing the phones. */

export type HarnessStep =
  | { kind: "turn"; events: readonly GameEvent[] }
  | { kind: "cue"; cue: EffectCueKind; cells: readonly CellPosition[] }
  | { kind: "reset" };

export type HarnessScenario = {
  id: string;
  label: string;
  /** What the tester should see, in one sentence. A scenario without one is a
   *  button that produces something nobody can fail. */
  expectation: string;
  steps: readonly HarnessStep[];
};

const BOARD_EDGE = 8;

function rowCells(row: number): CellPosition[] {
  return Array.from({ length: BOARD_EDGE }, (_, column) => ({ row, column }));
}

function placed(turn: number): GameEvent {
  // A two-by-two footprint, walked across the board so successive turns are
  // visibly distinct rather than stacking in one corner.
  const row = turn % (BOARD_EDGE - 1);
  const column = (turn * 2) % (BOARD_EDGE - 1);
  return {
    type: "piecePlaced",
    handId: `harness-hand-${turn}`,
    pieceId: `harness-piece-${turn}`,
    cells: [
      { row, column },
      { row, column: column + 1 },
      { row: row + 1, column },
      { row: row + 1, column: column + 1 },
    ],
  };
}

function scored(delta: number, score: number): GameEvent {
  return { type: "scoreChanged", delta, score };
}

/** One turn that clears the given lines, as the engine would report it. */
function clearTurn(
  turn: number,
  rows: readonly number[],
  columns: readonly number[] = [],
  extra: readonly GameEvent[] = [],
): HarnessStep {
  const lines = rows.length + columns.length;
  return {
    kind: "turn",
    events: [
      placed(turn),
      { type: "linesCleared", rows: [...rows], columns: [...columns] },
      ...extra,
      scored(lines * 100, turn * lines * 100),
      { type: "comboChanged", combo: turn },
    ],
  };
}

function explosion(index: number, cells: readonly CellPosition[]): readonly GameEvent[] {
  return [
    {
      type: "explosionStarted",
      explosionId: `harness-x${index}`,
      pieceId: `harness-timed-${index}`,
    },
    { type: "rubbleCreated", explosionId: `harness-x${index}`, cells: [...cells] },
  ];
}

/** Six clears on six consecutive turns, filling the queue exactly to its cap. */
function rapidTurns(count: number, firstTurn = 1): HarnessStep[] {
  return Array.from({ length: count }, (_, index) =>
    clearTurn(firstTurn + index, [(firstTurn + index - 1) % BOARD_EDGE]),
  );
}

export const EFFECT_HARNESS_SCENARIOS: readonly HarnessScenario[] = [
  {
    id: "placement",
    label: "Placement only",
    expectation:
      "The board plays its placement snap and NOTHING is queued — a plain placement has no required sequence, so an effect appearing here means the queue is admitting churn.",
    steps: [{ kind: "turn", events: [placed(1), scored(4, 4)] }],
  },
  {
    id: "line-clear",
    label: "One line clear",
    expectation: "Row 3 sweeps left to right, once, and input unlocks when it finishes.",
    steps: [clearTurn(1, [3])],
  },
  {
    id: "row-and-column",
    label: "Row + column together",
    expectation:
      "Row 3 sweeps left to right while column 5 sweeps top to bottom, as one effect; their intersection lights once, not twice.",
    steps: [clearTurn(1, [3], [5])],
  },
  {
    id: "two-clears",
    label: "Two clears, back to back",
    expectation:
      "Two separate clears run side by side. Neither restarts the other, and the first is not cut short by the second.",
    steps: [clearTurn(1, [1]), clearTurn(2, [6])],
  },
  {
    id: "clear-and-defuse",
    label: "Clear + defuse",
    expectation:
      "Row 2 sweeps and the defused piece flashes on its own footprint — not on the cleared line's midpoint.",
    steps: [
      clearTurn(
        1,
        [2],
        [],
        [
          {
            type: "pieceDefused",
            pieceId: "harness-timed-1",
            bonus: 50,
            remainingTurns: 3,
          },
        ],
      ),
    ],
  },
  {
    id: "clear-and-explosion",
    label: "Clear + explosion",
    expectation:
      "Row 1 sweeps, then the explosion bursts and the board shakes. Both play; the clear is not replaced by the burst.",
    steps: [
      clearTurn(
        1,
        [1],
        [],
        explosion(1, [
          { row: 4, column: 4 },
          { row: 4, column: 5 },
        ]),
      ),
    ],
  },
  {
    id: "multiple-explosions",
    label: "Two explosions at once",
    expectation:
      "Two bursts read as two, in event order, each over its own rubble. One shake, not two fighting each other.",
    steps: [
      clearTurn(
        1,
        [0],
        [],
        [
          ...explosion(1, [
            { row: 2, column: 2 },
            { row: 2, column: 3 },
          ]),
          ...explosion(2, [
            { row: 6, column: 6 },
            { row: 6, column: 7 },
          ]),
        ],
      ),
    ],
  },
  {
    id: "six-rapid",
    label: "Six rapid effects",
    expectation:
      "Six clears run concurrently, all six visible. This is the cap: the queue holds six and the cinematic board has six clocks.",
    steps: rapidTurns(6),
  },
  {
    id: "seventh-evicts",
    label: "Seventh effect (eviction)",
    expectation:
      "Seven clears arrive and six remain. The FIRST one disappears — same priority, admitted earliest — and the newest is never the one dropped.",
    steps: rapidTurns(7),
  },
  {
    id: "critical-under-pressure",
    label: "Rewarded cue under pressure",
    expectation:
      "The rewarded defuse cue is admitted first and still survives six clears behind it. A cue the player paid an ad for must outrank ordinary churn.",
    steps: [
      {
        kind: "cue",
        cue: "rewardedDefuse",
        cells: [
          { row: 4, column: 3 },
          { row: 4, column: 4 },
        ],
      },
      ...rapidTurns(6),
    ],
  },
  {
    id: "retire-lower",
    label: "Lower effect retires first",
    expectation:
      "The clear (340ms) finishes while the rewarded cue (400ms) is still running. The cue must NOT jump back to its start when the clear disappears.",
    steps: [clearTurn(1, [3]), { kind: "cue", cue: "rewardedDefuse", cells: rowCells(6) }],
  },
  {
    id: "restart-mid-effect",
    label: "Restart mid-effect",
    expectation:
      "A clear and an explosion are running when the run restarts. Everything vanishes at once and the board is immediately usable — nothing lingers, nothing replays.",
    steps: [
      clearTurn(
        1,
        [3],
        [5],
        explosion(1, [
          { row: 7, column: 0 },
          { row: 7, column: 1 },
        ]),
      ),
      { kind: "reset" },
    ],
  },
  {
    id: "session-change",
    label: "Session change mid-effect",
    expectation:
      "After the restart a new clear plays normally and carries the new generation. A timer from the run that was left cannot cut it short.",
    steps: [clearTurn(1, [3]), { kind: "reset" }, clearTurn(2, [4])],
  },
];

export function harnessScenario(id: string): HarnessScenario | undefined {
  return EFFECT_HARNESS_SCENARIOS.find((scenario) => scenario.id === id);
}
