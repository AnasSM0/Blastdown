import {
  FREEZE_PLACEMENTS,
  HAND_SIZE,
  MAX_REWARDED_DEFUSES_PER_RUN,
  MAX_REWARDED_FREEZES_PER_RUN,
  PIECE_COLOR_IDS,
  REVIVE_TIMER_CAP,
} from "../../config/balance";
import { BOARD_SIZE } from "../../domain/board";
import { GAME_STATE_VERSION } from "../../domain/game";
import type { GameState } from "../../domain/gameTypes";
import { SHAPE_CATALOG } from "../../domain/shapes";
import { DEFAULT_UNLOCKED_THEME_IDS, sanitizeUnlocked } from "../../economy/themeCatalog";

/** Envelope schema versions, bumped independently of `GAME_STATE_VERSION`.
 *  The envelope version guards the persisted *shape*; the inner
 *  `state.version` guards the domain GameState shape. */
export const ACTIVE_RUN_SCHEMA_VERSION = 2;
/** v2 added legacy theme ownership; fields remain parseable but dormant in V1. */
export const PROFILE_SCHEMA_VERSION = 2;
export const SETTINGS_SCHEMA_VERSION = 1;

/** A saved, resumable run. `seq` is a monotonic per-session counter used to
 *  drop stale async writes; `savedAt` is wall-clock for diagnostics only —
 *  move-based timers do not advance while closed, so no elapsed-time math. */
export type PersistedActiveRun = {
  schemaVersion: number;
  seq: number;
  savedAt: number;
  state: GameState;
};

/** Player profile — persisted entirely separately from GameState (no profile
 *  or Bolts field ever lives on GameState). */
export type PersistedProfile = {
  schemaVersion: number;
  bestScore: number;
  /** @deprecated Backward-compatible parse-only economy field. */
  bolts: number;
  totalRuns: number;
  piecesPlaced: number;
  linesCleared: number;
  piecesDefused: number;
  explosions: number;
  rubbleCleared: number;
  bestCombo: number;
  /** @deprecated Backward-compatible parse-only legacy statistic. */
  revivesUsed: number;
  tutorialCompleted: boolean;
  /** @deprecated Backward-compatible parse-only theme ownership. */
  unlockedThemeIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type PersistedSettings = {
  schemaVersion: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  /** null = follow the OS reduced-motion setting; true/false = explicit override. */
  reducedMotionOverride: boolean | null;
  /** @deprecated Backward-compatible parse-only theme selection. */
  themeId: string;
};

export const DEFAULT_THEME_ID = "neon-reactor";

export function defaultProfile(now: number): PersistedProfile {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    bestScore: 0,
    bolts: 0,
    totalRuns: 0,
    piecesPlaced: 0,
    linesCleared: 0,
    piecesDefused: 0,
    explosions: 0,
    rubbleCleared: 0,
    bestCombo: 0,
    revivesUsed: 0,
    tutorialCompleted: false,
    unlockedThemeIds: [...DEFAULT_UNLOCKED_THEME_IDS],
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultSettings(): PersistedSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    soundEnabled: true,
    musicEnabled: true,
    hapticsEnabled: true,
    reducedMotionOverride: null,
    themeId: DEFAULT_THEME_ID,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseJson(raw: string | null): unknown {
  if (raw === null) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const GAME_STATUSES = new Set<GameState["status"]>([
  "ready",
  "playing",
  "paused",
  "resolving",
  "gameOver",
  "awaitingRevive",
  "finished",
]);
const SHAPE_IDS = new Set(SHAPE_CATALOG.map((shape) => shape.id));
const COLOR_IDS = new Set<string>(PIECE_COLOR_IDS);

type TimedCellReference = {
  count: number;
  colorId: string;
};

/** Deep structural and relational guard for every persisted field consumed by
 * the reducer/selectors. It rejects partial or invented gameplay state instead
 * of normalizing it. No migration is performed here. */
export function isValidGameState(value: unknown): value is GameState {
  if (!isRecord(value)) {
    return false;
  }
  if (value.version !== GAME_STATE_VERSION) {
    return false;
  }
  const nonNegativeIntegerFields = [
    "turn",
    "score",
    "combo",
    "bestCombo",
    "linesCleared",
    "piecesPlaced",
    "piecesDefused",
    "explosions",
    "rubbleCleared",
    "handRefills",
    "startedAt",
    "lastUpdatedAt",
  ] as const;
  if (!nonNegativeIntegerFields.every((field) => isNonNegativeInteger(value[field]))) {
    return false;
  }
  if (
    !isIntegerInRange(value.rngState, -2_147_483_648, 2_147_483_647) ||
    !isIntegerInRange(value.freezeTurnsRemaining, 0, FREEZE_PLACEMENTS) ||
    !isIntegerInRange(value.rewardedFreezeUses, 0, MAX_REWARDED_FREEZES_PER_RUN) ||
    !isIntegerInRange(value.rewardedDefuseUses, 0, MAX_REWARDED_DEFUSES_PER_RUN)
  ) {
    return false;
  }
  if (
    !isNonEmptyString(value.seed) ||
    typeof value.status !== "string" ||
    !GAME_STATUSES.has(value.status as GameState["status"]) ||
    typeof value.reviveUsed !== "boolean"
  ) {
    return false;
  }
  if (
    value.piecesPlaced !== value.turn ||
    (value.bestCombo as number) < (value.combo as number) ||
    (value.lastUpdatedAt as number) < (value.startedAt as number)
  ) {
    return false;
  }
  if (value.lastExplosionId !== undefined && !isNonEmptyString(value.lastExplosionId)) {
    return false;
  }

  if (
    !Array.isArray(value.grid) ||
    value.grid.length !== BOARD_SIZE ||
    !value.grid.every((row) => Array.isArray(row) && row.length === BOARD_SIZE)
  ) {
    return false;
  }

  const timedCells = new Map<string, TimedCellReference>();
  for (const row of value.grid) {
    for (const cell of row) {
      if (!isRecord(cell) || typeof cell.kind !== "string") {
        return false;
      }
      switch (cell.kind) {
        case "empty":
          break;
        case "normal":
          if (typeof cell.colorId !== "string" || !COLOR_IDS.has(cell.colorId)) {
            return false;
          }
          break;
        case "timed": {
          if (
            !isNonEmptyString(cell.pieceInstanceId) ||
            typeof cell.colorId !== "string" ||
            !COLOR_IDS.has(cell.colorId)
          ) {
            return false;
          }
          const current = timedCells.get(cell.pieceInstanceId);
          if (current && current.colorId !== cell.colorId) {
            return false;
          }
          timedCells.set(cell.pieceInstanceId, {
            count: (current?.count ?? 0) + 1,
            colorId: cell.colorId,
          });
          break;
        }
        case "rubble":
          if (!isNonEmptyString(cell.explosionId)) {
            return false;
          }
          break;
        default:
          return false;
      }
    }
  }

  if (!Array.isArray(value.hand) || value.hand.length < 1 || value.hand.length > HAND_SIZE) {
    return false;
  }
  const handIds = new Set<string>();
  for (const piece of value.hand) {
    if (
      !isRecord(piece) ||
      !isNonEmptyString(piece.handId) ||
      typeof piece.shapeId !== "string" ||
      !SHAPE_IDS.has(piece.shapeId) ||
      typeof piece.colorId !== "string" ||
      !COLOR_IDS.has(piece.colorId) ||
      handIds.has(piece.handId)
    ) {
      return false;
    }
    handIds.add(piece.handId);
  }

  if (!isRecord(value.activeTimers)) {
    return false;
  }
  const timerIds = new Set<string>();
  for (const [key, timer] of Object.entries(value.activeTimers)) {
    if (
      !isRecord(timer) ||
      !isNonEmptyString(timer.id) ||
      timer.id !== key ||
      typeof timer.shapeId !== "string" ||
      !SHAPE_IDS.has(timer.shapeId) ||
      !isIntegerInRange(timer.remainingTurns, 1, REVIVE_TIMER_CAP) ||
      !isIntegerInRange(timer.placedOnTurn, 1, value.turn as number) ||
      typeof timer.colorId !== "string" ||
      !COLOR_IDS.has(timer.colorId)
    ) {
      return false;
    }
    const cells = timedCells.get(timer.id);
    const shape = SHAPE_CATALOG.find((candidate) => candidate.id === timer.shapeId);
    if (!cells || cells.colorId !== timer.colorId || !shape || cells.count > shape.cells.length) {
      return false;
    }
    timerIds.add(timer.id);
  }
  if ([...timedCells.keys()].some((pieceId) => !timerIds.has(pieceId))) {
    return false;
  }

  return true;
}

export type ActiveRunInvalidReason =
  "invalid_json" | "invalid_envelope" | "unsupported_schema" | "invalid_game_state";

export type ActiveRunParseResult =
  | { kind: "missing" }
  | { kind: "invalid"; reason: ActiveRunInvalidReason }
  | { kind: "valid"; value: PersistedActiveRun; migratedFrom?: number };

/** Pure schema migration. V1 and V2 carry the same gameplay fields; V2 marks
 * that the envelope is subject to the deep validation contract. No state is
 * synthesized, defaulted, or otherwise repaired. */
export function migrateActiveRunEnvelope(
  value: Record<string, unknown>,
): Record<string, unknown> | null {
  if (value.schemaVersion === ACTIVE_RUN_SCHEMA_VERSION) {
    return { ...value };
  }
  if (value.schemaVersion === 1) {
    return { ...value, schemaVersion: ACTIVE_RUN_SCHEMA_VERSION };
  }
  return null;
}

/** Parse, migrate, and deeply validate an active-run envelope while retaining
 * a safe failure reason for diagnostics. This function is pure. */
export function inspectActiveRun(raw: string | null): ActiveRunParseResult {
  if (raw === null) {
    return { kind: "missing" };
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { kind: "invalid", reason: "invalid_json" };
  }
  if (!isRecord(decoded) || !isNonNegativeInteger(decoded.schemaVersion)) {
    return { kind: "invalid", reason: "invalid_envelope" };
  }
  const originalVersion = decoded.schemaVersion;
  const migrated = migrateActiveRunEnvelope(decoded);
  if (!migrated) {
    return { kind: "invalid", reason: "unsupported_schema" };
  }
  if (!isNonNegativeInteger(migrated.seq) || !isNonNegativeInteger(migrated.savedAt)) {
    return { kind: "invalid", reason: "invalid_envelope" };
  }
  if (!isValidGameState(migrated.state)) {
    return { kind: "invalid", reason: "invalid_game_state" };
  }
  const value: PersistedActiveRun = {
    schemaVersion: ACTIVE_RUN_SCHEMA_VERSION,
    seq: migrated.seq,
    savedAt: migrated.savedAt,
    state: migrated.state,
  };
  return originalVersion === ACTIVE_RUN_SCHEMA_VERSION
    ? { kind: "valid", value }
    : { kind: "valid", value, migratedFrom: originalVersion };
}

/** Parse a saved active run. Returns null on missing, corrupt, wrong-shape, or
 *  incompatible-version data — the caller then starts fresh (safe fallback). */
export function parseActiveRun(raw: string | null): PersistedActiveRun | null {
  const result = inspectActiveRun(raw);
  return result.kind === "valid" ? result.value : null;
}

/** Parse the profile, falling back to a fresh default on any problem so the
 *  player is never blocked by corrupt progress. `now` seeds a fresh default. */
export function parseProfile(raw: string | null, now: number): PersistedProfile {
  const value = parseJson(raw);
  const base = defaultProfile(now);
  if (!isObject(value)) {
    return base;
  }
  // Accept the current version and migrate the one prior version forward,
  // preserving Bolts and all stats. Any other/unknown version is discarded.
  if (value.schemaVersion !== PROFILE_SCHEMA_VERSION && value.schemaVersion !== 1) {
    return base;
  }
  const numericKeys: (keyof PersistedProfile)[] = [
    "bestScore",
    "bolts",
    "totalRuns",
    "piecesPlaced",
    "linesCleared",
    "piecesDefused",
    "explosions",
    "rubbleCleared",
    "bestCombo",
    "revivesUsed",
    "createdAt",
    "updatedAt",
  ];
  const merged: PersistedProfile = { ...base, schemaVersion: PROFILE_SCHEMA_VERSION };
  for (const key of numericKeys) {
    const candidate = value[key];
    if (isFiniteNumber(candidate)) {
      (merged[key] as number) = candidate;
    }
  }
  if (typeof value.tutorialCompleted === "boolean") {
    merged.tutorialCompleted = value.tutorialCompleted;
  }
  // v1 has no unlockedThemeIds — sanitize(undefined) yields the defaults.
  // v2 (or corrupt) ownership is normalized to a safe list.
  merged.unlockedThemeIds = sanitizeUnlocked(value.unlockedThemeIds);
  return merged;
}

/** Parse settings, falling back to defaults per-field on any problem. */
export function parseSettings(raw: string | null): PersistedSettings {
  const value = parseJson(raw);
  const base = defaultSettings();
  if (!isObject(value) || value.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
    return base;
  }
  const merged: PersistedSettings = { ...base };
  for (const key of ["soundEnabled", "musicEnabled", "hapticsEnabled"] as const) {
    if (typeof value[key] === "boolean") {
      merged[key] = value[key] as boolean;
    }
  }
  if (value.reducedMotionOverride === null || typeof value.reducedMotionOverride === "boolean") {
    merged.reducedMotionOverride = value.reducedMotionOverride;
  }
  if (typeof value.themeId === "string" && value.themeId.length > 0) {
    merged.themeId = value.themeId;
  }
  return merged;
}
