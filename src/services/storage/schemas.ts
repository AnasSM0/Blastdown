import { GAME_STATE_VERSION } from "../../domain/game";
import type { GameState } from "../../domain/gameTypes";

/** Envelope schema versions, bumped independently of `GAME_STATE_VERSION`.
 *  The envelope version guards the persisted *shape*; the inner
 *  `state.version` guards the domain GameState shape. */
export const ACTIVE_RUN_SCHEMA_VERSION = 1;
export const PROFILE_SCHEMA_VERSION = 1;
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
  bolts: number;
  totalRuns: number;
  piecesPlaced: number;
  linesCleared: number;
  piecesDefused: number;
  explosions: number;
  rubbleCleared: number;
  bestCombo: number;
  revivesUsed: number;
  tutorialCompleted: boolean;
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

/** Structural guard for a persisted GameState. Deliberately conservative:
 *  it rejects anything whose domain `version` is not the current one (an
 *  incompatible save is discarded, never partially trusted) and checks the
 *  load-bearing fields the UI and engine index into. */
function isValidGameState(value: unknown): value is GameState {
  if (!isObject(value)) {
    return false;
  }
  if (value.version !== GAME_STATE_VERSION) {
    return false;
  }
  const numericFields = [
    "rngState",
    "turn",
    "score",
    "combo",
    "bestCombo",
    "linesCleared",
    "piecesPlaced",
    "piecesDefused",
    "explosions",
    "rubbleCleared",
    "freezeTurnsRemaining",
    "rewardedFreezeUses",
    "rewardedDefuseUses",
    "handRefills",
    "startedAt",
    "lastUpdatedAt",
  ];
  if (!numericFields.every((field) => isFiniteNumber(value[field]))) {
    return false;
  }
  if (typeof value.seed !== "string" || typeof value.status !== "string") {
    return false;
  }
  if (typeof value.reviveUsed !== "boolean") {
    return false;
  }
  if (!Array.isArray(value.grid) || !value.grid.every((row) => Array.isArray(row))) {
    return false;
  }
  if (!Array.isArray(value.hand) || !isObject(value.activeTimers)) {
    return false;
  }
  return true;
}

/** Parse a saved active run. Returns null on missing, corrupt, wrong-shape, or
 *  incompatible-version data — the caller then starts fresh (safe fallback). */
export function parseActiveRun(raw: string | null): PersistedActiveRun | null {
  const value = parseJson(raw);
  if (!isObject(value)) {
    return null;
  }
  if (value.schemaVersion !== ACTIVE_RUN_SCHEMA_VERSION) {
    // No prior versions exist yet; an unknown envelope is discarded, not trusted.
    return null;
  }
  if (!isFiniteNumber(value.seq) || !isFiniteNumber(value.savedAt)) {
    return null;
  }
  if (!isValidGameState(value.state)) {
    return null;
  }
  return {
    schemaVersion: ACTIVE_RUN_SCHEMA_VERSION,
    seq: value.seq,
    savedAt: value.savedAt,
    state: value.state,
  };
}

/** Parse the profile, falling back to a fresh default on any problem so the
 *  player is never blocked by corrupt progress. `now` seeds a fresh default. */
export function parseProfile(raw: string | null, now: number): PersistedProfile {
  const value = parseJson(raw);
  const base = defaultProfile(now);
  if (!isObject(value) || value.schemaVersion !== PROFILE_SCHEMA_VERSION) {
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
  const merged: PersistedProfile = { ...base };
  for (const key of numericKeys) {
    const candidate = value[key];
    if (isFiniteNumber(candidate)) {
      (merged[key] as number) = candidate;
    }
  }
  if (typeof value.tutorialCompleted === "boolean") {
    merged.tutorialCompleted = value.tutorialCompleted;
  }
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
