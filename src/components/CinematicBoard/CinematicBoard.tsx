import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { useFont } from "@shopify/react-native-skia";
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { CinematicBoardCanvas } from "../../rendering/cinematic/CinematicBoardCanvas";
import { buildEffectScene } from "../../rendering/cinematic/effects/effectScene";
import { sceneGeometry } from "../../rendering/cinematic/geometry";
import { cinematicPalette } from "../../rendering/cinematic/palette";
import { buildBoardScene, buildPreviewCells } from "../../rendering/cinematic/scene";
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

/** One transparent touch and accessibility target over the canvas.
 *
 *  Memoized, and taking `onPress` as a position-reporting callback rather than a
 *  bound closure, for the same reason `GridCell` does: the board hands one
 *  stable handler to all sixty-four cells, so a re-render for an unrelated
 *  reason does not give every cell a new prop and re-render all of them. */
const TouchCell = memo(function TouchCell({
  row,
  column,
  left,
  top,
  size,
  label,
  hint,
  onPress,
}: {
  row: number;
  column: number;
  left: number;
  top: number;
  size: number;
  label: string;
  hint: string | undefined;
  onPress: ((position: { row: number; column: number }) => void) | undefined;
}) {
  const handlePress = useCallback(() => onPress?.({ row, column }), [onPress, row, column]);

  return (
    <Pressable
      style={[styles.touch, { left, top, width: size, height: size }]}
      onPress={onPress ? handlePress : undefined}
      disabled={onPress === undefined}
      testID={`cell-${row}-${column}`}
      accessibilityLabel={label}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={hint}
      accessible
    />
  );
});

/** Start one effect's clock from zero.
 *
 *  Module level rather than inline in the board: assigning to a shared value
 *  held in a memoized array reads, to the react-hooks lint rule, as mutating a
 *  local after render. The assignment is to a Reanimated shared value, which is
 *  exactly the escape hatch that rule exists to protect, so the work moves out
 *  here where the intent is unambiguous. */
function startClock(clock: SharedValue<number>, durationMs: number): void {
  clock.value = 0;
  if (durationMs <= 0) {
    return;
  }
  clock.value = withTiming(durationMs, {
    // Linear, because this value IS elapsed time. Easing it would make every
    // delay in the sequence land at the wrong moment.
    duration: durationMs,
    easing: Easing.linear,
  });
}

/** Stop a clock and park it at zero, for a slot whose effect has retired. */
function stopClock(clock: SharedValue<number>): void {
  cancelAnimation(clock);
  clock.value = 0;
}

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
    effectSequences,
    effectKey,
    onEffectStarted,
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

  // Geometry and palette are memoized SEPARATELY from the scene, and their
  // identity is the whole point. The cached board picture is memoized on them;
  // building them inside the scene would mint fresh objects on every turn, the
  // cache would miss every time, and the static board would be re-baked on each
  // placement — losing exactly the win it exists for. They depend only on the
  // board size and the theme, so they change on a resize or a theme switch.
  const geometry = useMemo(() => sceneGeometry(boardSide, grid.length), [boardSide, grid.length]);
  const palette = useMemo(() => cinematicPalette(theme), [theme]);

  // The board, WITHOUT the preview. `preview` is deliberately absent from these
  // dependencies: it changes every time a dragged piece crosses a cell
  // boundary, and including it rebuilt all 64 cells, every block material and
  // every badge visual for a change affecting about four cells — then handed
  // each layer a new array identity, so Skia reconciled the whole tree too.
  const scene = useMemo(
    () =>
      buildBoardScene({
        grid,
        badges,
        theme,
        geometry,
        palette,
        highlightPieceId,
        frozen,
        reducedMotion,
      }),
    [grid, badges, theme, geometry, palette, highlightPieceId, frozen, reducedMotion],
  );

  // The ghost, rebuilt on its own. At most four cells, and the "nothing held"
  // case returns a shared empty array so the memoized layer skips entirely.
  const previewCells = useMemo(
    () => buildPreviewCells(preview, geometry, theme),
    [preview, geometry, theme],
  );

  const { cellSize, pitch, contentInset } = geometry;

  // One scene per live effect. The board used to build exactly one, from the
  // animator's single `plan`, so every effect the queue held beyond the top one
  // was retained in state and never drawn.
  //
  // Rebuilt only when the effect list or the board geometry changes: a drag or a
  // placement re-renders this component without touching these, so nothing in
  // flight is rebuilt.
  const sequences = useMemo(
    () =>
      (effectSequences ?? []).map((sequence) => ({
        id: sequence.id,
        scene: buildEffectScene(sequence.plan, geometry, palette, reducedMotion),
      })),
    [effectSequences, geometry, palette, reducedMotion],
  );

  // One clock per effect slot.
  //
  // Every effect needs its own progress, and a hook cannot be called in a loop.
  // The queue caps live effects at MAX_LIVE_EFFECTS, so a fixed pool of that many
  // shared values covers every case the queue can produce, allocated once and
  // assigned by draw-order position. A component-per-effect owning its own hook
  // was the obvious alternative and is not available here: it would have to live
  // inside the Canvas, and `test-utils/skiaMock.tsx` renders Canvas as null
  // precisely so that no logic hides in there.
  const clock0 = useSharedValue(0);
  const clock1 = useSharedValue(0);
  const clock2 = useSharedValue(0);
  const clock3 = useSharedValue(0);
  const clock4 = useSharedValue(0);
  const clock5 = useSharedValue(0);
  const clocks = useMemo(
    () => [clock0, clock1, clock2, clock3, clock4, clock5],
    [clock0, clock1, clock2, clock3, clock4, clock5],
  );

  const timed = useMemo(
    () =>
      sequences
        .slice(0, clocks.length)
        .map((sequence, index) => ({ ...sequence, elapsed: clocks[index] })),
    [sequences, clocks],
  );

  // Start each effect's own clock, and report its draw, exactly once.
  //
  // Keyed by the id occupying each slot, so a re-render that leaves the effect
  // list alone restarts nothing: an ordinary placement, a drag, or a theme change
  // re-renders this board without disturbing an effect in flight.
  const slotIdsRef = useRef<(string | null)[]>([]);
  const onEffectStartedRef = useRef(onEffectStarted);
  useEffect(() => {
    onEffectStartedRef.current = onEffectStarted;
  });
  useEffect(() => {
    if (cellSize <= 0) {
      return;
    }
    const previous = slotIdsRef.current;
    const current: (string | null)[] = [];

    for (let index = 0; index < clocks.length; index += 1) {
      const sequence = timed[index] ?? null;
      current.push(sequence?.id ?? null);
      if (sequence === null) {
        // Slot emptied: stop the clock so a retired effect's animation does not
        // keep running against a value nothing reads.
        if (previous[index] != null) {
          stopClock(clocks[index]);
        }
        continue;
      }
      if (previous[index] === sequence.id) {
        continue;
      }

      startClock(clocks[index], sequence.scene.durationMs);
      // The draw report. Mount of the layer is when React has committed it, so
      // the next frame paints it; reporting earlier would be a lie about drawing.
      onEffectStartedRef.current?.(sequence.id, Date.now());
    }

    slotIdsRef.current = current;
  }, [timed, clocks, cellSize]);

  // Stopping the clocks on unmount matters more than it looks: a sequence
  // outliving its board would keep the UI thread animating values nothing reads,
  // and this board unmounts on restart, Home and game over — three of the moments
  // most likely to happen mid-effect.
  useEffect(
    () => () => {
      for (const clock of clocks) {
        cancelAnimation(clock);
      }
    },
    [clocks],
  );

  // Shake belongs to the board, not to an effect, so it cannot be per-effect:
  // several effects each driving the same transform would fight over it. The
  // last sequence in draw order is the most important one live, and it wins.
  const shakeIndex = timed.length - 1;
  const shakeScene = shakeIndex >= 0 ? timed[shakeIndex].scene : null;
  const shakeClock = shakeIndex >= 0 ? timed[shakeIndex].elapsed : clock0;

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
          preview={previewCells}
          sequences={timed}
          shakeScene={shakeScene}
          elapsed={shakeClock}
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
                <TouchCell
                  key={`cell-${row}-${column}`}
                  row={row}
                  column={column}
                  left={contentInset + column * pitch}
                  top={contentInset + row * pitch}
                  size={cellSize}
                  label={cellLabel(cell, row, column, {
                    remainingTurns: timer?.remainingTurns,
                    critical: timer?.critical,
                    frozen,
                  })}
                  hint={placementHintFor(
                    cell,
                    onCellPress !== undefined,
                    placementHints?.get(`${row},${column}`),
                  )}
                  onPress={onCellPress}
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
