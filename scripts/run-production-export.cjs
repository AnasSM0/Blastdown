#!/usr/bin/env node
/* Run a local production export with the same release selectors as EAS.
 * Values are read into the child process only and are never logged. */
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

function readEnv(path) {
  const values = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 1 || line.trimStart().startsWith("#")) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

const localEnv = readEnv(".env.local");
const forwardedArgs = process.argv.slice(2);
const outputArgs = forwardedArgs.includes("--output-dir")
  ? []
  : ["--output-dir", "dist/r01/production-export"];
const result = spawnSync(
  process.execPath,
  [
    require.resolve("expo/bin/cli"),
    "export",
    "--platform",
    "android",
    "--clear",
    "--source-maps",
    ...outputArgs,
    ...forwardedArgs,
  ],
  {
    env: {
      ...process.env,
      ...localEnv,
      EXPO_PUBLIC_APP_ENV: "production",
      EXPO_PUBLIC_CINEMATIC_BOARD: "0",
      BLASTDOWN_BUILD_PLATFORM: "android",
    },
    stdio: "inherit",
  },
);

process.exitCode = result.status ?? 1;
