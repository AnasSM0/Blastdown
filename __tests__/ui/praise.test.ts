import type { GameEvent } from "../../src/domain/events";
import {
  admitPraise,
  completePraise,
  createPraiseState,
  resetPraiseSession,
  resolvePraiseForTurn,
} from "../../src/ui/praise";

const identity = { sessionId: 7, turn: 12 };

function lines(count: number): GameEvent[] {
  return [
    { type: "linesCleared", rows: Array.from({ length: count }, (_, index) => index), columns: [] },
  ];
}

describe("semantic praise resolver", () => {
  it.each([
    [1, 1, "NICE"],
    [2, 2, "DOUBLE"],
    [3, 2, "TRIPLE BLAST"],
    [4, 2, "OVERLOAD"],
    [6, 2, "OVERLOAD"],
  ] as const)("maps %i cleared lines to tier %i %s", (count, tier, text) => {
    expect(resolvePraiseForTurn(lines(count), identity)).toMatchObject({ tier, text });
  });

  it.each([
    [4, "DEFUSED"],
    [3, "DEFUSED"],
    [2, "CLOSE ONE"],
    [1, "CLUTCH!"],
  ] as const)("uses the actual natural-defuse timer %i for %s", (remainingTurns, text) => {
    const events: GameEvent[] = [
      ...lines(1),
      { type: "pieceDefused", pieceId: "timed", bonus: 50, remainingTurns },
    ];
    expect(resolvePraiseForTurn(events, identity)).toMatchObject({
      tier: 3,
      text,
      reason: "naturalDefuse",
    });
  });

  it("uses DOUBLE DEFUSE for two genuine defuse events", () => {
    const events: GameEvent[] = [
      ...lines(1),
      { type: "pieceDefused", pieceId: "a", bonus: 50, remainingTurns: 3 },
      { type: "pieceDefused", pieceId: "b", bonus: 50, remainingTurns: 1 },
    ];
    expect(resolvePraiseForTurn(events, identity)).toMatchObject({
      tier: 3,
      text: "DOUBLE DEFUSE",
    });
  });

  it("never calls an ordinary clear DEFUSED and ignores non-outcomes", () => {
    expect(resolvePraiseForTurn(lines(1), identity)?.text).not.toContain("DEFUSE");
    expect(
      resolvePraiseForTurn([{ type: "scoreChanged", delta: 4, score: 4 }], identity),
    ).toBeNull();
    expect(resolvePraiseForTurn([], identity)).toBeNull();
  });

  it("alternates tier-one copy without touching events or gameplay RNG", () => {
    const events = lines(1);
    const snapshot = JSON.stringify(events);
    const first = resolvePraiseForTurn(events, { sessionId: 2, turn: 1 });
    const second = resolvePraiseForTurn(events, { sessionId: 2, turn: 2 });
    expect([first?.text, second?.text]).toEqual(["NICE", "CLEAR"]);
    expect(JSON.stringify(events)).toBe(snapshot);
  });
});

describe("one-slot praise lifecycle", () => {
  const tier1 = resolvePraiseForTurn(lines(1), { sessionId: 1, turn: 1 });
  const tier2 = resolvePraiseForTurn(lines(2), { sessionId: 1, turn: 2 });

  it("keeps one active phrase and lets higher/newer praise replace it", () => {
    let state = createPraiseState(1);
    state = admitPraise(state, tier1);
    state = admitPraise(state, tier2);
    expect(state.active).toEqual(tier2);
  });

  it("lets a higher tier replace within the same turn identity", () => {
    const sameTurnHigh = resolvePraiseForTurn(
      [...lines(1), { type: "pieceDefused", pieceId: "saved", bonus: 55, remainingTurns: 3 }],
      { sessionId: 1, turn: 1 },
    );
    const state = admitPraise(admitPraise(createPraiseState(1), tier1), sameTurnHigh);
    expect(state.active).toEqual(sameTurnHigh);
  });

  it("does not let lower-tier praise replace a live higher tier", () => {
    let state = admitPraise(createPraiseState(1), tier2);
    const newerLow = resolvePraiseForTurn(lines(1), { sessionId: 1, turn: 3 });
    state = admitPraise(state, newerLow);
    expect(state.active).toEqual(tier2);
  });

  it("ignores stale completion after a rapid replacement", () => {
    let state = admitPraise(createPraiseState(1), tier1);
    state = admitPraise(state, tier2);
    state = completePraise(state, tier1?.id ?? "missing");
    expect(state.active).toEqual(tier2);
    state = completePraise(state, tier2?.id ?? "missing");
    expect(state.active).toBeNull();
  });

  it("clears on restart and rejects stale-session events", () => {
    const state = resetPraiseSession(admitPraise(createPraiseState(1), tier1));
    expect(state).toEqual({ sessionId: 2, active: null });
    expect(admitPraise(state, tier2)).toBe(state);
  });

  it("does not treat rewarded defuse as natural-defuse praise", () => {
    expect(
      resolvePraiseForTurn([{ type: "defuseActivated", pieceId: "rewarded" }], identity),
    ).toBeNull();
  });
});
