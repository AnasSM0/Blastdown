import { TIMED_COUNTDOWN_TIERS } from "../config/balance";
import type { GridCell } from "./gameTypes";

export function startingCountdownForTurn(turn: number): number {
  const tier = TIMED_COUNTDOWN_TIERS.find((entry) => turn >= entry.minTurn);
  return tier?.countdown ?? TIMED_COUNTDOWN_TIERS[TIMED_COUNTDOWN_TIERS.length - 1].countdown;
}

/** Count how many grid cells still belong to the given timed piece instance. */
export function countSurvivingCells(
  grid: readonly (readonly GridCell[])[],
  pieceInstanceId: string,
): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.kind === "timed" && cell.pieceInstanceId === pieceInstanceId) {
        count += 1;
      }
    }
  }
  return count;
}
