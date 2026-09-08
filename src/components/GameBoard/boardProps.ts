import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import type { CellPosition } from "../../domain/placement";
import type { PlacementPreview, TimerBadgePlacement } from "../../domain/selectors";

/** The board renderer contract.
 *
 *  Both renderers accept exactly this, so the game screen feeds them from one
 *  place and neither can drift onto a private data path. That matters more than
 *  it looks: two renderers reading subtly different state is how a feature flag
 *  stops being a safety net and becomes two codebases, and the whole reason the
 *  cinematic renderer ships behind a flag is that the fallback has to stay
 *  trustworthy.
 *
 *  The cinematic renderer ignores three of these — `placedCells`,
 *  `placementNonce`, `explosionCount` and `effectKey` drive React Native
 *  `Animated` beats that have no equivalent in a canvas, where the same feedback
 *  is driven by shared values instead. They stay in the shared type rather than
 *  being split out, because the screen must be able to hand either renderer the
 *  same object without knowing which one it got. */
export type GameBoardProps = {
  grid: readonly (readonly DomainGridCell[])[];
  badges: readonly TimerBadgePlacement[];
  /** Optional fixed content size (mostly for tests); defaults to measuring. */
  boardSize?: number;
  preview?: PlacementPreview | null;
  onCellPress?: (position: CellPosition) => void;
  /** Reports the currently pressed logical anchor. Null means the press ended
   *  or was cancelled. This is presentation-only; placement remains on press. */
  onCellPreviewChange?: (position: CellPosition | null) => void;
  /** Reports the computed cell edge length whenever it changes, so the screen
   *  can map finger coordinates to board cells during a drag. */
  onCellSizeChange?: (cellSize: number) => void;
  /** Cells of the most recently placed piece, flashed with a settle "snap". */
  placedCells?: readonly CellPosition[];
  /** Bumped each placement so the snap replays even on the same cells. */
  placementNonce?: number;
  /** Number of explosions in the turn currently being animated, paired with
   *  `effectKey` to retrigger the board's single shake. */
  explosionCount?: number;
  /** Identity of the effect sequence currently playing, so a repeated
   *  explosion retriggers the board shake instead of being treated as the same
   *  animation. A string since effects became individually identified — see
   *  `src/ui/effects/effectQueue.ts`. */
  effectKey?: string | null;
  /** Timed piece to ring as the rewarded-defuse target; its cells get a solid
   *  accent highlight while the confirm card is open. */
  highlightPieceId?: string | null;
  /** Effective reduced-motion (OS combined with the persisted override). When
   *  omitted, falls back to the OS setting alone. */
  reducedMotion?: boolean;
  /** True while the run's rewarded freeze is active — pauses the countdown and
   *  puts every timer badge into its frozen (icy, static) cue. */
  frozen?: boolean;
  /** Every live effect, bottom-first. Only the cinematic renderer reads it: that
   *  renderer draws effects INSIDE its canvas, while the React Native renderer
   *  has them as a sibling overlay the screen mounts itself.
   *
   *  A list rather than a single plan because the queue holds up to six and all
   *  of them must draw. Passing one collapsed `plan` is what made every effect
   *  after the highest-priority one invisible. */
  effectSequences?: readonly import("../../ui/effects/effectQueue").EffectSequence[];
  /** Called by the renderer when it begins drawing the current effect, so the
   *  effect queue can start that effect's clock from the moment it is actually
   *  on screen rather than from when it was queued. */
  onEffectStarted?: (id: string, now: number) => void;
  /** Per-empty-cell anchor validity for the currently selected piece, keyed
   *  "row,column", from the domain's placement preview. Null/absent when no
   *  piece is selected. Drives each empty cell's placement hint for assistive
   *  tech — read-only presentation data, never a gameplay input. */
  placementHints?: ReadonlyMap<string, "valid" | "invalid"> | null;
};
