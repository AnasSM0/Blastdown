import type { GridCell, HandPiece } from "../../domain/gameTypes";
import type { CellPosition } from "../../domain/placement";
import type { TimerBadgePlacement } from "../../domain/selectors";

/** A fixed, scripted tutorial step. The board is a crafted illustration (or an
 *  interactive placement for step 1); the messages are the exact copy from
 *  BUILD_SPEC.md §9 and must not be paraphrased. */
export type TutorialStep = {
  id: number;
  /** Verbatim BUILD_SPEC.md §9 message. */
  message: string;
  /** Extra screen-reader detail beyond the short on-screen message. */
  accessibilityHint: string;
  /** The board to display for this step. */
  grid: GridCell[][];
  badges: TimerBadgePlacement[];
  /** Cells to highlight as the focus of this step (nothing else is emphasized). */
  highlightCells: CellPosition[];
  /** When set, the player must place this hand onto the board to proceed
   *  (the one "instructional placement"); otherwise the step is explanatory. */
  interactiveHand?: HandPiece[];
};

const SIZE = 8;

function emptyGrid(): GridCell[][] {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, (): GridCell => ({ kind: "empty" })),
  );
}

function fillRow(grid: GridCell[][], row: number, columns: number[], colorId: string): void {
  for (const column of columns) {
    grid[row][column] = { kind: "normal", colorId };
  }
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let value = from; value <= to; value++) {
    out.push(value);
  }
  return out;
}

/** Step 1 — interactive: the board is empty and the player places one block. */
function step1(): TutorialStep {
  return {
    id: 1,
    message: "Drag a block onto the board.",
    accessibilityHint:
      "Select the piece in the tray, then tap an empty cell to place it. This is the only step that requires an action.",
    grid: emptyGrid(),
    badges: [],
    highlightCells: [],
    interactiveHand: [{ handId: "tut-1", shapeId: "single", colorId: "cyan" }],
  };
}

/** Step 2 — a row one cell from clearing. */
function step2(): TutorialStep {
  const grid = emptyGrid();
  fillRow(grid, 3, range(0, 6), "amber");
  return {
    id: 2,
    message: "Complete a row or column to clear it.",
    accessibilityHint: "Row four is filled except the last cell. Filling it clears the whole row.",
    grid,
    badges: [],
    highlightCells: [{ row: 3, column: 7 }],
  };
}

/** Step 3 — one timed piece with its single shared countdown badge. */
function step3(): TutorialStep {
  const grid = emptyGrid();
  grid[2][2] = { kind: "timed", colorId: "purple", pieceInstanceId: "tut-timed" };
  grid[2][3] = { kind: "timed", colorId: "purple", pieceInstanceId: "tut-timed" };
  grid[3][2] = { kind: "timed", colorId: "purple", pieceInstanceId: "tut-timed" };
  return {
    id: 3,
    message: "Every placed piece has a countdown.",
    accessibilityHint:
      "A connected piece shows one shared countdown badge, not one per cell. Here it reads five moves.",
    grid,
    badges: [
      {
        pieceId: "tut-timed",
        position: { row: 2, column: 2 },
        remainingTurns: 5,
        colorId: "purple",
      },
    ],
    highlightCells: [
      { row: 2, column: 2 },
      { row: 2, column: 3 },
      { row: 3, column: 2 },
    ],
  };
}

/** Step 4 — a piece at one move, in a nearly complete row that can save it. */
function step4(): TutorialStep {
  const grid = emptyGrid();
  fillRow(grid, 5, range(0, 5), "cyan");
  grid[5][6] = { kind: "timed", colorId: "amber", pieceInstanceId: "tut-urgent" };
  return {
    id: 4,
    message: "Clear every cell before the timer reaches zero.",
    accessibilityHint:
      "This piece has one move left. Completing its row clears it and defuses the countdown safely.",
    grid,
    badges: [
      {
        pieceId: "tut-urgent",
        position: { row: 5, column: 6 },
        remainingTurns: 1,
        colorId: "amber",
      },
    ],
    highlightCells: [{ row: 5, column: 7 }],
  };
}

/** Step 5 — rubble left behind by an expired piece. */
function step5(): TutorialStep {
  const grid = emptyGrid();
  grid[4][3] = { kind: "rubble", explosionId: "tut-boom" };
  grid[4][4] = { kind: "rubble", explosionId: "tut-boom" };
  grid[5][4] = { kind: "rubble", explosionId: "tut-boom" };
  return {
    id: 5,
    message: "Expired pieces create rubble.",
    accessibilityHint:
      "When a countdown reaches zero the piece expires and leaves rubble, which blocks placement.",
    grid,
    badges: [],
    highlightCells: [
      { row: 4, column: 3 },
      { row: 4, column: 4 },
      { row: 5, column: 4 },
    ],
  };
}

/** Step 6 — rubble inside a nearly complete row that a line clear repairs. */
function step6(): TutorialStep {
  const grid = emptyGrid();
  fillRow(grid, 1, range(0, 5), "cyan");
  grid[1][6] = { kind: "rubble", explosionId: "tut-fix" };
  return {
    id: 6,
    message: "Complete its row or column to repair the board.",
    accessibilityHint:
      "Clearing a line that contains rubble removes the rubble too, repairing the board.",
    grid,
    badges: [],
    highlightCells: [
      { row: 1, column: 6 },
      { row: 1, column: 7 },
    ],
  };
}

export function tutorialSteps(): TutorialStep[] {
  return [step1(), step2(), step3(), step4(), step5(), step6()];
}

export const TUTORIAL_STEP_COUNT = 6;
