import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { BOARD_CONTENT_INSET } from "../src/components/GameBoard";
import { EffectStack } from "../src/components/effects/EffectStack";
import { PieceTray } from "../src/components/PieceTray";
import { ReactorBackground } from "../src/components/ReactorBackground";
import { ScoreHeader } from "../src/components/ScoreHeader";
import { GameOverOverlay } from "../src/components/modals/GameOverOverlay";
import { DefuseConfirmCard } from "../src/components/modals/DefuseConfirmCard";
import { SecondChanceBanner } from "../src/components/modals/SecondChanceBanner";
import { PauseOverlay } from "../src/components/modals/PauseOverlay";
import { RunConfirmationCard } from "../src/components/modals/RunConfirmationCard";
import { RewardedActionBar } from "../src/components/RewardedActionButton";
import { DragGhost, DRAG_LIFT, type DragGhostHandle } from "../src/components/DragGhost";
import { BOARD_SIZE } from "../src/domain/board";
import type { CellPosition } from "../src/domain/placement";
import { getShapeById } from "../src/domain/shapes";
import {
  canActivateFreeze,
  canApplyRewardedDefuse,
  canRevive,
  getRewardedDefuseTarget,
  getTimerBadgePlacements,
} from "../src/domain/selectors";
// Resolved behind the build-time flag, so a build with the cinematic renderer
// off never evaluates Skia at all. See the module's own comment.
import { BoardRenderer, CINEMATIC_RENDERER } from "../src/rendering/boardRenderer";
import { dragOriginFromFinger, type BoardLayout, type Point } from "../src/ui/boardGeometry";
import { cellsOfPiece, rubbleCellsOf } from "../src/ui/effects/eventEffects";
import {
  useGameController,
  type GameController,
  type GameControllerOptions,
} from "../src/hooks/useGameController";
import { useHaptics } from "../src/hooks/useHaptics";
import { useEffectiveReducedMotion } from "../src/hooks/useEffectiveReducedMotion";
import { useEventAnimator } from "../src/hooks/useEventAnimator";
import { useGameAnalytics } from "../src/hooks/useGameAnalytics";
import { useRewardedAction } from "../src/hooks/useRewardedAction";
import { useRewardOutcome } from "../src/hooks/useRewardOutcome";
import { useAudio } from "../src/hooks/useAudio";
import { useGameAudio } from "../src/hooks/useGameAudio";
import { useTimerHaptics } from "../src/hooks/useTimerHaptics";
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

type DragState = {
  handId: string;
  shapeId: string;
  colorId: string;
  startX: number;
  startY: number;
};

type ShapeBounds = { maxRow: number; maxColumn: number };

/** Cached shape bounds.
 *
 *  A shape's bounds never change — the catalogue is static — but this ran on
 *  every pointer move of every drag, allocating two intermediate arrays (from
 *  the two `map`s) plus the bounds object each time, and spreading them into
 *  `Math.max`. That is roughly sixty allocations a second of values that were
 *  identical every time, on the one code path that has to stay ahead of a
 *  finger. There are about twelve shapes, so the cache is bounded by the
 *  catalogue and never needs clearing.
 *
 *  A plain loop rather than `map` + spread: no intermediate arrays, and no
 *  argument-count limit if a larger shape is ever added. */
const shapeBoundsCache = new Map<string, ShapeBounds | null>();

function shapeBoundsFor(shapeId: string): ShapeBounds | null {
  const cached = shapeBoundsCache.get(shapeId);
  if (cached !== undefined) {
    return cached;
  }
  const shape = getShapeById(shapeId);
  let bounds: ShapeBounds | null = null;
  if (shape) {
    let maxRow = 0;
    let maxColumn = 0;
    for (const cell of shape.cells) {
      if (cell.row > maxRow) {
        maxRow = cell.row;
      }
      if (cell.column > maxColumn) {
        maxColumn = cell.column;
      }
    }
    bounds = { maxRow, maxColumn };
  }
  shapeBoundsCache.set(shapeId, bounds);
  return bounds;
}

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

const SECOND_CHANCE_MS = 1500;
const SECOND_CHANCE_REDUCED_MS = 800;

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
  const haptics = useHaptics();
  const reducedMotion = useEffectiveReducedMotion();
  const animator = useEventAnimator({
    turn: state.turn,
    events: controller.lastEvents,
    // The grid is needed to locate a defused piece's cells: `pieceDefused`
    // carries only an id, and by the time it is handled the piece is gone from
    // the current board.
    grid: state.grid,
    reducedMotion,
  });
  const audio = useAudio();
  // Event-driven sound + music: plays each turn's effects once, loops music
  // while the game screen is mounted (both gated by persisted settings).
  useGameAudio({ turn: state.turn, events: controller.lastEvents, status: state.status });
  // Countdown-2 / countdown-1 urgent haptics, once per timer transition.
  useTimerHaptics({ turn: state.turn, events: controller.lastEvents });
  // Turn-scoped gameplay analytics (placed/line/defused/explosion/rubble),
  // logged once per turn from the domain event stream.
  useGameAnalytics({ turn: state.turn, events: controller.lastEvents });
  const { track } = useAnalytics();
  const reward = useRewardedAction({ beforeShow: flushActiveRun });
  const theme = useTheme();

  const [paused, setPaused] = useState(false);
  const [restartConfirmation, setRestartConfirmation] = useState<"closed" | "open">("closed");
  const restartTransitionRef = useRef(false);
  const homeTransitionRef = useRef(false);
  const resultsTransitionRef = useRef(false);
  // Input is locked during a required effect sequence, while a rewarded ad is
  // in flight, and while paused, so a reward can't overlap a placement or
  // another reward and no move lands behind the pause menu.
  const inputLocked = animator.isAnimating || reward.pending || paused;

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
  const [secondChance, setSecondChance] = useState(false);
  const secondChanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Transient per-action reward feedback (pending while the ad is in flight,
  // then a brief success/failure/cancelled outcome). One shared hook per action
  // so Freeze, Defuse, and Revive — and Double Bolts on the results screen —
  // present, sound, and time out identically. Presentation only.
  const freezeOutcome = useRewardOutcome(reducedMotion);
  const defuseOutcome = useRewardOutcome(reducedMotion);
  const reviveOutcome = useRewardOutcome(reducedMotion);
  const [previewOrigin, setPreviewOrigin] = useState<CellPosition | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOrigin, setDragOrigin] = useState<CellPosition | null>(null);
  const [returning, setReturning] = useState(false);
  const [cellSize, setCellSize] = useState(boardSize ? boardSizeToCell(boardSize) : 0);

  const boardRef = useRef<View>(null);
  const ghostRef = useRef<DragGhostHandle>(null);
  const boardLayoutRef = useRef<BoardLayout | null>(null);
  const cellSizeRef = useRef(cellSize);
  const lastDragOriginRef = useRef<CellPosition | null>(null);
  // The board's press handler must keep a stable identity: `controller` is a
  // fresh object every render and `inputLocked` flips on every animation,
  // pause, and reward transition — depending on either would change the prop on
  // each of those and re-render all 64 cells for something purely cosmetic.
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
      ? { cells: event.cells, nonce: state.turn }
      : { cells: [] as CellPosition[], nonce: 0 };
  }, [controller.lastEvents, state.turn]);

  const dragPreview = drag && dragOrigin ? controller.previewFor(drag.handId, dragOrigin) : null;
  const tapPreview = previewOrigin ? controller.previewAt(previewOrigin) : null;
  const preview = dragPreview ?? tapPreview;

  // Per-empty-cell anchor validity for the selected piece, for the board's
  // accessibility placement hints. Reuses the domain's own read-only preview
  // (no gameplay mutation, no duplicated rules) and is null while nothing is
  // selected, so empty cells stay silent until a piece is held. Recomputes when
  // the selection or the board changes, so the hints never go stale.
  const { previewAt, selectedHandId } = controller;
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

  const handleCellSizeChange = useCallback((size: number) => {
    cellSizeRef.current = size;
    setCellSize(size);
  }, []);

  const handleSelect = useCallback(
    (handId: string) => {
      if (inputLocked) {
        return;
      }
      setPreviewOrigin(null);
      const wasSelected = controller.selectedHandId === handId;
      controller.selectPiece(handId);
      if (!wasSelected) {
        haptics.selection();
        audio.playSfx("selection");
        track({ name: "piece_selected" });
      }
    },
    [audio, controller, haptics, inputLocked, track],
  );

  const handleCellPress = useCallback(
    (position: CellPosition) => {
      const controller = controllerRef.current;
      if (inputLockedRef.current || controller.selectedHandId === null) {
        return;
      }
      if (controller.placeAt(position)) {
        // Placement sound comes from the piecePlaced event (useGameAudio).
        setPreviewOrigin(null);
        haptics.success();
      } else {
        // Rejected by the domain: show exactly where the attempt conflicts.
        setPreviewOrigin(position);
        haptics.warning();
        audio.playSfx("invalid");
        track({ name: "piece_rejected" });
      }
    },
    [audio, haptics, track],
  );

  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y, _width, _height) => {
      const size = cellSizeRef.current;
      if (size <= 0) {
        boardLayoutRef.current = null;
        return;
      }
      boardLayoutRef.current = {
        contentLeft: x + BOARD_CONTENT_INSET,
        contentTop: y + BOARD_CONTENT_INSET,
        cellSize: size,
        pitch: size + spacing.gridGutter,
        size: BOARD_SIZE,
      };
    });
  }, []);

  const originForPoint = useCallback((shapeId: string, point: Point): CellPosition | null => {
    const layout = boardLayoutRef.current;
    const bounds = shapeBoundsFor(shapeId);
    if (!layout || !bounds) {
      return null;
    }
    return dragOriginFromFinger(point, bounds, DRAG_LIFT, layout);
  }, []);

  const handleDragStart = useCallback(
    (handId: string, point: Point) => {
      const piece = state.hand.find((candidate) => candidate.handId === handId);
      if (inputLocked || !piece || cellSizeRef.current <= 0) {
        return;
      }
      controller.clearSelection();
      setPreviewOrigin(null);
      measureBoard();
      lastDragOriginRef.current = null;
      setDragOrigin(null);
      setDrag({
        handId,
        shapeId: piece.shapeId,
        colorId: piece.colorId,
        startX: point.x,
        startY: point.y,
      });
      haptics.selection();
    },
    [controller, haptics, inputLocked, measureBoard, state.hand],
  );

  const handleDragMove = useCallback(
    (handId: string, point: Point) => {
      ghostRef.current?.moveTo(point.x, point.y);
      const piece = state.hand.find((candidate) => candidate.handId === handId);
      if (!piece) {
        return;
      }
      const origin = originForPoint(piece.shapeId, point);
      const last = lastDragOriginRef.current;
      const changed =
        (origin === null) !== (last === null) ||
        (origin !== null &&
          last !== null &&
          (origin.row !== last.row || origin.column !== last.column));
      if (changed) {
        lastDragOriginRef.current = origin;
        setDragOrigin(origin);
      }
    },
    [originForPoint, state.hand],
  );

  const clearDrag = useCallback(() => {
    setDrag(null);
    setDragOrigin(null);
    setReturning(false);
    lastDragOriginRef.current = null;
  }, []);

  const handleDragEnd = useCallback(
    (handId: string, point: Point) => {
      const piece = state.hand.find((candidate) => candidate.handId === handId);
      const origin = piece ? originForPoint(piece.shapeId, point) : null;
      // A duplicated finalize is a no-op: the piece is already gone from the
      // hand, so the domain rejects the second attempt.
      const placed = origin ? controller.place(handId, origin) : false;
      if (placed) {
        haptics.success();
        clearDrag();
      } else {
        // Dropped outside the board or onto an invalid cell: play the return
        // animation, which clears the drag on completion. A drop onto the board
        // that the domain rejected counts as a rejected placement attempt.
        haptics.warning();
        audio.playSfx("invalid");
        setReturning(true);
        if (origin) {
          track({ name: "piece_rejected" });
        }
      }
    },
    [audio, clearDrag, controller, haptics, originForPoint, state.hand, track],
  );

  const handleFreeze = useCallback(() => {
    // Guard against re-activation while active/exhausted or mid-reward — the
    // domain would reject anyway, but this avoids a needless ad request.
    if (inputLocked || !canActivateFreeze(state)) {
      return;
    }
    audio.playSfx("button");
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
          haptics.success();
          audio.playSfx("freeze");
        }
      })
      .then((result) => {
        track({ name: "freeze_result", result: rewardOutcome(result) });
        freezeOutcome.settle(result, applied);
      });
  }, [audio, controller, freezeOutcome, haptics, inputLocked, reward, state, track]);

  const handleDefuseOpen = useCallback(() => {
    if (inputLocked || !canApplyRewardedDefuse(state)) {
      return;
    }
    controller.clearSelection();
    setPreviewOrigin(null);
    setDefuseConfirmOpen(true);
    haptics.selection();
    audio.playSfx("button");
  }, [audio, controller, haptics, inputLocked, state]);

  const handleDefuseCancel = useCallback(() => {
    audio.playSfx("button");
    setDefuseConfirmOpen(false);
  }, [audio]);

  const handleDefuseConfirm = useCallback(() => {
    if (reward.pending) {
      return;
    }
    audio.playSfx("button");
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
          haptics.success();
          audio.playSfx("defuse");
          // A rewarded defuse advances no turn, so the turn-keyed animator never
          // sees it — play it explicitly. It holds no input lock: the board is
          // already updated and must stay usable.
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
  }, [animator, audio, controller, defuseOutcome, haptics, reward, state, track]);

  const clearSecondChance = useCallback(() => {
    if (secondChanceTimer.current !== null) {
      clearTimeout(secondChanceTimer.current);
      secondChanceTimer.current = null;
    }
    setSecondChance(false);
  }, []);

  const handleRevive = useCallback(() => {
    if (reward.pending || !canRevive(state)) {
      return;
    }
    audio.playSfx("button");
    track({ name: "revive_offer" });
    reviveOutcome.begin();
    // The rubble the revive is about to clear, read before it is applied — the
    // recovery wave then covers exactly the cells that were restored.
    const restoredCells = rubbleCellsOf(state.grid);
    let applied = false;
    void reward
      .run(REWARD_PLACEMENTS.revive, () => {
        if (controller.revive()) {
          applied = true;
          haptics.success();
          audio.playSfx("revive");
          // Revive advances no turn either, so the wave is played explicitly and
          // holds no input lock — play resumes the moment the domain allows it.
          animator.playCue("revive", restoredCells);
          // "SECOND CHANCE" banner over the repaired board (Stitch 10), then
          // auto-dismiss. Reduced motion shortens the hold and skips the fade.
          setSecondChance(true);
          if (secondChanceTimer.current !== null) {
            clearTimeout(secondChanceTimer.current);
          }
          secondChanceTimer.current = setTimeout(
            () => {
              secondChanceTimer.current = null;
              setSecondChance(false);
            },
            reducedMotion ? SECOND_CHANCE_REDUCED_MS : SECOND_CHANCE_MS,
          );
        }
      })
      .then((result) => {
        track({ name: "revive_result", result: rewardOutcome(result) });
        reviveOutcome.settle(result, applied);
      });
  }, [animator, audio, controller, haptics, reducedMotion, reward, reviveOutcome, state, track]);

  const handleEndRun = useCallback(() => {
    if (reward.pending || resultsTransitionRef.current) {
      return;
    }
    resultsTransitionRef.current = true;
    audio.playSfx("button");
    clearSecondChance();
    onResults?.();
  }, [audio, clearSecondChance, onResults, reward.pending]);

  const handlePause = useCallback(() => {
    // Pausing mid-reward is disallowed so the confirm/overlay stack stays sane.
    if (reward.pending) {
      return;
    }
    audio.playSfx("button");
    setPaused(true);
    void flushActiveRun();
  }, [audio, flushActiveRun, reward.pending]);

  const handleResume = useCallback(() => {
    audio.playSfx("button");
    setRestartConfirmation("closed");
    setPaused(false);
  }, [audio]);

  // Drop every transient overlay/selection so a fresh run starts clean. Shared
  // by Restart (pause menu) and leaving to Home.
  const clearPendingUi = useCallback(() => {
    setPaused(false);
    setRestartConfirmation("closed");
    setDefuseConfirmOpen(false);
    setPreviewOrigin(null);
    clearSecondChance();
    clearDrag();
    freezeOutcome.reset();
    defuseOutcome.reset();
    reviveOutcome.reset();
    animator.reset();
  }, [animator, clearDrag, clearSecondChance, defuseOutcome, freezeOutcome, reviveOutcome]);

  const handleRestart = useCallback(() => {
    audio.playSfx("button");
    // A previous confirmed restart deliberately leaves its latch closed to
    // reject stale duplicate events. Reaching this button again proves the new
    // run is active and the player has opened a new confirmation cycle.
    restartTransitionRef.current = false;
    setRestartConfirmation("open");
  }, [audio]);

  const handleRestartCancel = useCallback(() => {
    audio.playSfx("button");
    setRestartConfirmation("closed");
  }, [audio]);

  const handleRestartConfirm = useCallback(() => {
    if (restartTransitionRef.current) {
      return;
    }
    restartTransitionRef.current = true;
    audio.playSfx("button");
    clearPendingUi();
    (onRestart ?? controller.restart)();
  }, [audio, clearPendingUi, controller.restart, onRestart]);

  const handleHome = useCallback(() => {
    if (homeTransitionRef.current) {
      return;
    }
    homeTransitionRef.current = true;
    audio.playSfx("button");
    // Stay paused/input-locked until the durability boundary completes so no
    // move can land after the snapshot we intend Home to resume.
    void flushActiveRun().then(() => {
      clearPendingUi();
      onExit?.();
    });
  }, [audio, clearPendingUi, flushActiveRun, onExit]);

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
        audio.playSfx("button");
        setPaused(true);
        void flushActiveRun();
      }
      return true;
    });
    return () => subscription.remove();
  }, [audio, flushActiveRun, handleResume, paused, restartConfirmation, state.status]);

  // Cancel a pending second-chance timer on unmount. Each reward outcome clears
  // its own timer (useRewardOutcome), and the animator clears its sequence.
  useEffect(() => () => clearSecondChance(), [clearSecondChance]);

  const freezeActive = state.freezeTurnsRemaining > 0;
  const defuseTarget = defuseConfirmOpen ? getRewardedDefuseTarget(state) : null;

  // Which board draws is decided at module scope (see `BoardRenderer` above),
  // because deciding it here would mean importing both renderers and so
  // initialising Skia even when the flag is off. Both accept the same props, so
  // the screen hands over one set of values and never learns which it got — the
  // flag switches a component, not a data path.
  const cinematic = CINEMATIC_RENDERER;

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
          onPause={handlePause}
          reducedMotion={reducedMotion}
        />
        {/* Zones 2–4 — board / tray / action dock, evenly distributed so the
            board stays large while the tray and dock never drift far below it
            and the lower screen is not left empty. */}
        <View style={styles.content} onLayout={handleContentLayout}>
          <View style={styles.boardZone}>
            {boardSide > 0 ? (
              <View style={[styles.boardWrapper, { width: boardSide, height: boardSide }]}>
                <BoardRenderer
                  ref={boardRef}
                  grid={state.grid}
                  badges={badges}
                  boardSize={boardSide}
                  preview={preview}
                  onCellPress={handleCellPress}
                  onCellSizeChange={handleCellSizeChange}
                  placedCells={placement.cells}
                  placementNonce={placement.nonce}
                  explosionCount={animator.plan?.explosions.length ?? 0}
                  effectKey={animator.effectKey}
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
                {/* Cosmetic overlay, a SIBLING of the board rather than a child:
                    a new effect re-renders only this stack, never the 64 cells.
                    One layer per live effect, each keyed by its own id, so
                    effects animate and retire independently of each other. */}
                {!cinematic ? (
                  <EffectStack
                    sequences={animator.sequences}
                    cellSize={cellSize}
                    reducedMotion={reducedMotion}
                    onStarted={animator.startedDrawing}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={styles.trayZone}>
            <PieceTray
              hand={state.hand}
              selectedHandId={controller.selectedHandId}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              draggingHandId={drag?.handId ?? null}
              reducedMotion={reducedMotion}
            />
          </View>
          <View style={styles.actionZone}>
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
        {secondChance ? <SecondChanceBanner reducedMotion={reducedMotion} /> : null}
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
            reviveAvailable={canRevive(state)}
            onRevive={handleRevive}
            onEndRun={handleEndRun}
            busy={reward.pending}
            revivePhase={reviveOutcome.phase}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </SafeAreaView>
      {drag && cellSize > 0 ? (
        <DragGhost
          ref={ghostRef}
          shapeId={drag.shapeId}
          colorId={drag.colorId}
          cellSize={cellSize}
          initialX={drag.startX}
          initialY={drag.startY}
          valid={dragPreview?.valid ?? false}
          returning={returning}
          reducedMotion={reducedMotion}
          onReturnComplete={clearDrag}
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

/** Content cell size implied by a fixed outer board size (test seam parity
 *  with GameBoard's own computation). */
function boardSizeToCell(outerSize: number): number {
  const contentSize = outerSize - 2 * BOARD_CONTENT_INSET;
  return (contentSize - (BOARD_SIZE - 1) * spacing.gridGutter) / BOARD_SIZE;
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
    // Distribute the three gameplay zones so the board stays large and the
    // remaining space becomes even breathing room rather than a dead bottom gap.
    justifyContent: "space-evenly",
    alignItems: "stretch",
  },
  boardZone: {
    alignItems: "center",
    justifyContent: "center",
  },
  boardWrapper: {
    alignSelf: "center",
  },
  trayZone: {
    justifyContent: "center",
  },
  actionZone: {
    justifyContent: "center",
  },
});
