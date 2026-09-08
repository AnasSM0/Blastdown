import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import type { CellPosition } from "../../domain/placement";
import type { ClearPresentation } from "../../ui/effects/eventEffects";
import { BOARD_CONTENT_INSET } from "../../ui/boardGeometry";
import { spacing } from "../../ui/theme";

type Props = {
  clear: ClearPresentation;
  cellSize: number;
  color: string;
  reducedMotion: boolean;
};

const CELL_STAGGER_MS = 8;
const CELL_STAGGER_CAP_MS = 56;

function key(cell: CellPosition): string {
  return `${cell.row},${cell.column}`;
}

function withAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

function releaseDelay(clear: ClearPresentation, cell: CellPosition): number {
  const rowDelay = clear.rows.includes(cell.row) ? cell.column * CELL_STAGGER_MS : Infinity;
  const columnDelay = clear.columns.includes(cell.column) ? cell.row * CELL_STAGGER_MS : Infinity;
  return Math.min(Math.min(rowDelay, columnDelay), CELL_STAGGER_CAP_MS);
}

function ClearCell({
  cell,
  clear,
  elapsed,
  intersection,
  left,
  top,
  size,
  color,
  reducedMotion,
}: {
  cell: CellPosition;
  clear: ClearPresentation;
  elapsed: Animated.Value;
  intersection: boolean;
  left: number;
  top: number;
  size: number;
  color: string;
  reducedMotion: boolean;
}) {
  const delay = reducedMotion ? 0 : releaseDelay(clear, cell);
  const releaseStart = clear.timing.releaseStartMs + delay;
  const releasePeak = Math.min(1, 0.58 + clear.bloomIntensity * 0.3 + (intersection ? 0.12 : 0));
  const peakAt = Math.min(releaseStart + 36, clear.timing.releaseEndMs - 1);
  const opacity = elapsed.interpolate({
    inputRange: [
      clear.timing.impactStartMs,
      clear.timing.impactEndMs,
      releaseStart,
      peakAt,
      clear.timing.releaseEndMs,
    ],
    outputRange: [releasePeak * 0.92, 0, 0, releasePeak, 0],
    extrapolate: "clamp",
  });
  const scale = elapsed.interpolate({
    inputRange: [
      clear.timing.impactStartMs,
      clear.timing.impactEndMs,
      releaseStart,
      clear.timing.releaseEndMs,
    ],
    outputRange: [0.96, 1, 1, 0.82],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      pointerEvents="none"
      testID={`clear-flash-${cell.row}-${cell.column}`}
      accessibilityHint={intersection ? "Row and column intersection" : undefined}
      style={[
        styles.cell,
        {
          left,
          top,
          width: size,
          height: size,
          backgroundColor: withAlpha(color, intersection ? "F2" : "D9"),
          borderColor: withAlpha("#FFFFFF", intersection ? "F2" : "B8"),
          opacity,
        },
        reducedMotion ? null : { transform: [{ scale }] },
      ]}
    />
  );
}

function Lane({
  orientation,
  index,
  clear,
  elapsed,
  cellSize,
  color,
  reducedMotion,
}: {
  orientation: "row" | "column";
  index: number;
  clear: ClearPresentation;
  elapsed: Animated.Value;
  cellSize: number;
  color: string;
  reducedMotion: boolean;
}) {
  const pitch = cellSize + spacing.gridGutter;
  const span = cellSize * 8 + spacing.gridGutter * 7;
  const row = orientation === "row";
  const laneStyle = {
    left: row ? BOARD_CONTENT_INSET : BOARD_CONTENT_INSET + index * pitch,
    top: row ? BOARD_CONTENT_INSET + index * pitch : BOARD_CONTENT_INSET,
    width: row ? span : cellSize,
    height: row ? cellSize : span,
  };
  const glowOpacity = elapsed.interpolate({
    inputRange: [0, clear.timing.sweepEndMs, clear.timing.recoveryEndMs],
    outputRange: [clear.bloomIntensity * 0.2, clear.bloomIntensity * 0.14, 0],
    extrapolate: "clamp",
  });
  const streakLength = cellSize * 2.4;
  const sweepOpacity = elapsed.interpolate({
    inputRange: [
      clear.timing.sweepStartMs,
      (clear.timing.sweepStartMs + clear.timing.sweepEndMs) / 2,
      clear.timing.sweepEndMs,
    ],
    outputRange: [0, Math.min(1, 0.62 + clear.bloomIntensity * 0.3), 0],
    extrapolate: "clamp",
  });
  const travel = elapsed.interpolate({
    inputRange: [clear.timing.sweepStartMs, clear.timing.sweepEndMs],
    outputRange: [-streakLength, span + streakLength],
    extrapolate: "clamp",
  });

  return (
    <View
      pointerEvents="none"
      testID={`clear-lane-${orientation}-${index}`}
      style={[styles.lane, laneStyle]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: withAlpha(color, "8F"),
            borderColor: withAlpha("#FFFFFF", "73"),
            opacity: glowOpacity,
          },
          styles.laneGlow,
        ]}
      />
      {reducedMotion ? null : (
        <Animated.View
          pointerEvents="none"
          testID={`clear-sweep-${orientation}-${index}`}
          style={[
            styles.streak,
            row
              ? {
                  width: streakLength,
                  height: cellSize,
                  opacity: sweepOpacity,
                  transform: [{ translateX: travel }],
                }
              : {
                  width: cellSize,
                  height: streakLength,
                  opacity: sweepOpacity,
                  transform: [{ translateY: travel }],
                },
            { backgroundColor: withAlpha("#FFFFFF", "E6") },
          ]}
        />
      )}
    </View>
  );
}

/** One native-driver clock coordinates impact, lane travel, release and
 * recovery for the entire clear. Cells only interpolate that shared value. */
export function ClearPresentationLayer({ clear, cellSize, color, reducedMotion }: Props) {
  const [elapsed] = useState(() => new Animated.Value(0));

  useEffect(() => {
    elapsed.stopAnimation();
    elapsed.setValue(0);
    const animation = Animated.timing(elapsed, {
      toValue: clear.timing.recoveryEndMs,
      duration: clear.timing.recoveryEndMs,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [clear.timing.recoveryEndMs, elapsed]);

  const pitch = cellSize + spacing.gridGutter;
  const intersections = new Set(clear.intersections.map(key));
  return (
    <>
      {clear.rows.map((row) => (
        <Lane
          key={`row-${row}`}
          orientation="row"
          index={row}
          clear={clear}
          elapsed={elapsed}
          cellSize={cellSize}
          color={color}
          reducedMotion={reducedMotion}
        />
      ))}
      {clear.columns.map((column) => (
        <Lane
          key={`column-${column}`}
          orientation="column"
          index={column}
          clear={clear}
          elapsed={elapsed}
          cellSize={cellSize}
          color={color}
          reducedMotion={reducedMotion}
        />
      ))}
      {clear.cells.map((cell) => (
        <ClearCell
          key={key(cell)}
          cell={cell}
          clear={clear}
          elapsed={elapsed}
          intersection={intersections.has(key(cell))}
          left={BOARD_CONTENT_INSET + cell.column * pitch}
          top={BOARD_CONTENT_INSET + cell.row * pitch}
          size={cellSize}
          color={color}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  lane: {
    position: "absolute",
    overflow: "hidden",
  },
  laneGlow: {
    borderWidth: 1,
  },
  streak: {
    position: "absolute",
    borderRadius: 3,
  },
  cell: {
    position: "absolute",
    borderRadius: 3,
    borderWidth: 1,
  },
});
