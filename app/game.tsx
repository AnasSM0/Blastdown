import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { BoardImpulseFrame } from "../src/components/BoardImpulseFrame";
import { EffectStack } from "../src/components/effects/EffectStack";
import { PraiseOverlay } from "../src/components/PraiseOverlay";
import { PieceTray } from "../src/components/PieceTray";
import { ReactorBackground } from "../src/components/ReactorBackground";
import { ScoreHeader } from "../src/components/ScoreHeader";
import { GameOverOverlay } from "../src/components/modals/GameOverOverlay";
import { DefuseConfirmCard } from "../src/components/modals/DefuseConfirmCard";
import { PauseOverlay } from "../src/components/modals/PauseOverlay";
import { RunConfirmationCard } from "../src/components/modals/RunConfirmationCard";
import { RewardedActionBar } from "../src/components/RewardedActionButton";
import { DragGhost } from "../src/components/DragGhost";
import { BOARD_SIZE } from "../src/domain/board";
import type { CellPosition } from "../src/domain/placement";
import {
  canActivateFreeze,
  canApplyRewardedDefuse,
  getRewardedDefuseTarget,
  getTimerBadgePlacements,
} from "../src/domain/selectors";
// Resolved behind the build-time flag, so a build with the cinematic renderer
// off never evaluates Skia at all. See the module's own comment.
import { BoardRenderer, CINEMATIC_RENDERER } from "../src/rendering/boardRenderer";
import { cellsOfPiece } from "../src/ui/effects/eventEffects";
import {
  useGameController,
  type GameController,
  type GameControllerOptions,
} from "../src/hooks/useGameController";
import { useEffectiveReducedMotion } from "../src/hooks/useEffectiveReducedMotion";
import { useEventAnimator } from "../src/hooks/useEventAnimator";
import { usePraiseCelebration } from "../src/hooks/usePraiseCelebration";
import { useGameAnalytics } from "../src/hooks/useGameAnalytics";
import { useGameFeedback } from "../src/hooks/useGameFeedback";
import { useRewardedAction } from "../src/hooks/useRewardedAction";
import { useRewardOutcome } from "../src/hooks/useRewardOutcome";
import { usePieceDragInteraction } from "../src/hooks/usePieceDragInteraction";
import { AudioServiceProvider } from "../src/services/audio";
import type { AudioService } from "../src/services/audio";
import { StorageServiceProvider, createMemoryStorageService } from "../src/services/storage";
import { SettingsProvider } from "../src/state/SettingsProvider";
import { AdServiceProvider, REWARD_PLACEMENTS } from "../src/services/ads";
import type { AdService } from "../src/services/ads";
import { AnalyticsServiceProvider, rewardOutcome, useAnalytics } from "../src/services/analytics";
import type { AnalyticsService } from "../src/services/analytics";
import { useGameSession } from "../src/state/GameSessionProvider";
import { useProfile } from "../src/state/ProfileProvider";
import { spacing } from "../src/ui/theme";
import { useTheme } from "../src/ui/ThemeProvider";
import { resolveDangerState } from "../src/ui/dangerState";
import { resolveScoreImpactForTurn } from "../src/ui/scoreImpact";
import { INVALID_RETURN_MS } from "../src/ui/pieceInteraction";

type GameViewProps = {
  controller: GameController;
  /** Persisted best score for the HUD. Threaded in from the single profile read
   *  path (the real route reads `useProfile`); defaults to 0 for the pre-load /
   *  default-profile state and for isolated renders. */
  best?: number;
  /** Test seam: fixed board size, since onLayout doesn't fire in tests. */
  boardSize?: number;
  /** Invoked when the player leaves gameplay back to Home. */
  onExit?: () => void;
  /** Invoked to open the end-of-run results screen. */
  onResults?: () => void;
  /** Replaces the active session with a fresh generation. The real route uses
   * GameSession; isolated tests fall back to the controller restart seam. */
  onRestart?: () => void;
  /** Persistence boundary supplied by the real session. Isolated component
   * tests default to an already-resolved no-op. */
  flushActiveRun?: () => Promise<void>;
};

/** Upper bound on the board's edge so it never balloons on tablets/wide screens
 *  (mirrors GameBoard's own maxWidth). */
const MAX_BOARD_SIZE = 420;
/** Fixed height the tray + action dock (plus a little breathing room) need
 *  beneath the board. The board's height budget is the content height MINUS this
 *  reserve, so the tray and dock always fit and never clip below the safe area —
 *  even on very short screens or at large text. Tray ≈ 88, dock ≈ 84, gaps ≈ 28. */
const RESERVED_BELOW_BOARD = 200;

/** Board edge length from the measured INNER content box (the content view's own
 *  padding already removed by the caller): the largest square that fits the
 *  available width and the height left after reserving the tray + dock, capped.
 *  Returns 0 until measured (nothing renders that frame). Pure — no fixed device
 *  coordinates, just measured geometry. */
export function computeBoardSide(content: { width: number; height: number }): number {
  if (content.width <= 0 || content.height <= 0) {
    return 0;
  }
  const heightBudget = content.height - RESERVED_BELOW_BOARD;
  if (heightBudget <= 0) {
    return 0;
  }
  return Math.min(content.width, heightBudget, MAX_BOARD_SIZE);
}

/** Presentational gameplay screen over a supplied controller. Holds no
 *  gameplay rules — every decision is delegated to the domain controller. */
const resolvedFlush = (): Promise<void> => Promise.resolve();

export function GameView({
  controller,
  best = 0,
  boardSize,
  onExit,
  onResults,
  onRestart,
  flushActiveRun = resolvedFlush,
}: GameViewProps) {
  const { state } = controller;
  const reducedMotion = useEffectiveReducedMotion();
  const animator = useEventAnimator({
    turn: state.turn,
    events: controller.lastEvents,
    // The grid is needed to locate a defused piece's cells: `pieceDefused`
    // carries its identity/timer outcome but not its footprint, and by the time
    // it is handled the piece is gone from the current board.
    grid: state.grid,
    reducedMotion,
  });
  const {
    current: activePraise,
    complete: completePraise,
    reset: resetPraise,
  } = usePraiseCelebration({ turn: state.turn, events: controller.lastEvents });
  // Turn-scoped gameplay analytics (placed/line/defused/explosion/rubble),
  // logged once per turn from the domain event stream.
  useGameAnalytics({ turn: state.turn, events: controller.lastEvents });
  const { track } = useAnalytics();
  const theme = useTheme();
  const danger = useMemo(
    () => resolveDangerState({ activeTimers: state.activeTimers }),
    [state.activeTimers],
  );
  const scoreImpact = useMemo(
    () => resolveScoreImpactForTurn(controller.lastEvents, state.turn),
    [controller.lastEvents, state.turn],
  );

  const [paused, setPaused] = useState(false);
  const feedback = useGameFeedback({
    sessionGeneration: controller.sessionGeneration,
    turn: state.turn,
    events: controller.lastEvents,
    status: state.status,
    paused,
    combo: state.combo,
    score: state.score,
    previousBest: best,
  });
  const beforeReward = useCallback(async () => {
    await flushActiveRun();
    feedback.interrupt();
  }, [feedback, flushActiveRun]);
  const reward = useRewardedAction({ beforeShow: beforeReward, afterShow: feedback.restore });
  const [restartConfirmation, setRestartConfirmation] = useState<"closed" | "open">("closed");
  const restartTransitionRef = useRef(false);
  const homeTransitionRef = useRef(false);
  const resultsTransitionRef = useRef(false);
  // Measured gameplay content box; drives a responsive square board that fits
  // both the available width and a height budget. A caller-supplied `boardSize`
  // (test seam) overrides measurement, since onLayout doesn't fire under jest.
  // The measured box is the INNER content area (the board's actual room), so the
  // content view's own padding is subtracted here — otherwise the board would be
  // sized to the full padded width and overrun both gutters.
  const [contentBox, setContentBox] = useState({ width: 0, height: 0 });
  const boardSide = boardSize ?? computeBoardSide(contentBox);
  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const innerWidth = Math.max(0, width - 2 * spacing.screenPadding);
    const innerHeight = Math.max(0, height - 2 * spacing.sm);
    setContentBox((current) =>
      current.width === innerWidth && current.height === innerHeight
        ? current
        : { width: innerWidth, height: innerHeight },
    );
  }, []);

  const [defuseConfirmOpen, setDefuseConfirmOpen] = useState(false);
  // Transient per-action reward feedback (pending while the ad is in flight,
  // then a brief success/failure/cancelled outcome). One shared hook per action
  // so Freeze and Defuse present, sound, and time out identically.
  const freezeOutcome = useRewardOutcome(reducedMotion);
  const defuseOutcome = useRewardOutcome(reducedMotion);
  const [previewOrigin, setPreviewOrigin] = useState<CellPosition | null>(null);

  // Only authoritative interaction states block a new action. Presentation
  // effects intentionally do not participate: their queue can remain active
  // across later turns.
  const authoritativeInputLocked =
    reward.pending ||
    paused ||
    defuseConfirmOpen ||
    restartConfirmation === "open" ||
    state.status !== "playing";

  const invalidPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    boardRef,
    ghostRef,
    cellSize,
    drag,
    dragPreview,
    returning,
    handleCellSizeChange,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
    clearDrag,
  } = usePieceDragInteraction({
    controller,
    boardSize,
    inputLocked: authoritativeInputLocked,
    onDragStarted: () => setPreviewOrigin(null),
    onInvalidDrop: (origin) => {
      feedback.emit("invalidPlacement");
      if (origin) {
        track({ name: "piece_rejected" });
      }
    },
  });
  // A live drag blocks every new action except its own move/finalize callbacks.
  const inputLocked = authoritativeInputLocked || (drag !== null && !returning);

  // The board's press handler must keep a stable identity: `controller` is a
  // fresh object every render and `inputLocked` flips on pause, modal, drag,
  // and reward transitions — depending on either would change the prop on each
  // of those and re-render all 64 cells for unrelated screen state.
  // Both are read through refs written in an effect, so the handler stays
  // referentially stable while still seeing current values when it runs.
  const controllerRef = useRef(controller);
  const inputLockedRef = useRef(inputLocked);
  useEffect(() => {
    controllerRef.current = controller;
    inputLockedRef.current = inputLocked;
  });

  const badges = useMemo(() => getTimerBadgePlacements(state), [state]);

  // Cells of the piece placed on the current turn drive the placement "snap".
  const placement = useMemo(() => {
    const event = controller.lastEvents.find((candidate) => candidate.type === "piecePlaced");
    return event && event.type === "piecePlaced"
      ? { cells: event.cells, nonce: `${controller.sessionGeneration}:${state.turn}` }
      : { cells: [] as CellPosition[], nonce: undefined };
  }, [controller.lastEvents, controller.sessionGeneration, state.turn]);
  const refillNonce = controller.lastEvents.some((event) => event.type === "handRefilled")
    ? state.handRefills
    : undefined;
  const { clearSelection, previewAt, selectedHandId } = controller;
  const tapPreview = useMemo(
    () => (previewOrigin ? previewAt(previewOrigin) : null),
    [previewAt, previewOrigin],
  );
  // During drag the native-backed ghost is the one placement silhouette. The
  // board receives only the same prediction's clear lanes, preventing a second
  // ghost from stacking underneath while preserving B-02 pre-clear semantics.
  const preview = useMemo(
    () => (dragPreview ? { ...dragPreview, cells: [], conflictCells: [] } : tapPreview),
    [dragPreview, tapPreview],
  );

  // Per-empty-cell anchor validity for the selected piece, for the board's
  // accessibility placement hints. Reuses the domain's own read-only preview
  // (no gameplay mutation, no duplicated rules) and is null while nothing is
  // selected, so empty cells stay silent until a piece is held. Recomputes when
  // the selection or the board changes, so the hints never go stale.
  const placementHints = useMemo(() => {
    if (selectedHandId === null) {
      return null;
    }
    const hints = new Map<string, "valid" | "invalid">();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let column = 0; column < BOARD_SIZE; column++) {
        if (state.grid[row][column].kind !== "empty") {
          continue;
        }
        const cellPreview = previewAt({ row, column });
        hints.set(`${row},${column}`, cellPreview?.valid ? "valid" : "invalid");
      }
    }
    return hints;
  }, [previewAt, selectedHandId, state.grid]);

  const handleSelect = useCallback(
    (handId: string) => {
      if (inputLocked) {
        return;
      }
      if (invalidPreviewTimerRef.current) {
        clearTimeout(invalidPreviewTimerRef.current);
        invalidPreviewTimerRef.current = null;
      }
      setPreviewOrigin(null);
      const wasSelected = controller.selectedHandId === handId;
      controller.selectPiece(handId);
      if (!wasSelected) {
        track({ name: "piece_selected" });
      }
    },
    [controller, inputLocked, track],
  );

  const handlePickup = useCallback(
    (_handId: string) => {
      if (!inputLocked) feedback.emit("piecePickup");
    },
    [feedback, inputLocked],
  );

  const handleCellPress = useCallback(
    (position: CellPosition) => {
      const controller = controllerRef.current;
      if (inputLockedRef.current || controller.selectedHandId === null) {
        return;
      }
      if (controller.placeAt(position)) {
        // Placement feedback comes from the committed piecePlaced event.
        setPreviewOrigin(null);
      } else {
        // Rejected by the domain: show exactly where the attempt conflicts.
        setPreviewOrigin(position);
        if (invalidPreviewTimerRef.current) {
          clearTimeout(invalidPreviewTimerRef.current);
        }
        invalidPreviewTimerRef.current = setTimeout(() => {
          invalidPreviewTimerRef.current = null;
          setPreviewOrigin(null);
        }, INVALID_RETURN_MS);
        feedback.emit("invalidPlacement");
        track({ name: "piece_rejected" });
      }
    },
    [feedback, track],
  );

  const handleCellPreviewChange = useCallback((position: CellPosition | null) => {
    const activeController = controllerRef.current;
    if (position === null || inputLockedRef.current || activeController.selectedHandId === null) {
      setPreviewOrigin(null);
      return;
    }
    if (invalidPreviewTimerRef.current) {
      clearTimeout(invalidPreviewTimerRef.current);
      invalidPreviewTimerRef.current = null;
    }
    setPreviewOrigin(position);
  }, []);

  useEffect(
    () => () => {
      if (invalidPreviewTimerRef.current) {
        clearTimeout(invalidPreviewTimerRef.current);
      }
    },
    [],
  );

  const handleFreeze = useCallback(() => {
    // Guard against re-activation while active/exhausted or mid-reward — the
    // domain would reject anyway, but this avoids a needless ad request.
    if (inputLocked || !canActivateFreeze(state)) {
      return;
    }
    feedback.emit("uiTap");
    // Offer logged when the ad is actually requested; result logged from the
    // resolution (never inside onEarned, so a reward can't double-log).
    track({ name: "freeze_offer" });
    freezeOutcome.begin();
    // Whether the reward actually landed. An earned ad is not the same thing as
    // a granted reward — the domain can still reject the action — and a
    // rejected one must never be reported as a success.
    let applied = false;
    void reward
      .run(REWARD_PLACEMENTS.freeze, () => {
        if (controller.activateFreeze()) {
          applied = true;
          feedback.emit("freezeApplied");
        }
      })
      .then((result) => {
        track({ name: "freeze_result", result: rewardOutcome(result) });
        freezeOutcome.settle(result, applied);
      });
  }, [controller, feedback, freezeOutcome, inputLocked, reward, state, track]);

  const handleDefuseOpen = useCallback(() => {
    if (inputLocked || !canApplyRewardedDefuse(state)) {
      return;
    }
    clearSelection();
    setPreviewOrigin(null);
    setDefuseConfirmOpen(true);
    feedback.emit("uiTap");
  }, [clearSelection, feedback, inputLocked, state]);

  const handleDefuseCancel = useCallback(() => {
    feedback.emit("uiTap");
    setDefuseConfirmOpen(false);
  }, [feedback]);

  const handleDefuseConfirm = useCallback(() => {
    if (reward.pending) {
      return;
    }
    feedback.emit("uiTap");
    track({ name: "defuse_offer" });
    defuseOutcome.begin();
    // The piece the domain will target, read BEFORE the action is applied: once
    // defused its cells are plain blocks, so this is the only point at which the
    // effect's target can be identified. Read-only — the domain still picks the
    // target itself inside `controller.defuse()`.
    const target = getRewardedDefuseTarget(state);
    const targetCells = target ? cellsOfPiece(state.grid, target.id) : [];
    let applied = false;
    void reward
      .run(REWARD_PLACEMENTS.defuse, () => {
        if (controller.defuse()) {
          applied = true;
          feedback.emit("defusePowerUpApplied");
          // A rewarded defuse advances no turn, so the turn-keyed animator never
          // sees it — play it explicitly. The board is already updated and stays
          // usable while this presentation runs.
          animator.playCue("rewardedDefuse", targetCells);
        }
      })
      .then((result) => {
        track({ name: "defuse_result", result: rewardOutcome(result) });
        defuseOutcome.settle(result, applied);
      })
      .finally(() => {
        setDefuseConfirmOpen(false);
      });
  }, [animator, controller, defuseOutcome, feedback, reward, state, track]);

  const handleEndRun = useCallback(() => {
    if (reward.pending || resultsTransitionRef.current) {
      return;
    }
    resultsTransitionRef.current = true;
    feedback.emit("uiTap");
    onResults?.();
  }, [feedback, onResults, reward.pending]);

  const handlePause = useCallback(() => {
    // Pausing mid-reward is disallowed so the confirm/overlay stack stays sane.
    if (reward.pending) {
      return;
    }
    feedback.emit("uiTap");
    clearSelection();
    setPreviewOrigin(null);
    clearDrag();
    setPaused(true);
    void flushActiveRun();
  }, [clearDrag, clearSelection, feedback, flushActiveRun, reward.pending]);

  const handleResume = useCallback(() => {
    feedback.emit("uiTap");
    setRestartConfirmation("closed");
    setPaused(false);
  }, [feedback]);

  // Drop every transient overlay/selection so a fresh run starts clean. Shared
  // by Restart (pause menu) and leaving to Home.
  const clearPendingUi = useCallback(() => {
    setPaused(false);
    setRestartConfirmation("closed");
    setDefuseConfirmOpen(false);
    if (invalidPreviewTimerRef.current) {
      clearTimeout(invalidPreviewTimerRef.current);
      invalidPreviewTimerRef.current = null;
    }
    setPreviewOrigin(null);
    clearDrag();
    freezeOutcome.reset();
    defuseOutcome.reset();
    animator.reset();
    resetPraise();
  }, [animator, clearDrag, defuseOutcome, freezeOutcome, resetPraise]);

  const handleRestart = useCallback(() => {
    feedback.emit("uiTap");
    // A previous confirmed restart deliberately leaves its latch closed to
    // reject stale duplicate events. Reaching this button again proves the new
    // run is active and the player has opened a new confirmation cycle.
    restartTransitionRef.current = false;
    setRestartConfirmation("open");
  }, [feedback]);

  const handleRestartCancel = useCallback(() => {
    feedback.emit("uiTap");
    setRestartConfirmation("closed");
  }, [feedback]);

  const handleRestartConfirm = useCallback(() => {
    if (restartTransitionRef.current) {
      return;
    }
    restartTransitionRef.current = true;
    feedback.emit("uiTap");
    clearPendingUi();
    (onRestart ?? controller.restart)();
  }, [clearPendingUi, controller.restart, feedback, onRestart]);

  const handleHome = useCallback(() => {
    if (homeTransitionRef.current) {
      return;
    }
    homeTransitionRef.current = true;
    feedback.emit("uiTap");
    // Stay paused/input-locked until the durability boundary completes so no
    // move can land after the snapshot we intend Home to resume.
    void flushActiveRun().then(() => {
      clearPendingUi();
      onExit?.();
    });
  }, [clearPendingUi, feedback, flushActiveRun, onExit]);

  // Android Back is a screen-state action, never a route-pop action. Gameplay
  // opens Pause; Pause closes back to the exact run. A nested restart confirm
  // first cancels back to Pause, matching the explicit Cancel action.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (restartConfirmation === "open") {
        setRestartConfirmation("closed");
        return true;
      }
      if (paused) {
        handleResume();
        return true;
      }
      if (state.status === "playing") {
        handlePause();
      }
      return true;
    });
    return () => subscription.remove();
  }, [handlePause, handleResume, paused, restartConfirmation, state.status]);

  const freezeActive = state.freezeTurnsRemaining > 0;
  const defuseTarget = defuseConfirmOpen ? getRewardedDefuseTarget(state) : null;

  // Which board draws is decided at module scope (see `BoardRenderer` above),
  // because deciding it here would mean importing both renderers and so
  // initialising Skia even when the flag is off. Both accept the same props, so
  // the screen hands over one set of values and never learns which it got — the
  // flag switches a component, not a data path.
  const cinematic = CINEMATIC_RENDERER;
  const boardImpulse = cinematic ? null : animator.boardImpulse;

  return (
    <View style={[styles.screen, { backgroundColor: theme.appBackground }]} testID="game-screen">
      {/* Programmatic reactor-depth background (P1-2), full-bleed behind the
          safe-area content and never interactive. */}
      <ReactorBackground />
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        {/* Zone 1 — compact HUD, showing the persisted best score (P1-2). */}
        <ScoreHeader
          score={state.score}
          best={best}
          combo={state.combo}
          impact={scoreImpact}
          onPause={handlePause}
          reducedMotion={reducedMotion}
        />
        {/* Zones 2–4 — board / tray / action dock, kept close together so the
            board stays large and finger travel stays predictable. */}
        <View style={styles.content} onLayout={handleContentLayout} testID="gameplay-content">
          <View style={styles.boardZone} testID="gameplay-board-zone">
            {boardSide > 0 ? (
              <View
                ref={boardRef}
                collapsable={false}
                style={[styles.boardWrapper, { width: boardSide, height: boardSide }]}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.boardAmbientFrame,
                    {
                      borderColor: `${theme.boardFrameCorner}80`,
                      backgroundColor: `${theme.boardFrameCorner}08`,
                      shadowColor: theme.boardFrameCorner,
                    },
                  ]}
                  testID="board-ambient-frame"
                />
                <BoardImpulseFrame impulse={boardImpulse} reducedMotion={reducedMotion}>
                  <BoardRenderer
                    grid={state.grid}
                    badges={badges}
                    danger={danger}
                    boardSize={boardSide}
                    preview={preview}
                    onCellPress={handleCellPress}
                    onCellPreviewChange={handleCellPreviewChange}
                    onCellSizeChange={handleCellSizeChange}
                    placedCells={placement.cells}
                    placementNonce={placement.nonce}
                    highlightPieceId={defuseTarget?.id ?? null}
                    reducedMotion={reducedMotion}
                    frozen={freezeActive}
                    placementHints={placementHints}
                    // Only the cinematic renderer reads this: it draws effects
                    // inside its own canvas, so the sibling overlay below is
                    // suppressed for it. Handing the sequences to both renderers
                    // would play every beat twice.
                    effectSequences={cinematic ? animator.sequences : undefined}
                    onEffectStarted={animator.startedDrawing}
                  />
                  {/* The fallback overlay shares the board impulse wrapper so
                      cells and their feedback always move as one object. */}
                  {!cinematic ? (
                    <EffectStack
                      sequences={animator.sequences}
                      cellSize={cellSize}
                      reducedMotion={reducedMotion}
                      onStarted={animator.startedDrawing}
                    />
                  ) : null}
                </BoardImpulseFrame>
                {activePraise ? (
                  <PraiseOverlay
                    key={activePraise.id}
                    praise={activePraise}
                    reducedMotion={reducedMotion}
                    onComplete={completePraise}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={styles.trayZone} testID="gameplay-tray-zone">
            <PieceTray
              hand={state.hand}
              selectedHandId={controller.selectedHandId}
              onSelect={handleSelect}
              onPickup={handlePickup}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
              draggingHandId={drag?.handId ?? null}
              reducedMotion={reducedMotion}
              boardCellSize={cellSize}
              availableWidth={contentBox.width || boardSide || 320}
              refillNonce={refillNonce}
            />
          </View>
          <View style={styles.actionZone} testID="gameplay-action-zone">
            <RewardedActionBar
              reducedMotion={reducedMotion}
              freeze={{
                label: "FREEZE",
                glyph: "❄",
                testID: "freeze-button",
                onPress: handleFreeze,
                disabled: inputLocked || !canActivateFreeze(state),
                // Rule-unavailable (no timers to freeze / uses spent) when idle,
                // distinct from a temporary input lock.
                unavailable: !freezeActive && !canActivateFreeze(state),
                rewarded: true,
                phase: freezeOutcome.phase,
                active: freezeActive,
                placementsRemaining: state.freezeTurnsRemaining,
              }}
              defuse={{
                label: "DEFUSE",
                glyph: "⚡",
                testID: "defuse-button",
                onPress: handleDefuseOpen,
                disabled: inputLocked || (!defuseConfirmOpen && !canApplyRewardedDefuse(state)),
                unavailable: !defuseConfirmOpen && !canApplyRewardedDefuse(state),
                rewarded: true,
                phase: defuseOutcome.phase,
                selected: defuseConfirmOpen,
              }}
            />
          </View>
        </View>
        {defuseConfirmOpen ? (
          <DefuseConfirmCard
            onConfirm={handleDefuseConfirm}
            onCancel={handleDefuseCancel}
            busy={reward.pending}
            reducedMotion={reducedMotion}
          />
        ) : null}
        {paused ? (
          <PauseOverlay
            onResume={handleResume}
            onRestart={handleRestart}
            onHome={handleHome}
            reducedMotion={reducedMotion}
          />
        ) : null}
        {restartConfirmation === "open" ? (
          <RunConfirmationCard
            kind="restart"
            title="RESTART THIS RUN?"
            message="Your current run will be replaced."
            confirmLabel="RESTART"
            onConfirm={handleRestartConfirm}
            onCancel={handleRestartCancel}
            reducedMotion={reducedMotion}
          />
        ) : null}
        {state.status === "gameOver" ? (
          <GameOverOverlay
            score={state.score}
            onEndRun={handleEndRun}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </SafeAreaView>
      {drag && cellSize > 0 ? (
        <DragGhost
          key={drag.id}
          ref={ghostRef}
          shapeId={drag.shapeId}
          colorId={drag.colorId}
          cellSize={cellSize}
          initialX={drag.startX}
          initialY={drag.startY}
          valid={dragPreview?.valid ?? false}
          visualLift={drag.visualLift}
          returning={returning}
          reducedMotion={reducedMotion}
          onReturnComplete={() => clearDrag(drag.id)}
        />
      ) : null}
    </View>
  );
}

type GameScreenContentProps = {
  controllerOptions?: GameControllerOptions;
  /** Test seam: HUD best score (defaults to 0, mirroring a fresh profile). */
  best?: number;
  boardSize?: number;
  /** Test seam: inject a scripted ad service to exercise reward branches. */
  adService?: AdService;
  /** Test seam: inject a recording audio service to assert sound triggers. */
  audioService?: AudioService;
  /** Test seam: inject a recording analytics service to assert events. */
  analytics?: AnalyticsService;
  onExit?: () => void;
  onResults?: () => void;
  onRestart?: () => void;
};

/** Test entry point: builds a controller from injected options so a crafted
 *  run can be exercised without the session provider. Wraps the storage,
 *  settings, audio, and ad providers GameView depends on, all injectable. */
export function GameScreenContent({
  controllerOptions,
  best,
  boardSize,
  adService,
  audioService,
  analytics,
  onExit,
  onResults,
  onRestart,
}: GameScreenContentProps) {
  const controller = useGameController(controllerOptions);
  const storage = useMemo(() => createMemoryStorageService(), []);
  return (
    <StorageServiceProvider service={storage}>
      <AnalyticsServiceProvider service={analytics}>
        <SettingsProvider>
          <AudioServiceProvider service={audioService}>
            <AdServiceProvider service={adService}>
              <GameView
                controller={controller}
                best={best}
                boardSize={boardSize}
                onExit={onExit}
                onResults={onResults}
                onRestart={onRestart}
              />
            </AdServiceProvider>
          </AudioServiceProvider>
        </SettingsProvider>
      </AnalyticsServiceProvider>
    </StorageServiceProvider>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const { controller, startNewRun, clearActiveRun, flushActiveRun } = useGameSession();
  // Single profile read path for the HUD best score; before load this is the
  // default profile (bestScore 0), which is a safe value to display.
  const { profile } = useProfile();
  const handleExit = useCallback(() => {
    router.replace("/");
  }, [router]);
  const handleResults = useCallback(() => {
    clearActiveRun();
    router.replace("/results");
  }, [clearActiveRun, router]);
  return (
    <GameView
      controller={controller}
      best={profile.bestScore}
      flushActiveRun={flushActiveRun}
      onRestart={startNewRun}
      onExit={handleExit}
      onResults={handleResults}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    // Background color is applied inline from the active theme
    // (`theme.appBackground`) on the root View, so no static fallback here —
    // that fallback was a theme bypass masked by the inline override.
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    // Keep board/tray/dock as one compact unit. On tall phones the unit is
    // centered in the safe-area remainder rather than leaving an accidental
    // black well below it; internal gaps stay fixed, so drag travel is stable.
    justifyContent: "center",
    alignItems: "stretch",
  },
  boardZone: {
    alignItems: "center",
    justifyContent: "center",
  },
  boardWrapper: {
    alignSelf: "center",
  },
  boardAmbientFrame: {
    position: "absolute",
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderWidth: 1,
    borderRadius: 13,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  trayZone: {
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  actionZone: {
    justifyContent: "center",
    marginTop: spacing.sm,
  },
});
