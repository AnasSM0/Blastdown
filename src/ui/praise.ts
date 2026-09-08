import type { GameEvent } from "../domain/events";

export type PraiseTier = 1 | 2 | 3 | 4;
export type PraiseReason =
  "singleClear" | "multiClear" | "naturalDefuse" | "multipleNaturalDefuses";

export type PraiseIdentity = { sessionId: number; turn: number };

export type PraiseResult = PraiseIdentity & {
  id: string;
  tier: PraiseTier;
  text: string;
  reason: PraiseReason;
};

export type PraiseState = {
  sessionId: number;
  active: PraiseResult | null;
};

function result(
  identity: PraiseIdentity,
  tier: PraiseTier,
  text: string,
  reason: PraiseReason,
): PraiseResult {
  return {
    ...identity,
    id: `praise:${identity.sessionId}:${identity.turn}:${reason}:${text}`,
    tier,
    text,
    reason,
  };
}

/** Resolve one presentation phrase from a committed turn's domain events.
 * This is deliberately ignorant of GameState, prediction and renderer state. */
export function resolvePraiseForTurn(
  events: readonly GameEvent[],
  identity: PraiseIdentity,
): PraiseResult | null {
  const defuses = events.filter(
    (event): event is Extract<GameEvent, { type: "pieceDefused" }> => event.type === "pieceDefused",
  );
  if (defuses.length >= 2) {
    return result(identity, 3, "DOUBLE DEFUSE", "multipleNaturalDefuses");
  }
  if (defuses.length === 1) {
    const remaining = defuses[0].remainingTurns;
    if (remaining >= 3) {
      return result(identity, 3, "DEFUSED", "naturalDefuse");
    }
    if (remaining === 2) {
      return result(identity, 3, "CLOSE ONE", "naturalDefuse");
    }
    if (remaining === 1) {
      return result(identity, 3, "CLUTCH!", "naturalDefuse");
    }
  }

  const lineCount = events.reduce(
    (count, event) =>
      event.type === "linesCleared" ? count + event.rows.length + event.columns.length : count,
    0,
  );
  if (lineCount <= 0) {
    return null;
  }
  if (lineCount === 1) {
    // Presentation-only deterministic alternation; gameplay RNG is never read.
    const text = (identity.sessionId + identity.turn) % 2 === 1 ? "NICE" : "CLEAR";
    return result(identity, 1, text, "singleClear");
  }
  if (lineCount === 2) {
    return result(identity, 2, "DOUBLE", "multiClear");
  }
  if (lineCount === 3) {
    return result(identity, 2, "TRIPLE BLAST", "multiClear");
  }
  return result(identity, 2, "OVERLOAD", "multiClear");
}

export function createPraiseState(sessionId = 1): PraiseState {
  return { sessionId, active: null };
}

/** Admit at most one phrase. A live higher tier suppresses lower-tier noise;
 * equal or higher praise from a newer turn replaces cleanly. */
export function admitPraise(state: PraiseState, praise: PraiseResult | null): PraiseState {
  if (
    praise === null ||
    praise.sessionId !== state.sessionId ||
    (state.active !== null &&
      (praise.turn < state.active.turn ||
        (praise.turn === state.active.turn && praise.tier <= state.active.tier) ||
        praise.tier < state.active.tier))
  ) {
    return state;
  }
  return { ...state, active: praise };
}

export function completePraise(state: PraiseState, id: string): PraiseState {
  return state.active?.id === id ? { ...state, active: null } : state;
}

export function resetPraiseSession(state: PraiseState): PraiseState {
  return { sessionId: state.sessionId + 1, active: null };
}
