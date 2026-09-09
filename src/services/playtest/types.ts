export const PLAYTEST_SCHEMA_VERSION = 1 as const;
export const PLAYTEST_EXPORT_KIND = "blastdown-human-playtest" as const;

export type PlaytestRenderer = "views" | "skia";

export type PlaytestDeviceMetadata = {
  platform: "android" | "ios" | "web" | "unknown";
  osVersion: string;
  renderer: PlaytestRenderer;
};

export type HandEvidence = {
  refillIndex: number;
  uniqueShapeCount: number;
  hasDuplicate: boolean;
  allThreeMatch: boolean;
  occupancy: number;
};

export type EarlyGameMilestone = {
  turn: 1 | 5 | 10 | 20;
  score: number;
  occupancy: number;
  activeTimerCount: number;
  lowestTimer: number | null;
  explosions: number;
  naturalDefuses: number;
};

export type GameOverContext = {
  turn: number;
  score: number;
  occupancy: number;
  rubbleCount: number;
  activeTimerCount: number;
  lowestTimer: number | null;
  shapesRemaining: string[];
  legalPlacements: 0;
  explosionsPreviousFiveTurns: number;
  defusesPreviousFiveTurns: number;
  repeatedShapeHand: boolean;
  lastMeaningfulOutcome: "placement" | "clear" | "defuse" | "explosion" | "none";
};

export type PlaytestRun = {
  runId: string;
  sessionGeneration: number;
  seed: string;
  startedAt: number;
  endedAt: number | null;
  observedFromTurn: number;
  turnsSurvived: number;
  finalScore: number;
  bestCombo: number;
  linesCleared: number;
  multiClears: number;
  naturalDefuses: number;
  clutchDefuses: number;
  explosions: number;
  explosionEpisodes: number;
  explosionRecoveriesWithinFiveTurns: number;
  firstExplosionRecoveryTurn: number | null;
  rubbleCreated: number;
  rubbleCleared: number;
  activeTimerPeak: number;
  currentActiveTimerCount: number;
  currentLowestTimer: number | null;
  handRefillCount: number;
  repeatedShapeHandCount: number;
  allThreeShapeHandCount: number;
  freezeEligibleCount: number;
  freezeConsideredCount: number;
  freezeUsedCount: number;
  defuseEligibleCount: number;
  defuseConsideredCount: number;
  defuseUsedCount: number;
  firstTimerAssignedTurn: number | null;
  firstTimer2Turn: number | null;
  firstTimer1Turn: number | null;
  firstNaturalDefuseTurn: number | null;
  firstClutchDefuseTurn: number | null;
  firstExplosionTurn: number | null;
  firstRubbleClearTurn: number | null;
  firstFreezeEligibilityTurn: number | null;
  firstDefuseEligibilityTurn: number | null;
  firstPowerUpUseTurn: number | null;
  firstMultiClearTurn: number | null;
  firstGameOverTurn: number | null;
  earlyGameMilestones: EarlyGameMilestone[];
  hands: HandEvidence[];
  gameOverContext: GameOverContext | null;
  immediateReplay: boolean | null;
};

export type PlaytestSession = {
  sessionId: string;
  appVersion: string;
  startedAt: number;
  completedAt: number | null;
  tutorialCompleted: boolean;
  tutorialSkipped: boolean;
  errorCount: number;
  deviceMetadata: PlaytestDeviceMetadata;
  runs: PlaytestRun[];
};

export type PlaytestDataset = {
  schemaVersion: typeof PLAYTEST_SCHEMA_VERSION;
  kind: typeof PLAYTEST_EXPORT_KIND;
  sessions: PlaytestSession[];
};

export type PlaytestSummary = {
  sessions: number;
  runs: number;
  medianTurns: number | null;
  medianScore: number | null;
  medianFirstExplosionTurn: number | null;
  medianFirstNaturalDefuseTurn: number | null;
  immediateReplayRate: number | null;
  repeatedHandRate: number | null;
  freezeUses: number;
  defuseUses: number;
  medianGameOverOccupancy: number | null;
  errorCount: number;
};

export type PlaytestExport = PlaytestDataset & {
  exportedAt: number;
  summary: PlaytestSummary;
};

export type PlaytestAction = "results_home" | "play_again";
