import type { GameEvent } from "../../src/domain/events";
import {
  comboPitchSemitones,
  feedbackSpec,
  playbackRateForSemitones,
  resolveTurnFeedback,
} from "../../src/services/feedback";

function resolve(
  events: GameEvent[],
  options: { combo?: number; newBest?: boolean; turn?: number } = {},
) {
  return resolveTurnFeedback({
    sessionGeneration: 3,
    turn: options.turn ?? 7,
    events,
    combo: options.combo ?? 1,
    newBest: options.newBest ?? false,
  });
}

const placed: GameEvent = {
  type: "piecePlaced",
  handId: "h1",
  pieceId: "p1",
  cells: [{ row: 0, column: 0 }],
};

const clear = (count: number): GameEvent => ({
  type: "linesCleared",
  rows: Array.from({ length: count }, (_, index) => index),
  columns: [],
});

describe("semantic feedback resolution", () => {
  it.each([
    [1, "clearSingle", "mediumImpact"],
    [2, "clearDouble", "heavyImpact"],
    [3, "clearTriple", "heavyImpact"],
    [4, "clearOverload", "heavyImpact"],
    [6, "clearOverload", "heavyImpact"],
  ] as const)("maps %i committed lines to %s", (count, cue, haptic) => {
    expect(resolve([placed, clear(count)])).toEqual(
      expect.objectContaining({ cue, haptic, identity: "s3:t7" }),
    );
  });

  it("uses one semitone per combo step and caps at one octave", () => {
    expect(comboPitchSemitones(0)).toBe(0);
    expect(comboPitchSemitones(1)).toBe(0);
    expect(comboPitchSemitones(2)).toBe(1);
    expect(comboPitchSemitones(8)).toBe(7);
    expect(comboPitchSemitones(99)).toBe(12);
    expect(playbackRateForSemitones(12)).toBeCloseTo(2);
    expect(resolve([clear(1)], { combo: 4 })?.semitones).toBe(3);
  });

  it("distinguishes timer 2 and timer 1 and emits no initial/hydrated turn", () => {
    expect(resolve([{ type: "timerWarning", pieceId: "p1", remainingTurns: 2 }])?.cue).toBe(
      "timerWarning2",
    );
    expect(resolve([{ type: "timerWarning", pieceId: "p1", remainingTurns: 1 }])?.cue).toBe(
      "timerWarning1",
    );
    expect(resolve([placed], { turn: 0 })).toBeNull();
    expect(feedbackSpec("timerWarning2").asset).toBe("timer2");
    expect(feedbackSpec("timerWarning1").asset).toBe("timer1");
    expect(feedbackSpec("timerWarning1").priority).toBeGreaterThan(
      feedbackSpec("timerWarning2").priority,
    );
  });

  it("maps a timer-1 natural defuse to clutch and other natural defuses separately", () => {
    expect(
      resolve([{ type: "pieceDefused", pieceId: "p1", bonus: 35, remainingTurns: 1 }])?.cue,
    ).toBe("clutchDefuse");
    expect(
      resolve([{ type: "pieceDefused", pieceId: "p1", bonus: 45, remainingTurns: 2 }])?.cue,
    ).toBe("naturalDefuse");
    expect(feedbackSpec("clutchDefuse").asset).toBe("clutch");
    expect(feedbackSpec("clutchDefuse").priority).toBeGreaterThan(
      feedbackSpec("naturalDefuse").priority,
    );
  });

  it("lets explosion dominate every lower-priority result from the same turn", () => {
    const feedback = resolve(
      [
        placed,
        clear(4),
        { type: "pieceDefused", pieceId: "p1", bonus: 35, remainingTurns: 1 },
        { type: "rubbleCleared", cells: [{ row: 1, column: 1 }] },
        { type: "explosionStarted", explosionId: "x1", pieceId: "p2", sourceCells: [] },
        { type: "gameOver" },
      ],
      { combo: 13, newBest: true },
    );

    expect(feedback?.cue).toBe("explosion");
    expect(feedback?.haptic).toBe("explosion");
    expect(feedbackSpec("explosion").priority).toBeGreaterThan(
      feedbackSpec("clutchDefuse").priority,
    );
  });

  it("maps rubble, ordinary game over, and a committed new best", () => {
    expect(resolve([{ type: "rubbleCleared", cells: [{ row: 2, column: 2 }] }])?.cue).toBe(
      "rubbleCleared",
    );
    expect(resolve([{ type: "gameOver" }])?.cue).toBe("gameOver");
    expect(resolve([{ type: "gameOver" }], { newBest: true })?.cue).toBe("newBest");
  });

  it("maps rewarded and interaction semantics without domain inference", () => {
    expect(feedbackSpec("piecePickup").asset).toBe("selection");
    expect(feedbackSpec("invalidPlacement").asset).toBe("invalid");
    expect(feedbackSpec("freezeApplied").asset).toBe("freeze");
    expect(feedbackSpec("defusePowerUpApplied").asset).toBe("defusePowerUp");
  });
});
