import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EffectStack } from "../components/effects/EffectStack";
import { BoardImpulseFrame } from "../components/BoardImpulseFrame";
import type { GridCell as DomainGridCell } from "../domain/gameTypes";
import { useEventAnimator, type EventAnimator } from "../hooks/useEventAnimator";
// The same flag-gated resolver the game screen uses. Importing the cinematic
// board directly would evaluate Skia in every development build, including the
// ones used to test the flag being OFF.
import { BoardRenderer, CINEMATIC_RENDERER } from "../rendering/boardRenderer";
import { resetEffectDiagnostics } from "../ui/effects/effectDiagnostics";
import { spacing } from "../ui/theme";

import { EffectDiagnosticsOverlay } from "./EffectDiagnosticsOverlay";
import { EFFECT_HARNESS_SCENARIOS, harnessScenario } from "./effectHarness";
import { useEffectHarnessRunner } from "./useEffectHarnessRunner";
import { PlaytestDashboard } from "./playtest/PlaytestDashboard";

/** The development-only effect delivery harness.
 *
 *  Reachable only through `resolveEffectHarness()`, which returns nothing
 *  outside a development build — see `effectHarnessEntry.ts` for why that is a
 *  require rather than an import.
 *
 *  The board here is the real one, chosen by the real renderer flag, and the
 *  effects come from the real animator fed a scripted event stream. Nothing on
 *  this screen can produce an effect that gameplay could not; that is the whole
 *  point, and it is guarded by a test that forbids this file from naming the
 *  queue's or the renderers' internals. */

const BOARD_EDGE = 8;

/** A board with something on it.
 *
 *  Fixed, not generated: a tester comparing two phones has to be comparing the
 *  phones. Blocks give the clear sweep something to cross, the timed piece gives
 *  the defuse beat a footprint, and the rubble gives the explosion a backdrop. */
function harnessGrid(): DomainGridCell[][] {
  return Array.from({ length: BOARD_EDGE }, (_, row) =>
    Array.from({ length: BOARD_EDGE }, (_, column): DomainGridCell => {
      if (row === 4 && column >= 3 && column <= 4) {
        return { kind: "timed", pieceInstanceId: "harness-timed-1", colorId: "amber" };
      }
      if (row === 7 && column <= 1) {
        return { kind: "rubble", explosionId: "harness-x1" };
      }
      if ((row + column) % 3 === 0) {
        return { kind: "normal", colorId: "cyan" };
      }
      return { kind: "empty" };
    }),
  );
}

const MAX_BOARD_SIDE = 320;

export function EffectHarnessScreen() {
  const { width } = useWindowDimensions();
  const boardSide = Math.min(MAX_BOARD_SIDE, Math.max(0, width - 2 * spacing.screenPadding));
  const grid = useMemo(() => harnessGrid(), []);
  const [cellSize, setCellSize] = useState(0);

  // The runner needs the animator's cue and reset entry points, and the animator
  // needs the runner's turn and events — a cycle. It is broken with a ref that
  // is written in an effect rather than during render: the runner is built
  // first, so during the render that creates it the animator does not exist yet,
  // and both entry points are only ever called from a scheduled step, which is
  // at least one commit later.
  const animatorRef = useRef<EventAnimator | null>(null);
  const playCue = useCallback<EventAnimator["playCue"]>((kind, cells) => {
    animatorRef.current?.playCue(kind, cells);
  }, []);
  const reset = useCallback(() => {
    animatorRef.current?.reset();
  }, []);
  const hooks = useMemo(() => ({ playCue, reset }), [playCue, reset]);
  const runner = useEffectHarnessRunner(hooks);
  const active = runner.activeScenarioId ? harnessScenario(runner.activeScenarioId) : undefined;
  const reducedMotion = active?.reducedMotion ?? false;

  const animator = useEventAnimator({
    turn: runner.turn,
    events: runner.events,
    grid,
    reducedMotion,
  });
  useEffect(() => {
    animatorRef.current = animator;
  });

  const boardImpulse = CINEMATIC_RENDERER ? null : animator.boardImpulse;

  return (
    <SafeAreaView style={styles.screen} testID="effect-harness-screen">
      <View style={styles.boardZone}>
        <View style={{ width: boardSide, height: boardSide }}>
          <BoardImpulseFrame impulse={boardImpulse} reducedMotion={reducedMotion}>
            <BoardRenderer
              grid={grid}
              badges={[]}
              boardSize={boardSide}
              placedCells={runner.placedCells}
              placementNonce={runner.placementNonce}
              reducedMotion={reducedMotion}
              onCellSizeChange={setCellSize}
              effectSequences={CINEMATIC_RENDERER ? animator.sequences : undefined}
              onEffectStarted={animator.startedDrawing}
            />
            {CINEMATIC_RENDERER ? null : (
              <EffectStack
                sequences={animator.sequences}
                cellSize={cellSize}
                reducedMotion={reducedMotion}
                onStarted={animator.startedDrawing}
              />
            )}
          </BoardImpulseFrame>
        </View>
      </View>

      <EffectDiagnosticsOverlay />

      <Text style={styles.expectation} testID="effect-harness-expectation">
        {active ? `${active.label} — ${active.expectation}` : "Pick a scenario."}
      </Text>

      <ScrollView contentContainerStyle={styles.buttons}>
        <PlaytestDashboard />
        {EFFECT_HARNESS_SCENARIOS.map((scenario) => (
          <Pressable
            key={scenario.id}
            style={[styles.button, runner.activeScenarioId === scenario.id && styles.buttonActive]}
            testID={`harness-scenario-${scenario.id}`}
            accessibilityRole="button"
            accessibilityLabel={scenario.label}
            onPress={() => runner.run(scenario.id)}
          >
            <Text style={styles.buttonLabel}>{scenario.label}</Text>
          </Pressable>
        ))}
        <Pressable
          style={styles.button}
          testID="harness-clear-counters"
          accessibilityRole="button"
          accessibilityLabel="Clear diagnostics counters"
          onPress={resetEffectDiagnostics}
        >
          <Text style={styles.buttonLabel}>Clear counters</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#07090d",
    flex: 1,
    gap: spacing.sm,
    padding: spacing.screenPadding,
  },
  boardZone: {
    alignItems: "center",
  },
  expectation: {
    color: "#cfd8e3",
    fontSize: 12,
    lineHeight: 16,
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  button: {
    backgroundColor: "#16202e",
    borderColor: "#2c3f57",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonActive: {
    borderColor: "#39ff88",
  },
  buttonLabel: {
    color: "#e8f1ff",
    fontSize: 12,
  },
});
