import { render } from "@testing-library/react-native";

import { CinematicBoard } from "../../src/components/CinematicBoard";
import { EffectsLayer } from "../../src/components/effects/EffectsLayer";
import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";
import type { EffectPlan } from "../../src/ui/effects/eventEffects";

/** The guard for a failure that shipped twice in this session's work.
 *
 *  `useEventAnimator.startedDrawing` is the call that gives an effect its real
 *  start time, and it was added to the animator's API without being wired into
 *  either renderer. In production it was therefore never invoked: `startedAt`
 *  stayed null forever, every effect retired on the watchdog rather than on its
 *  own clock, and the "wait for a slow renderer" branch was unreachable code.
 *
 *  The unit tests all passed, because they called `startedDrawing` by hand. A
 *  test that drives a mechanism directly cannot tell you whether anything
 *  reaches it — which is the same shape as the blur guards that certified three
 *  consecutive non-fixes.
 *
 *  So these tests render the real components with real props and assert the
 *  callback comes back out. Nothing is called by hand. */

const BOARD_SIDE = 328;

function grid(): DomainGridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): DomainGridCell => ({ kind: "empty" })),
  );
}

function clearPlan(): EffectPlan {
  return {
    clear: null,
    boardImpulse: null,
    rows: [3],
    columns: [],
    clearedCells: Array.from({ length: 8 }, (_, column) => ({ row: 3, column })),
    defuses: [],
    explosion: null,
    explosions: [],
    rubbleCells: [],
    reviveCells: [],
    scoreDelta: 100,
    score: 100,
    combo: null,
    comboReset: false,
    cue: null,
    hasRequiredSequence: true,
    durationMs: 340,
  };
}

describe("the React Native effect layer reports that it drew", () => {
  it("calls back with the effect id when it mounts", async () => {
    const started: string[] = [];
    const view = await render(
      <EffectsLayer
        plan={clearPlan()}
        cellSize={38}
        reducedMotion={false}
        effectId="s1:t7"
        onStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toEqual(["s1:t7"]);
    await view.unmount();
  });

  it("stays silent when it has nothing to draw into", async () => {
    // A zero cell size means the board has not been measured, so nothing is on
    // screen. Reporting a draw there would start the clock on an invisible
    // effect — the precise failure the start time exists to prevent.
    const started: string[] = [];
    const view = await render(
      <EffectsLayer
        plan={clearPlan()}
        cellSize={0}
        reducedMotion={false}
        effectId="s1:t7"
        onStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toEqual([]);
    await view.unmount();
  });

  it("reports each effect once, not on every re-render", async () => {
    const started: string[] = [];
    const view = await render(
      <EffectsLayer
        plan={clearPlan()}
        cellSize={38}
        reducedMotion={false}
        effectId="s1:t7"
        onStarted={(id) => started.push(id)}
      />,
    );
    await view.rerender(
      <EffectsLayer
        plan={clearPlan()}
        cellSize={38}
        reducedMotion={false}
        effectId="s1:t7"
        onStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toEqual(["s1:t7"]);
    await view.unmount();
  });
});

describe("the cinematic board reports that it drew", () => {
  it("calls back with the effect id when an effect is present", async () => {
    const started: string[] = [];
    const view = await render(
      <CinematicBoard
        grid={grid()}
        badges={[]}
        boardSize={BOARD_SIDE}
        effectSequences={[
          {
            id: "s1:t7",
            sessionGeneration: 1,
            turn: 7,
            priority: "high",
            plan: clearPlan(),
            explosion: null,
          },
        ]}
        onEffectStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toEqual(["s1:t7"]);
    await view.unmount();
  });

  it("stays silent when there is no effect to draw", async () => {
    const started: string[] = [];
    const view = await render(
      <CinematicBoard
        grid={grid()}
        badges={[]}
        boardSize={BOARD_SIDE}
        effectSequences={[]}
        onEffectStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toEqual([]);
    await view.unmount();
  });
});

describe("both renderers report, so the queue behaves the same either way", () => {
  it("agrees on when a draw is reported", async () => {
    // The flag switches renderers, and effect delivery must not switch with it.
    // If only one reported, that build would get real start times and the other
    // would silently fall back to the watchdog.
    const rn: string[] = [];
    const skia: string[] = [];

    const rnView = await render(
      <EffectsLayer
        plan={clearPlan()}
        cellSize={38}
        reducedMotion={false}
        effectId="same"
        onStarted={(id) => rn.push(id)}
      />,
    );
    const skiaView = await render(
      <CinematicBoard
        grid={grid()}
        badges={[]}
        boardSize={BOARD_SIDE}
        effectSequences={[
          {
            id: "same",
            sessionGeneration: 1,
            turn: 1,
            priority: "high",
            plan: clearPlan(),
            explosion: null,
          },
        ]}
        onEffectStarted={(id) => skia.push(id)}
      />,
    );

    expect(rn).toEqual(skia);
    await rnView.unmount();
    await skiaView.unmount();
  });
});

describe("the game screen hands the callback to whichever renderer it mounts", () => {
  it("wires onStarted and onEffectStarted from the animator", () => {
    // A structural guard, because the bug was a missing wire rather than a
    // broken one: the components were correct and nobody called them.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs") as {
      readFileSync: (path: string, encoding: string) => string;
    };
    const source = readFileSync("app/game.tsx", "utf8");

    expect(source).toMatch(/onEffectStarted=\{animator\.startedDrawing\}/);
    expect(source).toMatch(/onStarted=\{animator\.startedDrawing\}/);
  });
});
