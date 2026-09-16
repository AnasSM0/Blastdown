import type { GameEvent } from "../../domain/events";
import type { GameState, HandPiece } from "../../domain/gameTypes";
import { canActivateFreeze, canApplyRewardedDefuse } from "../../domain/selectors";
import type { AnalyticsEvent } from "../../services/analytics/types";
import type { StorageService } from "../../services/storage/StorageService";
import { createPlaytestExport, parsePlaytestDataset } from "../../services/playtest/summary";
import {
  PLAYTEST_EXPORT_KIND,
  PLAYTEST_SCHEMA_VERSION,
  type EarlyGameMilestone,
  type HandEvidence,
  type PlaytestAction,
  type PlaytestDataset,
  type PlaytestDeviceMetadata,
  type PlaytestExport,
  type PlaytestRun,
  type PlaytestSession,
} from "../../services/playtest/types";

export const PLAYTEST_STORAGE_KEY = "blastdown/dev/playtest-evidence/v1";

type RuntimeRun = {
  lastRecordedTurn: number;
  lastEligibilityTurn: number;
  recordedRefills: Set<number>;
  recentOutcomes: { turn: number; explosions: number; defuses: number }[];
  unrecoveredExplosionTurns: number[];
  lastMeaningfulOutcome: "placement" | "clear" | "defuse" | "explosion" | "none";
};

export type ObserveGameInput = {
  state: GameState;
  events: readonly GameEvent[];
  hasActiveRun: boolean;
  sessionGeneration: number;
};

export type RecorderEnvironment = {
  appVersion: string;
  deviceMetadata: PlaytestDeviceMetadata;
};

type RecorderOptions = {
  now?: () => number;
  createId?: (prefix: "session" | "run") => string;
  persistDelayMs?: number;
};

const EARLY_TURNS = new Set([1, 5, 10, 20]);

function occupiedCellCount(state: GameState): number {
  let occupied = 0;
  for (const row of state.grid) {
    for (const cell of row) if (cell.kind !== "empty") occupied += 1;
  }
  return occupied;
}

function occupancy(state: GameState): number {
  const cellCount = state.grid.length * (state.grid[0]?.length ?? 0);
  return cellCount === 0 ? 0 : occupiedCellCount(state) / cellCount;
}

function rubbleCount(state: GameState): number {
  return state.grid.reduce(
    (total, row) => total + row.filter((cell) => cell.kind === "rubble").length,
    0,
  );
}

function lowestTimer(state: GameState): number | null {
  const values = Object.values(state.activeTimers).map((timer) => timer.remainingTurns);
  return values.length === 0 ? null : Math.min(...values);
}

export function describeHand(
  hand: readonly HandPiece[],
  refillIndex: number,
  boardOccupancy: number,
): HandEvidence {
  const uniqueShapeCount = new Set(hand.map((piece) => piece.shapeId)).size;
  return {
    refillIndex,
    uniqueShapeCount,
    hasDuplicate: uniqueShapeCount < hand.length,
    allThreeMatch: hand.length === 3 && uniqueShapeCount === 1,
    occupancy: boardOccupancy,
  };
}

function emptyDataset(): PlaytestDataset {
  return { schemaVersion: PLAYTEST_SCHEMA_VERSION, kind: PLAYTEST_EXPORT_KIND, sessions: [] };
}

function defaultId(prefix: "session" | "run"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneSessions(sessions: readonly PlaytestSession[]): PlaytestSession[] {
  return JSON.parse(JSON.stringify(sessions)) as PlaytestSession[];
}

export class PlaytestRecorder {
  private dataset = emptyDataset();
  private storage: StorageService | null = null;
  private environment: RecorderEnvironment | null = null;
  private hydrated = false;
  private hydrationPromise: Promise<void> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private currentSessionId: string | null = null;
  private currentRunId: string | null = null;
  private runtimeRuns = new Map<string, RuntimeRun>();
  private listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly createId: (prefix: "session" | "run") => string;
  private readonly persistDelayMs: number;

  constructor(options: RecorderOptions = {}) {
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? defaultId;
    this.persistDelayMs = options.persistDelayMs ?? 750;
  }

  configure(storage: StorageService, environment: RecorderEnvironment): Promise<void> {
    this.storage = storage;
    this.environment = environment;
    if (this.hydrationPromise) return this.hydrationPromise;
    this.hydrationPromise = this.hydrate(storage);
    return this.hydrationPromise;
  }

  private async hydrate(storage: StorageService): Promise<void> {
    try {
      const raw = await storage.getItem(PLAYTEST_STORAGE_KEY);
      if (raw) {
        const parsed = parsePlaytestDataset(JSON.parse(raw) as unknown);
        if (parsed) {
          const liveIds = new Set(this.dataset.sessions.map((session) => session.sessionId));
          this.dataset.sessions = [
            ...parsed.sessions.filter((session) => !liveIds.has(session.sessionId)),
            ...this.dataset.sessions,
          ];
        }
      }
    } catch {
      // Corrupt/unavailable development evidence must never affect gameplay.
    } finally {
      this.hydrated = true;
      this.notify();
      this.schedulePersist();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSessions(): PlaytestSession[] {
    return cloneSessions(this.dataset.sessions);
  }

  getCurrentSession(): PlaytestSession | null {
    const session = this.findCurrentSession();
    return session ? (JSON.parse(JSON.stringify(session)) as PlaytestSession) : null;
  }

  export(exportedAt = this.now()): PlaytestExport {
    return createPlaytestExport(this.getSessions(), exportedAt);
  }

  private ensureSession(): PlaytestSession {
    const current = this.findCurrentSession();
    if (current) return current;
    const environment = this.environment ?? {
      appVersion: "unknown",
      deviceMetadata: { platform: "unknown", osVersion: "unknown", renderer: "views" as const },
    };
    const session: PlaytestSession = {
      sessionId: this.createId("session"),
      appVersion: environment.appVersion,
      startedAt: this.now(),
      completedAt: null,
      tutorialCompleted: false,
      tutorialSkipped: false,
      errorCount: 0,
      deviceMetadata: environment.deviceMetadata,
      runs: [],
    };
    this.dataset.sessions.push(session);
    this.currentSessionId = session.sessionId;
    return session;
  }

  private findCurrentSession(): PlaytestSession | undefined {
    if (!this.currentSessionId) return undefined;
    return this.dataset.sessions.find((session) => session.sessionId === this.currentSessionId);
  }

  private findCurrentRun(): PlaytestRun | undefined {
    const session = this.findCurrentSession();
    if (!session || !this.currentRunId) return undefined;
    return session.runs.find((run) => run.runId === this.currentRunId);
  }

  recordAnalytics(event: AnalyticsEvent): void {
    let changed = false;
    if (event.name === "session_start") {
      if (this.findCurrentSession()?.completedAt !== null) {
        this.currentSessionId = null;
        this.currentRunId = null;
      }
      this.ensureSession();
      changed = true;
    } else if (event.name === "session_end") {
      const session = this.ensureSession();
      session.completedAt ??= this.now();
      changed = true;
    } else if (event.name === "tutorial_complete") {
      this.ensureSession().tutorialCompleted = true;
      changed = true;
    } else if (event.name === "tutorial_skip") {
      this.ensureSession().tutorialSkipped = true;
      changed = true;
    } else if (event.name === "freeze_offer") {
      const run = this.findCurrentRun();
      if (run) {
        run.freezeConsideredCount += 1;
        changed = true;
      }
    } else if (event.name === "defuse_offer") {
      const run = this.findCurrentRun();
      if (run) {
        run.defuseConsideredCount += 1;
        changed = true;
      }
    }
    if (changed) this.changed(event.name === "session_end");
  }

  recordAction(action: PlaytestAction): void {
    const run = this.findCurrentRun();
    if (run?.gameOverContext && run.immediateReplay === null) {
      run.immediateReplay = action === "play_again";
      this.changed(true);
    }
  }

  recordError(): void {
    this.ensureSession().errorCount += 1;
    this.changed();
  }

  observeGame({ state, events, hasActiveRun, sessionGeneration }: ObserveGameInput): void {
    if (!hasActiveRun && state.status !== "gameOver") return;
    const session = this.ensureSession();
    const identity = `${state.seed}:${state.startedAt}`;
    let run = session.runs.find(
      (candidate) =>
        `${candidate.seed}:${candidate.startedAt}` === identity &&
        candidate.sessionGeneration === sessionGeneration,
    );
    if (!run) {
      const previous = this.findCurrentRun();
      if (previous && previous.endedAt === null) previous.endedAt = this.now();
      run = this.createRun(state, sessionGeneration);
      session.runs.push(run);
    }
    this.currentRunId = run.runId;
    let runtime = this.runtimeRuns.get(run.runId);
    if (!runtime) {
      runtime = {
        lastRecordedTurn: Math.max(-1, run.observedFromTurn - 1),
        lastEligibilityTurn: -1,
        recordedRefills: new Set(run.hands.map((hand) => hand.refillIndex)),
        recentOutcomes: [],
        unrecoveredExplosionTurns: [],
        lastMeaningfulOutcome: "none",
      };
      this.runtimeRuns.set(run.runId, runtime);
    }

    let changed = false;
    run.turnsSurvived = Math.max(run.turnsSurvived, state.turn);
    run.finalScore = state.score;
    run.bestCombo = state.bestCombo;
    run.linesCleared = state.linesCleared;
    run.naturalDefuses = Math.max(
      run.naturalDefuses,
      state.piecesDefused - state.rewardedDefuseUses,
    );
    run.explosions = state.explosions;
    run.rubbleCleared = state.rubbleCleared;
    run.freezeUsedCount = state.rewardedFreezeUses;
    run.defuseUsedCount = state.rewardedDefuseUses;
    run.activeTimerPeak = Math.max(run.activeTimerPeak, Object.keys(state.activeTimers).length);
    run.currentActiveTimerCount = Object.keys(state.activeTimers).length;
    run.currentLowestTimer = lowestTimer(state);

    if (
      run.firstPowerUpUseTurn === null &&
      state.rewardedFreezeUses + state.rewardedDefuseUses > 0
    ) {
      run.firstPowerUpUseTurn = state.turn;
      changed = true;
    }

    if (runtime.lastEligibilityTurn !== state.turn) {
      runtime.lastEligibilityTurn = state.turn;
      if (canActivateFreeze(state)) {
        run.freezeEligibleCount += 1;
        run.firstFreezeEligibilityTurn ??= state.turn;
      }
      if (canApplyRewardedDefuse(state)) {
        run.defuseEligibleCount += 1;
        run.firstDefuseEligibilityTurn ??= state.turn;
      }
      changed = true;
    }

    if (!runtime.recordedRefills.has(state.handRefills - 1)) {
      run.hands.push(describeHand(state.hand, state.handRefills - 1, occupancy(state)));
      runtime.recordedRefills.add(state.handRefills - 1);
      run.handRefillCount = run.hands.length;
      run.repeatedShapeHandCount = run.hands.filter((hand) => hand.hasDuplicate).length;
      run.allThreeShapeHandCount = run.hands.filter((hand) => hand.allThreeMatch).length;
      changed = true;
    }

    if (state.turn > runtime.lastRecordedTurn) {
      runtime.lastRecordedTurn = state.turn;
      changed = this.recordCommittedTurn(run, runtime, state, events) || changed;
    }

    if (state.status === "gameOver" && run.gameOverContext === null) {
      run.endedAt = state.lastUpdatedAt;
      run.firstGameOverTurn = state.turn;
      const recent = runtime.recentOutcomes.filter((outcome) => outcome.turn > state.turn - 5);
      run.gameOverContext = {
        turn: state.turn,
        score: state.score,
        occupancy: occupancy(state),
        rubbleCount: rubbleCount(state),
        activeTimerCount: Object.keys(state.activeTimers).length,
        lowestTimer: lowestTimer(state),
        shapesRemaining: state.hand.map((piece) => piece.shapeId),
        legalPlacements: 0,
        explosionsPreviousFiveTurns: recent.reduce((sum, outcome) => sum + outcome.explosions, 0),
        defusesPreviousFiveTurns: recent.reduce((sum, outcome) => sum + outcome.defuses, 0),
        repeatedShapeHand: describeHand(state.hand, state.handRefills - 1, 0).hasDuplicate,
        lastMeaningfulOutcome: runtime.lastMeaningfulOutcome,
      };
      changed = true;
    }

    if (changed) this.changed(state.status === "gameOver");
  }

  private createRun(state: GameState, sessionGeneration: number): PlaytestRun {
    return {
      runId: this.createId("run"),
      sessionGeneration,
      seed: state.seed,
      startedAt: state.startedAt,
      endedAt: null,
      observedFromTurn: state.turn,
      turnsSurvived: state.turn,
      finalScore: state.score,
      bestCombo: state.bestCombo,
      linesCleared: state.linesCleared,
      multiClears: 0,
      naturalDefuses: Math.max(0, state.piecesDefused - state.rewardedDefuseUses),
      clutchDefuses: 0,
      explosions: state.explosions,
      explosionEpisodes: 0,
      explosionRecoveriesWithinFiveTurns: 0,
      firstExplosionRecoveryTurn: null,
      rubbleCreated: 0,
      rubbleCleared: state.rubbleCleared,
      activeTimerPeak: Object.keys(state.activeTimers).length,
      currentActiveTimerCount: Object.keys(state.activeTimers).length,
      currentLowestTimer: lowestTimer(state),
      handRefillCount: 0,
      repeatedShapeHandCount: 0,
      allThreeShapeHandCount: 0,
      freezeEligibleCount: 0,
      freezeConsideredCount: 0,
      freezeUsedCount: state.rewardedFreezeUses,
      defuseEligibleCount: 0,
      defuseConsideredCount: 0,
      defuseUsedCount: state.rewardedDefuseUses,
      firstTimerAssignedTurn: null,
      firstTimer2Turn: null,
      firstTimer1Turn: null,
      firstNaturalDefuseTurn: null,
      firstClutchDefuseTurn: null,
      firstExplosionTurn: null,
      firstRubbleClearTurn: null,
      firstFreezeEligibilityTurn: null,
      firstDefuseEligibilityTurn: null,
      firstPowerUpUseTurn: null,
      firstMultiClearTurn: null,
      firstGameOverTurn: null,
      earlyGameMilestones: [],
      hands: [],
      gameOverContext: null,
      immediateReplay: null,
    };
  }

  private recordCommittedTurn(
    run: PlaytestRun,
    runtime: RuntimeRun,
    state: GameState,
    events: readonly GameEvent[],
  ): boolean {
    const naturalDefuses = events.filter((event) => event.type === "pieceDefused");
    const explosionCount = events.filter((event) => event.type === "explosionStarted").length;
    const lineCount = events.reduce(
      (count, event) =>
        event.type === "linesCleared" ? count + event.rows.length + event.columns.length : count,
      0,
    );
    const rubbleCreated = events.reduce(
      (count, event) => (event.type === "rubbleCreated" ? count + event.cells.length : count),
      0,
    );
    const rubbleCleared = events.reduce(
      (count, event) => (event.type === "rubbleCleared" ? count + event.cells.length : count),
      0,
    );
    runtime.unrecoveredExplosionTurns = runtime.unrecoveredExplosionTurns.filter(
      (turn) => turn >= state.turn - 5,
    );
    if (
      state.turn > 0 &&
      (lineCount > 0 || naturalDefuses.length > 0) &&
      runtime.unrecoveredExplosionTurns.length > 0
    ) {
      run.explosionRecoveriesWithinFiveTurns += runtime.unrecoveredExplosionTurns.length;
      run.firstExplosionRecoveryTurn ??= state.turn;
      runtime.unrecoveredExplosionTurns = [];
    }

    if (events.some((event) => event.type === "piecePlaced")) {
      run.firstTimerAssignedTurn ??= state.turn;
      runtime.lastMeaningfulOutcome = "placement";
    }
    if (lineCount > 0) runtime.lastMeaningfulOutcome = "clear";
    if (lineCount >= 2) {
      run.multiClears += 1;
      run.firstMultiClearTurn ??= state.turn;
    }
    if (naturalDefuses.length > 0) {
      run.firstNaturalDefuseTurn ??= state.turn;
      runtime.lastMeaningfulOutcome = "defuse";
    }
    const clutch = naturalDefuses.filter((event) => event.remainingTurns === 1).length;
    run.clutchDefuses += clutch;
    if (clutch > 0) run.firstClutchDefuseTurn ??= state.turn;
    if (explosionCount > 0) {
      run.firstExplosionTurn ??= state.turn;
      run.explosionEpisodes += 1;
      runtime.unrecoveredExplosionTurns.push(state.turn);
      runtime.lastMeaningfulOutcome = "explosion";
    }
    run.rubbleCreated += rubbleCreated;
    if (rubbleCleared > 0) run.firstRubbleClearTurn ??= state.turn;
    for (const event of events) {
      if (event.type === "timerWarning" && event.remainingTurns === 2)
        run.firstTimer2Turn ??= state.turn;
      if (event.type === "timerWarning" && event.remainingTurns === 1)
        run.firstTimer1Turn ??= state.turn;
    }

    runtime.recentOutcomes.push({
      turn: state.turn,
      explosions: explosionCount,
      defuses: naturalDefuses.length,
    });
    runtime.recentOutcomes = runtime.recentOutcomes.filter(
      (outcome) => outcome.turn > state.turn - 5,
    );

    if (
      EARLY_TURNS.has(state.turn) &&
      !run.earlyGameMilestones.some((item) => item.turn === state.turn)
    ) {
      run.earlyGameMilestones.push({
        turn: state.turn as EarlyGameMilestone["turn"],
        score: state.score,
        occupancy: occupancy(state),
        activeTimerCount: Object.keys(state.activeTimers).length,
        lowestTimer: lowestTimer(state),
        explosions: state.explosions,
        naturalDefuses: run.naturalDefuses,
      });
    }
    return true;
  }

  private changed(flushNow = false): void {
    this.notify();
    if (flushNow) void this.flush();
    else this.schedulePersist();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // A development dashboard listener cannot be allowed to affect play.
      }
    }
  }

  private schedulePersist(): void {
    if (!this.storage || !this.hydrated || this.persistTimer || this.persistDelayMs < 0) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flush();
    }, this.persistDelayMs);
  }

  async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (!this.storage || !this.hydrated) return;
    try {
      await this.storage.setItem(PLAYTEST_STORAGE_KEY, JSON.stringify(this.dataset));
    } catch {
      // Local evidence is best-effort. Never surface a write failure to gameplay.
    }
  }

  async reset(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.dataset = emptyDataset();
    this.currentSessionId = null;
    this.currentRunId = null;
    this.runtimeRuns.clear();
    try {
      await this.storage?.removeItem(PLAYTEST_STORAGE_KEY);
    } catch {
      // Reset is development-only and isolated; a storage failure is harmless.
    }
    this.notify();
  }
}
