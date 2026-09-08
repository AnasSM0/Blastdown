import { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";

import type { CellPosition } from "../../domain/placement";
import { MAX_BURST_CELLS, type DefuseEffect, type EffectPlan } from "../../ui/effects/eventEffects";
import { BOARD_CONTENT_INSET } from "../../ui/boardGeometry";
import { spacing } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import { BurstCell } from "./BurstCell";
import { CellFlash } from "./CellFlash";
import { FloatingText } from "./FloatingText";
import { PulseRing } from "./PulseRing";
import { ClearPresentationLayer } from "./ClearPresentationLayer";

const GUTTER = spacing.gridGutter;

/** Explosion pacing, capped so several simultaneous expiries never stack into
 *  an unbounded overlapping cascade. */
const BURST_PIECE_STEP_MS = 30;
const BURST_CELL_STEP_MS = 12;
const BURST_DELAY_CAP_MS = 120;

/** Revive recovery wave: sweeps top-to-bottom across the restored cells, at a
 *  lower peak than a clear so restoration reads as calm, not as another clear. */
const REVIVE_STEP_MS = 18;
const REVIVE_CAP_MS = 140;
const REVIVE_PEAK = 0.5;

type EffectsLayerProps = {
  plan: EffectPlan;
  cellSize: number;
  reducedMotion: boolean;
  /** Identity of the effect being drawn, from the effect queue. */
  effectId?: string | null;
  /** Called once when this layer starts drawing `effectId`. See the note on
   *  the effect below for why this exists. */
  onStarted?: (id: string, now: number) => void;
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

/** Where a defuse's effect belongs: the piece's own footprint when the pre-turn
 *  grid identified it, otherwise the cleared lines' midpoint as a fallback. */
function defuseAnchor(
  defuse: DefuseEffect,
  fallback: { row: number; column: number } | null,
): { row: number; column: number } | null {
  return centroid(defuse.cells) ?? fallback;
}

/** Renders one turn's cosmetic effects, positioned over the board's content area
 *  from the measured cell size. It reads a prebuilt EffectPlan and never computes
 *  gameplay: clears, defuses, explosions/rubble, and the revive recovery wave.
 *  Rendered as a SIBLING of the board rather than a child, so a change of plan
 *  never re-renders the 64 cells. */
export function EffectsLayer({
  plan,
  cellSize,
  reducedMotion,
  effectId,
  onStarted,
}: EffectsLayerProps) {
  const theme = useTheme();

  // Report to the animator that this layer has begun drawing an effect.
  //
  // This call is what makes the renderer-owned start time real. Without it
  // `startedDrawing` was never invoked in production: `startedAt` stayed null
  // forever, every effect retired on the watchdog rather than on its own clock,
  // and the "wait for a slow renderer" branch was unreachable. The unit tests
  // passed because they called it by hand.
  //
  // Mount is the right moment: React has committed the layer, so it paints on
  // the next frame. Reporting earlier would be a lie about drawing; reporting
  // later would need a frame callback per effect, which is the per-frame cost
  // this renderer exists to avoid.
  // Reported once per effect id, tracked in a ref rather than by effect
  // dependencies. The callback and the scene both change identity across
  // ordinary re-renders, so a dependency list would re-report the same effect
  // repeatedly. The animator ignores a second start, but a renderer that keeps
  // announcing the same draw is lying about what it did, and the next thing
  // built on top of it would inherit that.
  const startedRef = useRef<string | null>(null);
  const onStartedRef = useRef(onStarted);
  useEffect(() => {
    onStartedRef.current = onStarted;
  });
  useEffect(() => {
    if (effectId == null || cellSize <= 0 || startedRef.current === effectId) {
      return;
    }
    startedRef.current = effectId;
    onStartedRef.current?.(effectId, Date.now());
  }, [effectId, cellSize]);

  if (cellSize <= 0) {
    return null;
  }
  const pitch = cellSize + GUTTER;
  const left = (column: number) => BOARD_CONTENT_INSET + column * pitch;
  const top = (row: number) => BOARD_CONTENT_INSET + row * pitch;
  const centerX = (column: number) => left(column) + cellSize / 2;
  const centerY = (row: number) => top(row) + cellSize / 2;

  const clearCentroid = centroid(plan.clear?.cells ?? []);
  const rubbleCentroid = centroid(plan.rubbleCells);
  return (
    <View pointerEvents="none" style={styles.layer} testID="effects-layer">
      {plan.clear ? (
        <ClearPresentationLayer
          clear={plan.clear}
          cellSize={cellSize}
          color={theme.accent}
          reducedMotion={reducedMotion}
        />
      ) : null}

      {/* A defuse resolves on the piece that was defused — its own cells flash
          and its own centroid carries the ring — so the player can tell which
          timed piece went away even when several lines cleared at once. */}
      {plan.defuses.map((defuse, index) => {
        const anchor = defuseAnchor(defuse, clearCentroid);
        if (!anchor) {
          return null;
        }
        return (
          <View key={`defuse-${defuse.pieceId}-${index}`}>
            {defuse.cells.map((cell) => (
              <CellFlash
                key={`defuse-cell-${cell.row}-${cell.column}`}
                testID={`defuse-flash-${cell.row}-${cell.column}`}
                left={left(cell.column)}
                top={top(cell.row)}
                size={cellSize}
                color={theme.accent}
                reducedMotion={reducedMotion}
              />
            ))}
            <PulseRing
              centerX={centerX(anchor.column)}
              centerY={centerY(anchor.row)}
              size={cellSize * 3}
              color={theme.accent}
              reducedMotion={reducedMotion}
            />
          </View>
        );
      })}

      {/* A rewarded defuse (a cue) shows no bonus text — it awards none. */}
      {plan.defuses.length > 0 && plan.cue === null
        ? (() => {
            const anchor = defuseAnchor(plan.defuses[0], clearCentroid);
            const bonus = plan.defuses.reduce((sum, defuse) => sum + defuse.bonus, 0);
            return anchor ? (
              <FloatingText
                text={`+${bonus}`}
                color={theme.accent}
                centerX={centerX(anchor.column)}
                top={top(anchor.row) - cellSize}
                reducedMotion={reducedMotion}
              />
            ) : null;
          })()
        : null}

      {clearCentroid && plan.defuses.length === 0 && plan.scoreDelta > 0 ? (
        <FloatingText
          text={`+${plan.scoreDelta}`}
          color={theme.score}
          centerX={centerX(clearCentroid.column)}
          top={top(clearCentroid.row)}
          reducedMotion={reducedMotion}
        />
      ) : null}

      {plan.explosions
        .flatMap((explosion, explosionIndex) =>
          explosion.cells.map((cell, cellIndex) => ({
            explosionId: explosion.explosionId,
            cell,
            delay: Math.min(
              explosionIndex * BURST_PIECE_STEP_MS + cellIndex * BURST_CELL_STEP_MS,
              BURST_DELAY_CAP_MS,
            ),
          })),
        )
        // Budgeted across ALL explosions, so several simultaneous expiries can't
        // multiply the view count — the burst is a cue, not a particle system.
        .slice(0, MAX_BURST_CELLS)
        .map(({ explosionId, cell, delay }) => (
          <BurstCell
            key={`burst-${explosionId}-${cell.row}-${cell.column}`}
            left={left(cell.column)}
            top={top(cell.row)}
            size={cellSize}
            reducedMotion={reducedMotion}
            fillColor={theme.score}
            borderColor={theme.timerCritical}
            delay={delay}
          />
        ))}

      {rubbleCentroid && plan.scoreDelta < 0 ? (
        <FloatingText
          text={`${plan.scoreDelta}`}
          color={theme.timerCritical}
          centerX={centerX(rubbleCentroid.column)}
          top={top(rubbleCentroid.row) - cellSize}
          reducedMotion={reducedMotion}
        />
      ) : null}

      {/* Revive: a restrained recovery wave down the cells the revive restored,
          drawn over a board that is already repaired and already interactive. */}
      {plan.reviveCells.map((cell) => (
        <CellFlash
          key={`revive-${cell.row}-${cell.column}`}
          testID={`revive-flash-${cell.row}-${cell.column}`}
          left={left(cell.column)}
          top={top(cell.row)}
          size={cellSize}
          color={theme.accent}
          reducedMotion={reducedMotion}
          delay={Math.min(cell.row * REVIVE_STEP_MS, REVIVE_CAP_MS)}
          peak={REVIVE_PEAK}
        />
      ))}
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
