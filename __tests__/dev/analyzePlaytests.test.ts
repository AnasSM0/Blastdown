/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("child_process") as {
  spawnSync: (
    command: string,
    args: string[],
    options: { encoding: string },
  ) => { status: number | null; stdout: string; stderr: string };
};
/* eslint-enable @typescript-eslint/no-require-imports */

describe("human playtest analyzer", () => {
  it("rejects simulator data and separates renderer cohorts", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/analyze-playtests.cjs", "__tests__/fixtures/playtest-exports"],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Skipped non-human or incompatible export: simulator.json");
    expect(result.stdout).toContain("Total sessions: 2");
    expect(result.stdout).toContain("Renderer: views");
    expect(result.stdout).toContain("Renderer: skia");
    expect(result.stdout).toContain("must not be interpreted as one sample");
    expect(result.stdout).not.toContain("must-not-be-counted");
  });
});
