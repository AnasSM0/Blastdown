const fs = require("node:fs");
const path = require("node:path");

const KIND = "blastdown-human-playtest";
const VERSION = 1;

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percent(value) {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function collect(directory) {
  const sessions = [];
  const seen = new Set();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".json") continue;
    const file = path.join(directory, entry.name);
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (value.kind !== KIND || value.schemaVersion !== VERSION || !Array.isArray(value.sessions)) {
      process.stderr.write(`Skipped non-human or incompatible export: ${entry.name}\n`);
      continue;
    }
    for (const session of value.sessions) {
      if (typeof session.sessionId === "string" && !seen.has(session.sessionId)) {
        seen.add(session.sessionId);
        sessions.push(session);
      }
    }
  }
  return sessions;
}

function summarize(sessions) {
  const runs = sessions.flatMap((session) => (Array.isArray(session.runs) ? session.runs : []));
  const hands = runs.flatMap((run) => (Array.isArray(run.hands) ? run.hands : []));
  const replay = runs.flatMap((run) =>
    run.immediateReplay === true ? [1] : run.immediateReplay === false ? [0] : [],
  );
  const values = (key) => runs.map((run) => run[key]).filter(Number.isFinite);
  const firstValues = (key) => values(key).filter((value) => value !== null);
  const occupancies = runs.map((run) => run.gameOverContext?.occupancy).filter(Number.isFinite);
  return {
    sessions: sessions.length,
    runs: runs.length,
    medianTurns: median(values("turnsSurvived")),
    medianScore: median(values("finalScore")),
    medianFirstExplosionTurn: median(firstValues("firstExplosionTurn")),
    medianFirstNaturalDefuseTurn: median(firstValues("firstNaturalDefuseTurn")),
    immediateReplayRate: replay.length ? replay.reduce((a, b) => a + b, 0) / replay.length : null,
    repeatedHandRate: hands.length
      ? hands.filter((hand) => hand.hasDuplicate === true).length / hands.length
      : null,
    freezeUses: values("freezeUsedCount").reduce((a, b) => a + b, 0),
    defuseUses: values("defuseUsedCount").reduce((a, b) => a + b, 0),
    medianGameOverOccupancy: median(occupancies),
    errors: sessions.reduce((total, session) => total + (session.errorCount || 0), 0),
  };
}

const directory = path.resolve(process.argv[2] || "playtest-exports");
if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
  process.stderr.write(
    `Usage: npm run analyze:playtests -- <directory>\nMissing directory: ${directory}\n`,
  );
  process.exitCode = 1;
} else {
  const sessions = collect(directory);
  const cohorts = new Map();
  for (const session of sessions) {
    const renderer = session.deviceMetadata?.renderer || "unknown";
    const cohort = cohorts.get(renderer) || [];
    cohort.push(session);
    cohorts.set(renderer, cohort);
  }
  const lines = [
    "BlastDown human playtest summary",
    `Total sessions: ${sessions.length}`,
    `Renderer cohorts: ${[...cohorts.keys()].join(", ") || "none"}`,
  ];
  if (cohorts.size > 1) {
    lines.push(
      "NOTE: Renderer cohorts are reported separately and must not be interpreted as one sample.",
    );
  }
  for (const [renderer, cohort] of [...cohorts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const result = summarize(cohort);
    lines.push(
      "",
      `Renderer: ${renderer}`,
      `Sessions: ${result.sessions}`,
      `Runs: ${result.runs}`,
      `Median turns: ${result.medianTurns ?? "n/a"}`,
      `Median score: ${result.medianScore ?? "n/a"}`,
      `Median first explosion: ${result.medianFirstExplosionTurn ?? "n/a"}`,
      `Median first natural defuse: ${result.medianFirstNaturalDefuseTurn ?? "n/a"}`,
      `Immediate replay: ${percent(result.immediateReplayRate)}`,
      `Repeated-shape hands: ${percent(result.repeatedHandRate)}`,
      `Freeze uses: ${result.freezeUses}`,
      `Defuse uses: ${result.defuseUses}`,
      `Median game-over occupancy: ${percent(result.medianGameOverOccupancy)}`,
      `Errors: ${result.errors}`,
    );
  }
  process.stdout.write(lines.join("\n") + "\n");
}
