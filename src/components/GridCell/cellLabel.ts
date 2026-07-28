import type { GridCell as DomainGridCell } from "../../domain/gameTypes";

export type TimerAnnounce = { remainingTurns?: number; critical?: boolean; frozen?: boolean };

/** The spoken description of one board cell.
 *
 *  Extracted from `GridCell` so both renderers can share it. That is not tidying
 *  — it is the reason the cinematic renderer is allowed to exist. A Skia canvas
 *  is a single view to the platform: it has no per-cell accessibility node, so
 *  moving drawing into it would silently delete every board label unless the
 *  labels stayed on real React Native views layered over the canvas. They do,
 *  and they say exactly this, because both renderers call this function.
 *
 *  Everything a sighted player reads from colour or glow is spoken here
 *  instead: the countdown as a number, "frozen" and "urgent" as words. A frozen
 *  piece is not counting down, so it never also announces "urgent". */
export function cellLabel(
  cell: DomainGridCell,
  row: number,
  column: number,
  timer: TimerAnnounce,
): string {
  const place = `row ${row + 1}, column ${column + 1}`;
  switch (cell.kind) {
    case "empty":
      return `Empty cell, ${place}`;
    case "timed": {
      const parts = [`${cell.colorId} block with timer`];
      if (timer.remainingTurns !== undefined) {
        const noun = timer.remainingTurns === 1 ? "move" : "moves";
        parts.push(`${timer.remainingTurns} ${noun} left`);
      }
      if (timer.frozen) {
        parts.push("frozen");
      } else if (timer.critical) {
        parts.push("urgent");
      }
      return `${parts.join(", ")}, ${place}`;
    }
    case "normal":
      return `${cell.colorId} block, ${place}`;
    case "rubble":
      return `Blocked rubble cell, ${place}`;
  }
}

/** The placement hint for an empty cell while a piece is selected.
 *
 *  Mirrors the engine rather than guessing: `placementState` is the domain's own
 *  verdict for the selected piece anchored here, so the hint promises a
 *  placement only where the engine would accept one. With nothing selected it
 *  returns undefined — silence, rather than implying an action a bare tap will
 *  not perform. */
export function placementHintFor(
  cell: DomainGridCell,
  interactive: boolean,
  placementState: "valid" | "invalid" | undefined,
): string | undefined {
  if (!interactive || cell.kind !== "empty" || !placementState) {
    return undefined;
  }
  return placementState === "valid"
    ? "Double tap to place the selected piece here"
    : "The selected piece can't be placed here";
}
