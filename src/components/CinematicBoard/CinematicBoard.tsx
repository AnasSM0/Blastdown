import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { useFont } from "@shopify/react-native-skia";
import { forwardRef, memo, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Easing, cancelAnimation, useSharedValue, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { CinematicBoardCanvas } from "../../rendering/cinematic/CinematicBoardCanvas";
import { buildEffectScene } from "../../rendering/cinematic/effects/effectScene";
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
    effectPlan,
    effectKey,
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

  const effects = useMemo(
    () =>
      effectPlan
        ? buildEffectScene(effectPlan, scene.geometry, scene.palette, reducedMotion)
        : null,
    [effectPlan, scene.geometry, scene.palette, reducedMotion],
  );

  // One clock for the whole sequence. Every effect primitive reads it and
  // derives its own progress from its own delay and duration, so a turn that
  // plays ninety primitives still runs one animation rather than ninety - and no
  // React render happens while it plays.
  const elapsed = useSharedValue(0);

  useEffect(() => {
    if (!effects || effects.durationMs <= 0) {
      elapsed.value = 0;
      return;
    }
    elapsed.value = 0;
    elapsed.value = withTiming(effects.durationMs, {
      duration: effects.durationMs,
      // Linear, because this value IS elapsed time. Easing it would make every
      // delay in the sequence land at the wrong moment.
      easing: Easing.linear,
    });
    // Stopping the clock on unmount matters more than it looks: a sequence
    // outliving its board would keep the UI thread animating a value nothing
    // reads, and this board unmounts on restart, Home and game over - three of
    // the moments most likely to happen mid-effect.
    return () => cancelAnimation(elapsed);
  }, [effectKey, effects, elapsed]);

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
          effects={effects}
          elapsed={elapsed}
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

      {/* Timer badges. The ring and numeral are drawn on the canvas; this is the
          accessibility node behind them, carrying the same label, hint and
          testID the React Native `TimerBadge` exposes. Without it a screen
          reader loses every countdown announcement — the badges are not
          placement controls, so the cell overlay above does not cover them.
          Found by the CIN-A audit, which is exactly the kind of silent
          regression a build machine with no phone cannot see. */}
      {cellSize > 0
        ? scene.numerals.map((numeral) => (
            <View
              key={numeral.pieceId}
              pointerEvents="none"
              testID={`timer-badge-${numeral.pieceId}`}
              accessible
              accessibilityLabel={`${numeral.value} moves left${frozen ? ", frozen" : ""}`}
              accessibilityHint={`Timer state: ${frozen ? "frozen" : numeral.state}`}
              style={[
                styles.badge,
                {
                  left: numeral.rect.x,
                  top: numeral.rect.y,
                  width: numeral.rect.width,
                  height: numeral.rect.height,
                },
              ]}
            >
              {/* Numeral fallback, mounted only while the Skia font has not
                  loaded. If it never loads the countdown stays readable: a ring
                  with no digit inside it would show a timer's state while
                  hiding the timer. */}
              {font ? null : (
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  testID={`timer-numeral-fallback-${numeral.pieceId}`}
                  style={[styles.numeralText, { color: numeral.visual.numeralColor }]}
                >
                  {numeral.value}
                </Text>
              )}
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
  badge: {
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
