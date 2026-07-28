import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";
import type { TimerBadgePlacement } from "../../src/domain/selectors";
import { buildBoardScene } from "../../src/rendering/cinematic/scene";
import type { BoardSceneInput } from "../../src/rendering/cinematic/types";
import { blockSurface } from "../../src/ui/blockSurface";
import { blockColor, resolveTheme, THEMES } from "../../src/ui/themes";

/** The scene adapter is where "what should the board look like" lives, and it is
 *  pure — so this suite is the renderer's real test surface. Skia draws nothing
 *  under jest (see `test-utils/skiaMock.tsx`), which is exactly why no logic was
 *  put inside the canvas: everything worth asserting is asserted here. */

const BOARD_SIDE = 328;
const theme = resolveTheme(undefined);

function emptyGrid(): DomainGridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): DomainGridCell => ({ kind: "empty" })),
  );
}

function sceneInput(overrides: Partial<BoardSceneInput> = {}): BoardSceneInput {
  return {
    grid: emptyGrid(),
    badges: [],
    preview: null,
    theme,
    boardSide: BOARD_SIDE,
    highlightPieceId: null,
    frozen: false,
    reducedMotion: false,
    ...overrides,
  };
}

describe("the scene describes every cell of the board", () => {
  it("emits one entry per cell and never two for the same cell", () => {
    const grid = emptyGrid();
    grid[0][0] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
    grid[0][1] = { kind: "normal", colorId: "amber" };
    grid[7][7] = { kind: "rubble", explosionId: "e1" };

    const scene = buildBoardScene(sceneInput({ grid }));

    // 64 cells, each described exactly once across the three lists. A cell that
    // appeared twice would be drawn twice, and a cell that appeared in neither
    // would be an invisible hole in the board.
    const keys = [
      ...scene.empties.map((c) => `${c.row},${c.column}`),
      ...scene.blocks.map((c) => `${c.row},${c.column}`),
      ...scene.rubble.map((c) => `${c.row},${c.column}`),
    ];
    expect(keys).toHaveLength(64);
    expect(new Set(keys).size).toBe(64);
    expect(scene.blocks).toHaveLength(2);
    expect(scene.rubble).toHaveLength(1);
    expect(scene.empties).toHaveLength(61);
  });

  it("draws nothing at all before the board has been measured", () => {
    // `cellSize <= 0` is the pre-layout state. Returning an empty scene rather
    // than one full of zero-sized rects keeps the "not ready" case identical in
    // both renderers, and stops the canvas drawing a degenerate frame.
    const scene = buildBoardScene(sceneInput({ boardSide: 0 }));

    expect(scene.geometry.cellSize).toBe(0);
    expect(scene.empties).toHaveLength(0);
    expect(scene.blocks).toHaveLength(0);
    expect(scene.numerals).toHaveLength(0);
  });
});

describe("block material comes from the shared surface helper", () => {
  it("uses the same surface the React Native renderer composes", () => {
    const grid = emptyGrid();
    grid[2][3] = { kind: "normal", colorId: "purple" };

    const scene = buildBoardScene(sceneInput({ grid }));
    const block = scene.blocks[0];

    // Parity by construction rather than by coincidence: both renderers call
    // `blockSurface`, so there is no second definition of the block material
    // that could drift from the first.
    expect(block.accent).toBe(blockColor(theme, "purple"));
    expect(block.surface).toEqual(blockSurface(theme, blockColor(theme, "purple"), "normal"));
  });

  it("promotes a block to the critical material when its piece is urgent", () => {
    const grid = emptyGrid();
    grid[0][0] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
    grid[0][1] = { kind: "timed", pieceInstanceId: "p2", colorId: "cyan" };
    const badges: TimerBadgePlacement[] = [
      { pieceId: "p1", position: { row: 0, column: 0 }, remainingTurns: 1, colorId: "cyan" },
      { pieceId: "p2", position: { row: 0, column: 1 }, remainingTurns: 5, colorId: "cyan" },
    ];

    const scene = buildBoardScene(sceneInput({ grid, badges }));
    const accent = blockColor(theme, "cyan");

    // Urgency is a property of the PIECE, so it must reach the cell through the
    // badge data rather than being re-derived per cell — and the calm piece next
    // to it must not be dragged along.
    expect(scene.blocks[0].surface).toEqual(blockSurface(theme, accent, "critical"));
    expect(scene.blocks[1].surface).toEqual(blockSurface(theme, accent, "normal"));
  });

  it("traces a timed piece's outer boundary and leaves its interior seams open", () => {
    const grid = emptyGrid();
    // A horizontal domino: the shared edge between them is interior.
    grid[3][3] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
    grid[3][4] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };

    const scene = buildBoardScene(sceneInput({ grid }));
    const left = scene.blocks.find((b) => b.column === 3)!;
    const right = scene.blocks.find((b) => b.column === 4)!;

    // CONTOUR_RIGHT = 2 on the left cell and CONTOUR_LEFT = 8 on the right cell
    // are the shared seam; neither may be set, or the piece reads as two blocks.
    expect(left.contourMask! & 2).toBe(0);
    expect(right.contourMask! & 8).toBe(0);
    // Every outward side is set on both.
    expect(left.contourMask! & 1).toBeGreaterThan(0);
    expect(right.contourMask! & 2).toBeGreaterThan(0);
  });

  it("gives an untimed block no contour, because it has no piece silhouette", () => {
    const grid = emptyGrid();
    grid[1][1] = { kind: "normal", colorId: "amber" };

    expect(buildBoardScene(sceneInput({ grid })).blocks[0].contourMask).toBeUndefined();
  });

  it("rings only the rewarded-defuse target piece", () => {
    const grid = emptyGrid();
    grid[0][0] = { kind: "timed", pieceInstanceId: "target", colorId: "cyan" };
    grid[0][2] = { kind: "timed", pieceInstanceId: "other", colorId: "cyan" };

    const scene = buildBoardScene(sceneInput({ grid, highlightPieceId: "target" }));

    expect(scene.blocks.find((b) => b.column === 0)!.highlighted).toBe(true);
    expect(scene.blocks.find((b) => b.column === 2)!.highlighted).toBe(false);
  });
});

describe("the placement preview", () => {
  it("marks a conflicting cell as a conflict even though it is also a ghost cell", () => {
    // The domain reports a conflicting cell in BOTH lists. Applying conflicts
    // last is what makes the stronger treatment win; the reverse order would
    // silently downgrade an overlap to an ordinary invalid ghost.
    const scene = buildBoardScene(
      sceneInput({
        preview: {
          valid: false,
          cells: [
            { row: 1, column: 1 },
            { row: 1, column: 2 },
          ],
          conflictCells: [{ row: 1, column: 2 }],
        },
      }),
    );

    expect(scene.preview).toHaveLength(2);
    expect(scene.preview.find((p) => p.column === 1)!.state).toBe("invalid");
    expect(scene.preview.find((p) => p.column === 2)!.state).toBe("conflict");
  });

  it("gives an unplaceable ghost a dashed edge, not just a different colour", () => {
    const invalid = buildBoardScene(
      sceneInput({
        preview: { valid: false, cells: [{ row: 0, column: 0 }], conflictCells: [] },
      }),
    ).preview[0];
    const valid = buildBoardScene(
      sceneInput({
        preview: { valid: true, cells: [{ row: 0, column: 0 }], conflictCells: [] },
      }),
    ).preview[0];

    // `docs/GAME_RULES.md` forbids signalling state by colour alone. The dash is
    // that second channel, and it is the half a colour-blind player relies on.
    expect(invalid.surface.dashed).toBe(true);
    expect(valid.surface.dashed).toBe(false);
  });
});

describe("timer numerals", () => {
  const badges: TimerBadgePlacement[] = [
    { pieceId: "p1", position: { row: 2, column: 2 }, remainingTurns: 1, colorId: "cyan" },
  ];

  it("always carries the number itself, never only a colour", () => {
    const scene = buildBoardScene(sceneInput({ badges }));

    expect(scene.numerals[0].value).toBe(1);
    expect(scene.numerals[0].state).toBe("urgent");
  });

  it("uses the frozen cue for every badge while the run's freeze is active", () => {
    const frozen = buildBoardScene(sceneInput({ badges, frozen: true })).numerals[0];
    const running = buildBoardScene(sceneInput({ badges, frozen: false })).numerals[0];

    // Frozen overrides urgency: a paused timer must not also read as counting
    // down. The dashed ring is the non-colour half of that cue.
    expect(frozen.visual.dashed).toBe(true);
    expect(frozen.visual.ringColor).toBe(theme.timerFrozen);
    expect(running.visual.dashed).toBe(false);
  });

  it("grows the urgent badge, so the danger state differs by size and not only hue", () => {
    const urgent = buildBoardScene(sceneInput({ badges })).numerals[0];
    const calm = buildBoardScene(
      sceneInput({
        badges: [{ ...badges[0], remainingTurns: 6 }],
      }),
    ).numerals[0];

    expect(urgent.rect.width).toBeGreaterThan(calm.rect.width);
  });
});

describe("the scene carries reduced motion, because it changes what is drawn", () => {
  it("reports the effective value it was given", () => {
    expect(buildBoardScene(sceneInput({ reducedMotion: true })).reducedMotion).toBe(true);
    expect(buildBoardScene(sceneInput({ reducedMotion: false })).reducedMotion).toBe(false);
  });
});

describe("every theme produces a complete palette", () => {
  it.each(THEMES.map((t) => [t.name, t] as const))("%s", (_name, palette) => {
    const scene = buildBoardScene(sceneInput({ theme: palette }));

    // A theme added later must not be able to leave a canvas colour undefined —
    // Skia would draw it as transparent black, which on a dark board is an
    // invisible failure rather than a loud one.
    for (const [key, value] of Object.entries(scene.palette)) {
      if (key === "glow") {
        expect(typeof value).toBe("number");
      } else {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6,8}$/);
      }
    }
  });
});
