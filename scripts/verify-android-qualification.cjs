/* Rebuild every flag from a cleared Metro cache; preserve the evidence in dist. */
/* global __dirname */
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outputRoot = path.join(root, "dist", `qualification-${Date.now()}`);
const expoCli = path.join(path.dirname(require.resolve("expo/package.json")), "bin", "cli");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  lockfileSha256: sha256(fs.readFileSync(path.join(root, "package-lock.json"))),
  exports: [],
};
fs.mkdirSync(outputRoot, { recursive: true });

for (const [label, flag] of [
  ["off-first", "0"],
  ["on", "1"],
  ["off-again", "0"],
]) {
  const output = path.join(outputRoot, label);
  const result = spawnSync(
    process.execPath,
    [
      expoCli,
      "export",
      "--platform",
      "android",
      "--clear",
      "--source-maps",
      "--output-dir",
      output,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        CI: "1",
        EXPO_NO_DOTENV: "1",
        EXPO_PUBLIC_APP_ENV: "development",
        EXPO_PUBLIC_CINEMATIC_BOARD: flag,
      },
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  const log = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  fs.writeFileSync(path.join(outputRoot, `${label}.log`), log);
  process.stdout.write(log);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${label} export failed`);
  const metadata = JSON.parse(fs.readFileSync(path.join(output, "metadata.json"), "utf8"));
  const bundlePath = path.join(output, metadata.fileMetadata.android.bundle);
  const bundle = fs.readFileSync(bundlePath);
  const sourceMap = JSON.parse(fs.readFileSync(`${bundlePath}.map`, "utf8"));
  const sources = sourceMap.sources.map((source) => source.replaceAll("\\", "/"));
  const cinematicSources = sources.filter((source) =>
    /\/rendering\/cinematic\/|\/components\/CinematicBoard\/|@shopify\/react-native-skia\//.test(
      source,
    ),
  );
  const markers = ["CinematicBoardCanvas", "buildBoardScene", "buildEffectScene"];
  const markerResults = Object.fromEntries(
    markers.map((marker) => [marker, bundle.includes(Buffer.from(marker))]),
  );
  assert.equal(
    cinematicSources.length > 0,
    flag === "1",
    `${label}: cinematic source graph mismatch`,
  );
  for (const [marker, included] of Object.entries(markerResults)) {
    assert.equal(included, flag === "1", `${label}: ${marker} mismatch`);
  }
  const record = {
    label,
    flag,
    moduleCount: Number(log.match(/\((\d+) modules\)/)?.[1]),
    bytes: bundle.length,
    sha256: sha256(bundle),
    cinematicSourceCount: cinematicSources.length,
    markers: markerResults,
  };
  assert.ok(record.moduleCount > 0, "Missing Metro module count");
  report.exports.push(record);
  fs.writeFileSync(path.join(outputRoot, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.exports[0].sha256, report.exports[2].sha256, "OFF did not reproduce after ON");
process.stdout.write(
  `\nQualification evidence: ${outputRoot}\n${JSON.stringify(report, null, 2)}\n`,
);
