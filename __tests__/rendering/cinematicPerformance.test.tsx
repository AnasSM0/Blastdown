import { render } from "@testing-library/react-native";

import { CinematicBoard } from "../../src/components/CinematicBoard";
import type { GameBoardProps } from "../../src/components/GameBoard/boardProps";
import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";
import { sceneGeometry } from "../../src/rendering/cinematic/geometry";
import { cinematicPalette } from "../../src/rendering/cinematic/palette";
import { boardDrawCommands } from "../../src/rendering/cinematic/boardPicture";
import { buildEffectScene } from "../../src/rendering/cinematic/effects/effectScene";
import { buildBoardScene } from "../../src/rendering/cinematic/scene";
import { MAX_BURST_CELLS } from "../../src/ui/effects/eventEffects";
import { resolveTheme } from "../../src/ui/themes";

/** Performance properties, asserted as properties rather than measured.
 *
 *  No frame rate is claimed here. This machine has no device, and a timing
 *  assertion under jest would measure jest. What CAN be pinned is the structure
 *  the performance argument rests on — the things that, if they silently
 *  regressed, would make the renderer slow in a way no test would notice and a
 *  code review would have to catch by eye.
 *
 *  Each test below corresponds to one line of that argument. */

const BOARD_SIDE = 328;
const theme = resolveTheme(undefined);

function grid(): DomainGridCell[][] {
  const cells = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): DomainGridCell => ({ kind: "empty" })),
  );
  cells[0][0] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
  return cells;
}

describe("the static board really is static", () => {
  it("produces an identical command list when only occupancy changes", () => {
    // The cached picture holds the frame, the grid and the empty cells. If a
    // placement changed any of them the picture would be re-baked every turn,
    // and the single biggest win in the renderer would silently evaporate.
    const geometry = sceneGeometry(BOARD_SIDE, 8);
    const palette = cinematicPalette(theme);

    const before = boardDrawCommands(geometry, palette);
    const after = boardDrawCommands(geometry, palette);

    expect(after).toEqual(before);
  });

  it("bakes enough draw calls to be worth caching", () => {
    // ~200 commands: the frame and recess, 8+8 grid hairlines, 64 cells with
    // their borders, the scanlines and the corner brackets. If this collapsed to
    // a handful, something stopped being drawn.
    const commands = boardDrawCommands(sceneGeometry(BOARD_SIDE, 8), cinematicPalette(theme));

    expect(commands.length).toBeGreaterThan(150);
  });

  it("draws nothing before layout, rather than a degenerate frame", () => {
    expect(boardDrawCommands(sceneGeometry(0, 8), cinematicPalette(theme))).toEqual([]);
  });
});

describe("geometry and palette are stable across turns", () => {
  it("keeps their identity when the board changes but its size and theme do not", () => {
    // This is the property the cached picture's `useMemo` depends on. It is a
    // test about IDENTITY, not equality: `toEqual` would pass on two freshly
    // built objects and the cache would still miss on every turn.
    const geometry = sceneGeometry(BOARD_SIDE, 8);
    const palette = cinematicPalette(theme);

    const first = buildBoardScene({
      grid: grid(),
      badges: [],
      preview: null,
      theme,
      geometry,
      palette,
      highlightPieceId: null,
      frozen: false,
      reducedMotion: false,
    });
    const second = buildBoardScene({
      grid: grid(),
      badges: [],
      preview: null,
      theme,
      geometry,
      palette,
      highlightPieceId: null,
      frozen: false,
      reducedMotion: false,
    });

    expect(second.geometry).toBe(first.geometry);
    expect(second.palette).toBe(first.palette);
  });

  it("takes geometry and palette from the caller, so the component owns the memo", () => {
    // Regression guard for a bug that shipped in the first draft: the scene
    // built its own geometry and palette, so every turn minted fresh objects,
    // the picture cache missed every time, and the static board was re-baked on
    // every single placement. Requiring them as inputs makes that impossible.
    const geometry = sceneGeometry(BOARD_SIDE, 8);
    const palette = cinematicPalette(theme);

    const scene = buildBoardScene({
      grid: grid(),
      badges: [],
      preview: null,
      theme,
      geometry,
      palette,
      highlightPieceId: null,
      frozen: false,
      reducedMotion: false,
    });

    expect(scene.geometry).toBe(geometry);
    expect(scene.palette).toBe(palette);
  });
});

describe("the board holds no per-frame React state", () => {
  it("renders without any Animated.Value or animated style on the wrapper", async () => {
    // The whole point of the canvas is that motion never travels through React.
    // If the wrapper ever gained an animated transform it would also re-acquire
    // the Fabric prop-shape hazard the React Native renderer has to guard
    // against — see src/ui/motionKey.ts.
    const props: GameBoardProps = {
      grid: grid(),
      badges: [],
      boardSize: BOARD_SIDE,
      onCellPress: () => {},
      reducedMotion: false,
    };

    const view = await render(<CinematicBoard {...props} />);

    const board = view.getByTestId("game-board");
    const style = Array.isArray(board.props.style) ? board.props.style : [board.props.style];
    for (const entry of style) {
      expect(entry?.transform).toBeUndefined();
    }
    await view.unmount();
  });
});

describe("effect work is bounded before it reaches the canvas", () => {
  it("caps the number of child components a turn can mount", async () => {
    // Covered in detail by cinematicEffects.test.ts; asserted here as the
    // performance claim it supports. The canvas mounts one child per primitive,
    // so an uncapped plan would mean an uncapped component count on exactly the
    // frame the app is trying hardest to stay smooth.
    const scene = buildEffectScene(
      {
        rows: [],
        columns: [],
        clearedCells: [],
        defuses: [],
        explosions: Array.from({ length: 6 }, (_, index) => ({
          explosionId: `e${index}`,
          pieceId: `p${index}`,
          cells: Array.from({ length: 12 }, (_, column) => ({ row: index, column })),
        })),
        rubbleCells: [],
        reviveCells: [],
        scoreDelta: 0,
        score: 0,
        combo: null,
        comboReset: false,
        cue: null,
        hasRequiredSequence: true,
        durationMs: 780,
      },
      sceneGeometry(BOARD_SIDE, 8),
      cinematicPalette(theme),
      false,
    );

    expect(scene.bursts.length).toBe(MAX_BURST_CELLS);
  });
});
