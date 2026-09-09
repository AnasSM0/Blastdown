import { render } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { GameBoard } from "../../src/components/GameBoard";
import type { GridCell } from "../../src/domain/gameTypes";
import { boardDrawCommands } from "../../src/rendering/cinematic/boardPicture";
import { sceneGeometry } from "../../src/rendering/cinematic/geometry";
import { cinematicPalette } from "../../src/rendering/cinematic/palette";
import { BOARD_CONTENT_INSET, FRAME_WIDTH } from "../../src/ui/boardGeometry";
import { boardCornerAccentRects } from "../../src/ui/boardChrome";
import { spacing } from "../../src/ui/theme";
import { resolveTheme } from "../../src/ui/themes";

type Rect = { x: number; y: number; width: number; height: number };

const BOARD_SIDE = 328;

function emptyGrid(): GridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function playableRect(): Rect {
  return {
    x: BOARD_CONTENT_INSET,
    y: BOARD_CONTENT_INSET,
    width: BOARD_SIDE - 2 * BOARD_CONTENT_INSET,
    height: BOARD_SIDE - 2 * BOARD_CONTENT_INSET,
  };
}

function rectFromStyle(style: ViewStyle): Rect {
  const width = style.width as number;
  const height = style.height as number;
  const x =
    typeof style.left === "number" ? style.left : BOARD_SIDE - (style.right as number) - width;
  const y =
    typeof style.top === "number" ? style.top : BOARD_SIDE - (style.bottom as number) - height;
  return { x, y, width, height };
}

describe("board chrome clear-lane safety", () => {
  it("keeps the board chrome and measurement contract intact", async () => {
    const view = await render(<GameBoard grid={emptyGrid()} badges={[]} boardSize={BOARD_SIDE} />);
    const board = StyleSheet.flatten(view.getByTestId("game-board").props.style) as ViewStyle;
    const geometry = sceneGeometry(BOARD_SIDE, 8);

    expect(view.getByTestId("board-frame-inner")).toBeTruthy();
    expect(view.getByTestId("board-frame-corners")).toBeTruthy();
    expect(board).toMatchObject({
      width: "100%",
      maxWidth: 420,
      aspectRatio: 1,
      borderWidth: FRAME_WIDTH,
      padding: spacing.gridGutter,
    });
    expect(geometry).toMatchObject({
      boardSide: BOARD_SIDE,
      frameWidth: FRAME_WIDTH,
      contentInset: BOARD_CONTENT_INSET,
    });
  });

  it("keeps fallback corner accents out of every edge clear lane", async () => {
    const view = await render(<GameBoard grid={emptyGrid()} badges={[]} boardSize={BOARD_SIDE} />);
    const cornerLayer = view.getByTestId("board-frame-corners");
    const corners = cornerLayer.children.map((child) =>
      rectFromStyle(
        StyleSheet.flatten((child as unknown as { props: { style: ViewStyle } }).props.style),
      ),
    );

    expect(corners).toHaveLength(8);
    expect(corners).toEqual(boardCornerAccentRects(BOARD_SIDE));
    expect(corners.every((corner) => !overlaps(corner, playableRect()))).toBe(true);
  });

  it("keeps cinematic corner accents out of every edge clear lane", () => {
    const geometry = sceneGeometry(BOARD_SIDE, 8);
    const commands = boardDrawCommands(geometry, cinematicPalette(resolveTheme(undefined)));
    const corners = commands.slice(-8).map((command) => {
      expect(command.op).toBe("rect");
      return "rect" in command ? command.rect : { x: 0, y: 0, width: 0, height: 0 };
    });

    expect(corners).toHaveLength(8);
    expect(corners).toEqual(boardCornerAccentRects(BOARD_SIDE));
    expect(corners.every((corner) => !overlaps(corner, playableRect()))).toBe(true);
  });
});
