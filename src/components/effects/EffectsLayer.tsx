import { View, StyleSheet } from "react-native";

import type { CellPosition } from "../../domain/placement";
import type { EffectPlan } from "../../ui/effects/eventEffects";
import { BOARD_CONTENT_INSET } from "../../ui/boardGeometry";
import { spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { BurstCell } from "./BurstCell";
import { CellFlash } from "./CellFlash";
import { FloatingText } from "./FloatingText";
import { PulseRing } from "./PulseRing";

const GUTTER = spacing.gridGutter;
const STAGGER_STEP_MS = 10;
const STAGGER_CAP_MS = 120;

type EffectsLayerProps = {
  plan: EffectPlan;
  cellSize: number;
  reducedMotion: boolean;
};

function centroid(cells: readonly CellPosition[]): { row: number; column: number } | null {
  if (cells.length === 0) {
    return null;
  }
  let rowSum = 0;
  let columnSum = 0;
  for (const cell of cells) {
    rowSum += cell.row;
    columnSum += cell.column;
  }
  return { row: rowSum / cells.length, column: columnSum / cells.length };
}

/** Renders one turn's cosmetic effects, positioned over the board's content
 *  area from the measured cell size. It reads a prebuilt EffectPlan and never
 *  computes gameplay. Line-clear and defuse beats live here; explosion/rubble
 *  beats are added alongside them. */
export function EffectsLayer({ plan, cellSize, reducedMotion }: EffectsLayerProps) {
  const theme = useTheme();
  if (cellSize <= 0) {
    return null;
  }
  const pitch = cellSize + GUTTER;
  const left = (column: number) => BOARD_CONTENT_INSET + column * pitch;
  const top = (row: number) => BOARD_CONTENT_INSET + row * pitch;
  const centerX = (column: number) => left(column) + cellSize / 2;
  const centerY = (row: number) => top(row) + cellSize / 2;

  const clearCentroid = centroid(plan.clearedCells);
  const rubbleCentroid = centroid(plan.rubbleCells);

  return (
    <View pointerEvents="none" style={styles.layer} testID="effects-layer">
      {plan.clearedCells.map((cell) => (
        <CellFlash
          key={`clear-${cell.row}-${cell.column}`}
          left={left(cell.column)}
          top={top(cell.row)}
          size={cellSize}
          color={theme.accent}
          reducedMotion={reducedMotion}
          delay={Math.min((cell.row + cell.column) * STAGGER_STEP_MS, STAGGER_CAP_MS)}
        />
      ))}

      {clearCentroid
        ? plan.defuses.map((defuse, index) => (
            <PulseRing
              key={`defuse-ring-${defuse.pieceId}-${index}`}
              centerX={centerX(clearCentroid.column)}
              centerY={centerY(clearCentroid.row)}
              size={cellSize * 3}
              color={theme.accent}
              reducedMotion={reducedMotion}
            />
          ))
        : null}

      {clearCentroid && plan.defuses.length > 0 ? (
        <FloatingText
          text={`DEFUSED +${plan.defuses.reduce((sum, defuse) => sum + defuse.bonus, 0)}`}
          color={theme.accent}
          centerX={centerX(clearCentroid.column)}
          top={top(clearCentroid.row) - cellSize}
          reducedMotion={reducedMotion}
        />
      ) : null}

      {clearCentroid && plan.defuses.length === 0 && plan.scoreDelta > 0 ? (
        <FloatingText
          text={`+${plan.scoreDelta}`}
          color={theme.score}
          centerX={centerX(clearCentroid.column)}
          top={top(clearCentroid.row)}
          reducedMotion={reducedMotion}
        />
      ) : null}

      {plan.explosions.map((explosion, explosionIndex) =>
        explosion.cells.map((cell, cellIndex) => (
          <BurstCell
            key={`burst-${explosion.explosionId}-${cell.row}-${cell.column}`}
            left={left(cell.column)}
            top={top(cell.row)}
            size={cellSize}
            reducedMotion={reducedMotion}
            fillColor={theme.score}
            borderColor={theme.timerCritical}
            delay={explosionIndex * 40 + cellIndex * 12}
          />
        )),
      )}

      {rubbleCentroid && plan.scoreDelta < 0 ? (
        <FloatingText
          text={`${plan.scoreDelta}`}
          color={theme.timerCritical}
          centerX={centerX(rubbleCentroid.column)}
          top={top(rubbleCentroid.row) - cellSize}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
});
