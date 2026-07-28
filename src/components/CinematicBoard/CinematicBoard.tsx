import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { useFont } from "@shopify/react-native-skia";
import { forwardRef, memo, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { CinematicBoardCanvas } from "../../rendering/cinematic/CinematicBoardCanvas";
import { buildBoardScene } from "../../rendering/cinematic/scene";
import { radius } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { getTimerVisualState } from "../../ui/timerStates";
import { cellLabel, placementHintFor } from "../GridCell/cellLabel";
import type { GameBoardProps } from "../GameBoard/boardProps";

/** The cinematic board: one Skia canvas, plus a real React Native layer for
 *  everything a canvas cannot be.
 *
 *  A canvas draws; it does not participate. To the platform it is a single view
 *  with a single accessibility node and a single touch target. Sixty-four
 *  transparent `Pressable`s are therefore laid over it, carrying the same
 *  labels, hints, roles and testIDs the `GridCell` renderer exposes — because
 *  this game's documented accessibility fallback is tap-to-select then
 *  tap-to-place (`docs/GAME_RULES.md`), and `docs/ACCESSIBILITY.md` treats the
 *  per-cell labels and placement hints as shipped behaviour. Deleting them to
 *  gain a nicer-looking board would be a straight regression, and an invisible
 *  one on a build machine.
 *
 *  Those overlay views are not the thing the performance rules were written
 *  against. The rule is "one Canvas, not 64 ANIMATED React Views": these never
 *  animate, hold no `Animated.Value`, bind no transform, and re-render only when
 *  the grid or the selection actually changes. They cost a layout pass on a turn
 *  boundary and nothing per frame.
 *
 *  Props are identical to `GameBoard`'s, so the game screen can swap renderers
 *  without a second data path — see `src/components/GameBoard/boardProps.ts`. */

/** Numeral size, matching the React Native badge's own 13px digits. */
const NUMERAL_SIZE = 13;

function CinematicBoardImpl(
  {
    grid,
    badges,
    boardSize,
    preview,
    onCellPress,
    onCellSizeChange,
    highlightPieceId,
    reducedMotion: reducedMotionProp,
    frozen = false,
    placementHints,
  }: GameBoardProps,
  ref: React.ForwardedRef<View>,
) {
  const theme = useTheme();
  const osReducedMotion = useReducedMotion();
  const reducedMotion = reducedMotionProp ?? osReducedMotion;
  const [measured, setMeasured] = useState(0);
  const boardSide = boardSize ?? measured;

  // Loaded outside the canvas on purpose. Skia loads a font asynchronously and
  // reports null until it arrives; a canvas that drew badge rings with no digits
  // inside them would be showing a timer's STATE while hiding the timer, which
  // `docs/GAME_RULES.md` forbids ("never rely on color alone"). Knowing about it
  // out here is what lets the fallback below exist.
  const font = useFont(JetBrainsMono_700Bold, NUMERAL_SIZE);

  const scene = useMemo(
    () =>
      buildBoardScene({
        grid,
        badges,
        preview,
        theme,
        boardSide,
        highlightPieceId,
        frozen,
        reducedMotion,
      }),
    [grid, badges, preview, theme, boardSide, highlightPieceId, frozen, reducedMotion],
  );

  const { cellSize, pitch, contentInset } = scene.geometry;

  useEffect(() => {
    if (cellSize > 0) {
      onCellSizeChange?.(cellSize);
    }
  }, [cellSize, onCellSizeChange]);

  const handleLayout = (event: LayoutChangeEvent) => {
    if (boardSize === undefined) {
      setMeasured(event.nativeEvent.layout.width);
    }
  };

  // Announced state per timed piece, from the badge data the screen already
  // computed — the same source the drawn numerals use, so what is spoken and
  // what is shown cannot disagree.
  const timerByPiece = useMemo(
    () =>
      new Map(
        badges.map((badge) => [
          badge.pieceId,
          {
            remainingTurns: badge.remainingTurns,
            critical: getTimerVisualState(badge.remainingTurns) === "urgent",
          },
        ]),
      ),
    [badges],
  );

  return (
    <View
      ref={ref}
      style={styles.board}
      onLayout={handleLayout}
      collapsable={false}
      accessibilityLabel="Game board"
      testID="game-board"
    >
      {cellSize > 0 ? (
        <CinematicBoardCanvas
          scene={scene}
          font={font}
          style={{ width: boardSide, height: boardSide }}
        />
      ) : null}

      {/* Accessibility and touch. Transparent, static, and the only part of this
          board the platform can see. */}
      {cellSize > 0
        ? grid.map((rowCells, row) =>
            rowCells.map((cell, column) => {
              const timer =
                cell.kind === "timed" ? timerByPiece.get(cell.pieceInstanceId) : undefined;
              return (
                <Pressable
                  key={`cell-${row}-${column}`}
                  style={[
                    styles.touch,
                    {
                      left: contentInset + column * pitch,
                      top: contentInset + row * pitch,
                      width: cellSize,
                      height: cellSize,
                    },
                  ]}
                  onPress={onCellPress ? () => onCellPress({ row, column }) : undefined}
                  disabled={onCellPress === undefined}
                  testID={`cell-${row}-${column}`}
                  accessibilityLabel={cellLabel(cell, row, column, {
                    remainingTurns: timer?.remainingTurns,
                    critical: timer?.critical,
                    frozen,
                  })}
                  accessibilityRole={onCellPress ? "button" : undefined}
                  accessibilityHint={placementHintFor(
                    cell,
                    onCellPress !== undefined,
                    placementHints?.get(`${row},${column}`),
                  )}
                  accessible
                />
              );
            }),
          )
        : null}

      {/* Numeral fallback. Only mounts while the Skia font has not loaded — and
          if it never loads, the countdown is still readable. A timer that is
          drawn as a ring with no digit is worse than one drawn as plain text. */}
      {cellSize > 0 && !font
        ? scene.numerals.map((numeral) => (
            <View
              key={numeral.pieceId}
              pointerEvents="none"
              testID={`timer-numeral-fallback-${numeral.pieceId}`}
              style={[
                styles.numeralFallback,
                {
                  left: numeral.rect.x,
                  top: numeral.rect.y,
                  width: numeral.rect.width,
                  height: numeral.rect.height,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.numeralText, { color: numeral.visual.numeralColor }]}
              >
                {numeral.value}
              </Text>
            </View>
          ))
        : null}
    </View>
  );
}

export const CinematicBoard = memo(forwardRef<View, GameBoardProps>(CinematicBoardImpl));

const styles = StyleSheet.create({
  board: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    aspectRatio: 1,
    // No border, padding or background: the canvas draws the frame, and a React
    // Native border here would sit on top of it at a slightly different radius.
    borderRadius: radius.board,
  },
  touch: {
    position: "absolute",
    // Deliberately no background. These exist to be pressed and read, not seen.
  },
  numeralFallback: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  numeralText: {
    fontSize: NUMERAL_SIZE,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
