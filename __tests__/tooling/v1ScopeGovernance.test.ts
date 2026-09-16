/* Node types are intentionally not part of the app tsconfig; keep this
 * repository-governance test on narrowly typed CommonJS seams. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execFileSync } = require("child_process") as {
  execFileSync(file: string, args: string[], options: { cwd: string; encoding: "utf8" }): string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { existsSync, readFileSync } = require("fs") as {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: "utf8"): string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as {
  resolve(...paths: string[]): string;
  join(...paths: string[]): string;
};

const ROOT = path.resolve(".");
const read = (relativePath: string): string => readFileSync(path.join(ROOT, relativePath), "utf8");

const CANONICAL_DOCS = [
  "docs/PRD.md",
  "docs/TECHNICAL_DESIGN.md",
  "docs/APP_FLOW.md",
  "docs/UI_UX_BRIEF.md",
  "docs/BACKEND_DESIGN.md",
  "docs/ENGINEERING_PLAN.md",
  "docs/CODEBASE_AUDIT.md",
] as const;

describe("V1 scope and repository governance", () => {
  it("has no legacy Themes route in the production route inventory", () => {
    expect(existsSync(path.join(ROOT, "app/themes.tsx"))).toBe(false);
    expect(read("app/index.tsx")).not.toContain('router.push("/themes")');
    expect(read("app/settings.tsx")).not.toContain('router.push("/themes")');
  });

  it("declares the canonical document hierarchy and sole build-agent model", () => {
    const agents = read("AGENTS.md");
    const hierarchy = [
      "docs/PRD.md",
      "docs/TECHNICAL_DESIGN.md",
      "docs/APP_FLOW.md",
      "docs/UI_UX_BRIEF.md",
      "docs/BACKEND_DESIGN.md",
      "docs/ENGINEERING_PLAN.md",
      "docs/GAME_RULES.md",
      "docs/DECISIONS.md",
      "BUILD_SPEC.md",
    ];
    let previous = -1;
    for (const document of hierarchy) {
      const position = agents.indexOf(document);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
    expect(agents).toMatch(/Codex is the sole engineering agent/i);
    expect(agents).not.toMatch(/Claude.+lead engineer|Claude.+orchestrat/i);
  });

  it("tracks every canonical product document", () => {
    const tracked = execFileSync("git", ["ls-files"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split(/\r?\n/u)
      .map((entry) => entry.replaceAll("\\", "/"));
    for (const document of CANONICAL_DOCS) {
      expect(tracked).toContain(document);
    }
  });

  it("records the A-04 scope lock in the current product documents", () => {
    for (const document of CANONICAL_DOCS.slice(0, 6)) {
      expect(read(document)).toMatch(/A-04|V1 scope lock/i);
    }
  });
});
