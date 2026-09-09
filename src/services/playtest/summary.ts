import {
  PLAYTEST_EXPORT_KIND,
  PLAYTEST_SCHEMA_VERSION,
  type PlaytestDataset,
  type PlaytestExport,
  type PlaytestSession,
  type PlaytestSummary,
} from "./types";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function summarizePlaytests(sessions: readonly PlaytestSession[]): PlaytestSummary {
  const runs = sessions.flatMap((session) => session.runs);
  const replayAnswers = runs.flatMap((run) =>
    run.immediateReplay === null ? [] : [run.immediateReplay ? 1 : 0],
  );
  const hands = runs.flatMap((run) => run.hands);
  return {
    sessions: sessions.length,
    runs: runs.length,
    medianTurns: median(runs.map((run) => run.turnsSurvived)),
    medianScore: median(runs.map((run) => run.finalScore)),
    medianFirstExplosionTurn: median(
      runs.flatMap((run) => (run.firstExplosionTurn === null ? [] : [run.firstExplosionTurn])),
    ),
    medianFirstNaturalDefuseTurn: median(
      runs.flatMap((run) =>
        run.firstNaturalDefuseTurn === null ? [] : [run.firstNaturalDefuseTurn],
      ),
    ),
    immediateReplayRate:
      replayAnswers.length === 0
        ? null
        : replayAnswers.reduce((sum, value) => sum + value, 0) / replayAnswers.length,
    repeatedHandRate:
      hands.length === 0 ? null : hands.filter((hand) => hand.hasDuplicate).length / hands.length,
    freezeUses: runs.reduce((sum, run) => sum + run.freezeUsedCount, 0),
    defuseUses: runs.reduce((sum, run) => sum + run.defuseUsedCount, 0),
    medianGameOverOccupancy: median(
      runs.flatMap((run) => (run.gameOverContext ? [run.gameOverContext.occupancy] : [])),
    ),
    errorCount: sessions.reduce((sum, session) => sum + session.errorCount, 0),
  };
}

export function createPlaytestExport(
  sessions: readonly PlaytestSession[],
  exportedAt: number,
): PlaytestExport {
  return {
    schemaVersion: PLAYTEST_SCHEMA_VERSION,
    kind: PLAYTEST_EXPORT_KIND,
    exportedAt,
    sessions: [...sessions],
    summary: summarizePlaytests(sessions),
  };
}

export function parsePlaytestDataset(value: unknown): PlaytestDataset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<PlaytestDataset>;
  if (
    candidate.schemaVersion !== PLAYTEST_SCHEMA_VERSION ||
    candidate.kind !== PLAYTEST_EXPORT_KIND ||
    !Array.isArray(candidate.sessions)
  ) {
    return null;
  }
  return candidate as PlaytestDataset;
}
