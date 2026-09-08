import type { GameState } from "../domain/gameTypes";

export type DangerLevel = "calm" | "safe" | "watch" | "caution" | "warning" | "critical";
export type DangerTone = "default" | "cool" | "neutral" | "warm" | "warning" | "critical";

export type DangerState = {
  level: DangerLevel;
  lowestTimer: number | null;
  intensity: number;
  /** Full breathing/pulse cycle. Null means no ambient animation. */
  pulseDurationMs: number | null;
  tone: DangerTone;
};

export const CALM_DANGER_STATE: DangerState = {
  level: "calm",
  lowestTimer: null,
  intensity: 0,
  pulseDurationMs: null,
  tone: "default",
};

/** Pure presentation selector. It reads only the authoritative active timer
 * records and never emits events, mutates state, or touches gameplay RNG. */
export function resolveDangerState(state: Pick<GameState, "activeTimers">): DangerState {
  const timers = Object.values(state.activeTimers);
  if (timers.length === 0) {
    return CALM_DANGER_STATE;
  }
  const lowestTimer = timers.reduce(
    (lowest, timer) => Math.min(lowest, timer.remainingTurns),
    Number.POSITIVE_INFINITY,
  );
  if (lowestTimer <= 1) {
    return {
      level: "critical",
      lowestTimer,
      intensity: 0.55,
      pulseDurationMs: 500,
      tone: "critical",
    };
  }
  if (lowestTimer === 2) {
    return {
      level: "warning",
      lowestTimer,
      intensity: 0.32,
      pulseDurationMs: 800,
      tone: "warning",
    };
  }
  if (lowestTimer === 3) {
    return {
      level: "caution",
      lowestTimer,
      intensity: 0.16,
      pulseDurationMs: 1200,
      tone: "warm",
    };
  }
  if (lowestTimer === 4) {
    return {
      level: "watch",
      lowestTimer,
      intensity: 0.1,
      pulseDurationMs: 1600,
      tone: "neutral",
    };
  }
  return {
    level: "safe",
    lowestTimer,
    intensity: 0.08,
    pulseDurationMs: 2000,
    tone: "cool",
  };
}
