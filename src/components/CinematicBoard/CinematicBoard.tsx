import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { useFont } from "@shopify/react-native-skia";
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { CinematicBoardCanvas } from "../../rendering/cinematic/CinematicBoardCanvas";
import { buildEffectScene, type EffectScene } from "../../rendering/cinematic/effects/effectScene";
import { sceneGeometry } from "../../rendering/cinematic/geometry";
import { cinematicPalette } from "../../rendering/cinematic/palette";
import {
  buildBoardScene,
  buildPreClearHighlights,
  buildPreviewCells,
} from "../../rendering/cinematic/scene";
import { radius } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { getTimerVisualState } from "../../ui/timerStates";
import { recordClockLeases } from "../../ui/effects/effectDiagnostics";
import { assignClockSlots } from "../../ui/effects/effectQueue";
import { PRE_CLEAR_PULSE_MIN, PRE_CLEAR_PULSE_MS } from "../../ui/preClearPreview";
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
  onPreviewChange,
}: {
  row: number;
  column: number;
  left: number;
  top: number;
  size: number;
  label: string;
  hint: string | undefined;
  onPress: ((position: { row: number; column: number }) => void) | undefined;
  onPreviewChange: ((position: { row: number; column: number } | null) => void) | undefined;
}) {
  const handlePress = useCallback(() => onPress?.({ row, column }), [onPress, row, column]);
  const handlePressIn = useCallback(
    () => onPreviewChange?.({ row, column }),
    [onPreviewChange, row, column],
  );
  const handlePressOut = useCallback(() => onPreviewChange?.(null), [onPreviewChange]);

  return (
    <Pressable
      style={[styles.touch, { left, top, width: size, height: size }]}
      onPress={onPress ? handlePress : undefined}
      onPressIn={onPreviewChange ? handlePressIn : undefined}
      onPressOut={onPreviewChange ? handlePressOut : undefined}
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
    onCellPreviewChange,
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
  const preClearHighlights = useMemo(
    () => buildPreClearHighlights(preview, geometry, theme),
    [preview, geometry, theme],
  );
  const preClearPulse = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(preClearPulse);
    preClearPulse.value = 1;
    if (preClearHighlights.length === 0 || reducedMotion) {
      return;
    }
    preClearPulse.value = withRepeat(
      withTiming(PRE_CLEAR_PULSE_MIN, {
        duration: PRE_CLEAR_PULSE_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(preClearPulse);
      preClearPulse.value = 1;
    };
  }, [preClearHighlights, preClearPulse, reducedMotion]);

  const { cellSize, pitch, contentInset } = geometry;

  // One scene per live effect. The board used to build exactly one, from the
  // animator's single `plan`, so every effect the queue held beyond the top one
  // was retained in state and never drawn.
  //
  // Rebuilt only when the effect list or the board geometry changes: a drag or a
  // placement re-renders this component without touching these, so nothing in
  // flight is rebuilt.
  // One scene per live effect. The board used to build exactly one, from the
  // animator's single `plan`, so every effect the queue held beyond the top one
  // was retained in state and never drawn.
  //
  // Rebuilt only when the effect list or the board geometry changes: a drag or a
  // placement re-renders this component without touching these, so nothing in
  // flight is rebuilt.
  const sequences = useMemo(() => effectSequences ?? [], [effectSequences]);
  const sceneById = useMemo(() => {
    const scenes = new Map<string, EffectScene>();
    for (const sequence of sequences) {
      scenes.set(sequence.id, buildEffectScene(sequence.plan, geometry, palette, reducedMotion));
    }
    return scenes;
  }, [sequences, geometry, palette, reducedMotion]);

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
  // Frozen on first render, deliberately: the pool must have ONE identity for
  // the life of the board.
  //
  // A shared value's identity is stable in production, but the Reanimated jest
  // mock returns a fresh object from `useSharedValue` on every render. Listing
  // the six as dependencies therefore rebuilt this array each render, which
  // re-ran the effect below, which set state, which rendered again — an
  // unbounded loop that exhausted the heap rather than failing an assertion.
  // Empty dependencies pin the first-render values, which are the real shared
  // values in production and a stable set under the mock.
  //
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const clocks = useMemo(() => [clock0, clock1, clock2, clock3, clock4, clock5], []);

  // Clock slots are leased by effect id, never by position in draw order.
  //
  // Draw order is a sort: admitting a critical effect, or retiring a standard
  // one, moves every other effect along. Handing out clocks by index meant a
  // survivor found a different clock under it, its slot read as "new id here",
  // and its animation restarted from zero — one effect completing resetting
  // another. A lease survives its neighbours coming and going.
  //
  // Held in state rather than derived during render because the lease map is
  // memory: what a slot means depends on which effects held it before. Reading
  // that during render is exactly the "cannot access refs during render" hazard,
  // and it would tear under a concurrent re-render. The extra pass costs one
  // render per CHANGE OF EFFECT SET — a turn boundary, never a frame.
  const leasesRef = useRef(new Map<string, number>());
  const [timed, setTimed] = useState<
    { id: string; scene: EffectScene; elapsed: SharedValue<number> }[]
  >([]);

  useEffect(() => {
    setTimed(
      assignClockSlots(leasesRef.current, sequences, clocks.length).map(({ sequence, slot }) => ({
        id: sequence.id,
        scene: sceneById.get(sequence.id) as EffectScene,
        elapsed: clocks[slot],
      })),
    );
    // Publish the leases rather than let the overlay derive them. Deriving them
    // from draw order is exactly the positional assignment the leases replaced,
    // so a diagnostic built that way would report the arrangement that caused
    // the bug instead of the one in force.
    recordClockLeases(leasesRef.current);
  }, [sequences, sceneById, clocks]);

  // Start each effect's own clock, and report its draw, exactly once.
  //
  // Keyed by effect id, so a re-render that leaves the effect list alone starts
  // nothing: an ordinary placement, a drag or a theme change re-renders this
  // board without disturbing anything in flight.
  const startedRef = useRef(new Map<string, SharedValue<number>>());
  const onEffectStartedRef = useRef(onEffectStarted);
  useEffect(() => {
    onEffectStartedRef.current = onEffectStarted;
  });
  useEffect(() => {
    if (cellSize <= 0) {
      return;
    }
    const started = startedRef.current;
    const live = new Set(timed.map((sequence) => sequence.id));

    for (const [id, clock] of [...started.entries()]) {
      if (!live.has(id)) {
        // Retired: stop its clock so a finished effect does not keep animating
        // a value nothing reads.
        stopClock(clock);
        started.delete(id);
      }
    }

    for (const sequence of timed) {
      if (started.has(sequence.id)) {
        continue;
      }
      started.set(sequence.id, sequence.elapsed);
      startClock(sequence.elapsed, sequence.scene.durationMs);
      // The draw report. React has committed this layer, so the next frame
      // paints it; reporting earlier would be a lie about drawing.
      onEffectStartedRef.current?.(sequence.id, Date.now());
    }
  }, [timed, cellSize]);

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
          preClear={preClearHighlights}
          preClearOpacity={reducedMotion ? 1 : preClearPulse}
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
                  onPreviewChange={onCellPreviewChange}
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
