/** Regression tests for the graphify hook patcher.
 *
 *  Every rule here was arrived at by getting it wrong first, and each wrong
 *  version still passed a manual smoke run:
 *
 *  - Treating "file exists" as "graphify installed" made the script a silent
 *    no-op on any repo with a husky hook.
 *  - Refusing to install whenever a foreign hook existed blocked a safe append
 *    and left the repo with no graph rebuild at all.
 *  - Appending unconditionally would corrupt a hook written in Python or Node,
 *    because git runs the file under its own shebang and graphify's block is
 *    `/bin/sh`.
 *  - Replacing the first ANCHOR match would put the force flag in the foreign
 *    script above graphify's block, leaving a hook that looks patched and is not.
 *
 *  The classification and the patch transform are pure, so they are tested
 *  directly. Installation is not: it shells out to graphify and writes to
 *  `.git/hooks/`, which is not something a test suite should be doing. */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const patcher = require("../../scripts/patch-graphify-hooks.cjs") as {
  classifySource: (
    source: string | null,
    marker: string,
  ) => "missing" | "graphify" | "foreign-shell" | "foreign-other";
  patchSource: (
    source: string,
    marker: string,
    endMarker: string,
  ) => { status: "patched" | "already" | "no-anchor"; source: string };
  HOOKS: { name: string; marker: string; endMarker: string }[];
  ANCHOR: string;
  SENTINEL: string;
};

const { classifySource, patchSource, HOOKS, ANCHOR, SENTINEL } = patcher;

const MARKER = "# graphify-hook-start";
const END_MARKER = "# graphify-hook-end";

/** A minimal stand-in for what `graphify hook install` writes. */
function graphifyBlock(): string {
  return [
    "#!/bin/sh",
    MARKER,
    "# Installed by: graphify hook install",
    "",
    ANCHOR,
    "",
    'echo "rebuild"',
    "# graphify-hook-end",
  ].join("\n");
}

describe("classifying an existing hook", () => {
  it("reports a missing file", () => {
    expect(classifySource(null, MARKER)).toBe("missing");
  });

  it("recognises its own hook by the graphify marker", () => {
    expect(classifySource(graphifyBlock(), MARKER)).toBe("graphify");
  });

  it.each([
    ["#!/bin/sh", "sh"],
    ["#!/bin/bash", "bash"],
    ["#!/usr/bin/env bash", "env bash"],
    ["#!/bin/dash", "dash"],
    ["#!/bin/zsh", "zsh"],
  ])("treats %s as a shell hook graphify may append to", (shebang) => {
    const source = `${shebang}\nnpm test\n`;
    expect(classifySource(source, MARKER)).toBe("foreign-shell");
  });

  it("treats a hook with no shebang as shell, which is git's fallback", () => {
    expect(classifySource('echo "no shebang"\n', MARKER)).toBe("foreign-shell");
  });

  it.each([
    ["#!/usr/bin/env python3", "python"],
    ["#!/usr/bin/python", "python absolute"],
    ["#!/usr/bin/env node", "node"],
    ["#!/usr/bin/env ruby", "ruby"],
    ["#!/usr/bin/env pwsh", "powershell"],
  ])("refuses to append to %s, which the block would break", (shebang) => {
    // git executes the hook under this interpreter, so a /bin/sh block appended
    // below is a syntax error — the append would break a hook that worked.
    const source = `${shebang}\nprint("hi")\n`;
    expect(classifySource(source, MARKER)).toBe("foreign-other");
  });

  it("does not mistake a python hook for shell because of the word in a path", () => {
    // "/usr/bin/env" contains no shell name, but a naive substring check for
    // "sh" would match "shebang", "bash" inside "bashful", and so on. The
    // pattern is word-bounded; this pins that.
    expect(classifySource("#!/opt/pushpin/bin/runner\nx\n", MARKER)).toBe("foreign-other");
  });

  it("classifies by graphify's marker before the shebang", () => {
    // A graphify block appended under a foreign shell hook: the file's shebang
    // belongs to the other tool, but the block is ours and must be patched.
    const combined = `#!/bin/bash\nnpm test\n\n${graphifyBlock()}`;
    expect(classifySource(combined, MARKER)).toBe("graphify");
  });
});

describe("inserting the force default", () => {
  it("adds the flag inside graphify's block", () => {
    const result = patchSource(graphifyBlock(), MARKER, END_MARKER);
    expect(result.status).toBe("patched");
    expect(result.source).toContain(SENTINEL);
  });

  it("puts the flag after the anchor, not before it", () => {
    // Order is the whole point: the flag must be exported before the block that
    // reads it runs.
    const { source } = patchSource(graphifyBlock(), MARKER, END_MARKER);
    expect(source.indexOf(ANCHOR)).toBeLessThan(source.indexOf(SENTINEL));
  });

  it("is idempotent", () => {
    const once = patchSource(graphifyBlock(), MARKER, END_MARKER);
    const twice = patchSource(once.source, MARKER, END_MARKER);
    expect(twice.status).toBe("already");
    expect(twice.source).toBe(once.source);
  });

  it("patches graphify's anchor, not an identical line in a foreign hook", () => {
    // The regression that a whole-file replace would cause: the foreign script
    // sets the same variable, so a first-match replace lands above graphify's
    // block and the flag never reaches the rebuild.
    const foreign = `#!/bin/sh\n${ANCHOR}\nnpm test\n\n`;
    const { status, source } = patchSource(foreign + graphifyBlock(), MARKER, END_MARKER);

    expect(status).toBe("patched");
    expect(source.indexOf(SENTINEL)).toBeGreaterThan(source.indexOf(MARKER));
  });

  it("leaves the foreign script above the block byte-for-byte intact", () => {
    const foreign = `#!/bin/sh\n# somebody else's hook\nnpm test\n\n`;
    const { source } = patchSource(foreign + graphifyBlock(), MARKER, END_MARKER);
    expect(source.startsWith(foreign)).toBe(true);
  });

  it("does not call a mixed hook done because the flag sits above the block", () => {
    // A whole-file "already patched" test reports this file as done. The
    // sentinel is in the foreign script — a hand-rolled GRAPHIFY_FORCE
    // workaround, or a leftover from a reorganised hook — while graphify's own
    // block still lacks it, so the block that reads the flag never gets it and
    // every later run agrees there is nothing to do.
    const foreign = `#!/bin/sh\nexport GRAPHIFY_FORCE="\${GRAPHIFY_FORCE:-1}"\nnpm test\n\n`;
    const { status, source } = patchSource(foreign + graphifyBlock(), MARKER, END_MARKER);

    expect(status).toBe("patched");
    expect(source.slice(source.indexOf(MARKER))).toContain(SENTINEL);
  });

  it("reports already when the flag is inside the block", () => {
    const foreign = `#!/bin/sh\nnpm test\n\n`;
    const once = patchSource(foreign + graphifyBlock(), MARKER, END_MARKER);
    expect(patchSource(once.source, MARKER, END_MARKER).status).toBe("already");
  });

  it("ignores a sentinel in a foreign script appended BELOW the block", () => {
    // Slicing from the start marker to end-of-file is only half a scope. A hook
    // that runs after graphify's block — appended later by another tool, or a
    // hand-rolled workaround — pulls its sentinel into the slice, and the block
    // reports "already" while having no flag of its own.
    const trailing = `\n#!/bin/sh\nexport GRAPHIFY_FORCE="\${GRAPHIFY_FORCE:-1}"\nnpm test\n`;
    const { status, source } = patchSource(graphifyBlock() + trailing, MARKER, END_MARKER);

    expect(status).toBe("patched");
    const block = source.slice(source.indexOf(MARKER), source.indexOf(END_MARKER));
    expect(block).toContain(SENTINEL);
    expect(source.endsWith(trailing)).toBe(true);
  });

  it("patches a second block when only the first one has the flag", () => {
    // `graphify hook install` appends, so a file can end up with two blocks.
    // Bounding only at the start marker finds the first, sees the flag, and
    // reports the whole file done — leaving the second block unforced.
    const once = patchSource(graphifyBlock(), MARKER, END_MARKER);
    const twoBlocks = `${once.source}\n\n${graphifyBlock()}`;

    const result = patchSource(twoBlocks, MARKER, END_MARKER);
    expect(result.status).toBe("patched");
    expect(result.source.split(SENTINEL).length - 1).toBe(2);
  });

  it("reports already only when every block has the flag", () => {
    const once = patchSource(graphifyBlock(), MARKER, END_MARKER);
    const both = patchSource(`${once.source}\n\n${graphifyBlock()}`, MARKER, END_MARKER);
    expect(patchSource(both.source, MARKER, END_MARKER).status).toBe("already");
  });

  it("reports rather than guesses when the anchor is gone", () => {
    // If graphify changes its hook format, silently doing nothing would leave
    // the stale-graph bug in place with no signal.
    const withoutAnchor = graphifyBlock().replace(ANCHOR, "export OTHER=1");
    expect(patchSource(withoutAnchor, MARKER, END_MARKER).status).toBe("no-anchor");
  });

  it("reports when the marker is absent entirely", () => {
    expect(patchSource("#!/bin/sh\nnpm test\n", MARKER, END_MARKER).status).toBe("no-anchor");
  });

  it("emits shell that sets the flag only when it is unset", () => {
    // `${VAR:-1}` rather than a bare assignment, so an explicit
    // GRAPHIFY_FORCE=0 in the environment still wins.
    const { source } = patchSource(graphifyBlock(), MARKER, END_MARKER);
    expect(source).toContain('export GRAPHIFY_FORCE="${GRAPHIFY_FORCE:-1}"');
  });
});

describe("the hook table", () => {
  it("covers both hooks graphify installs, each with its own marker", () => {
    // The two hooks use different markers; reusing one would misclassify the
    // other as foreign and skip it forever.
    expect(HOOKS.map((hook) => hook.name)).toEqual(["post-commit", "post-checkout"]);
    expect(new Set(HOOKS.map((hook) => hook.marker)).size).toBe(2);
  });

  it("patches a post-checkout block through its own marker", () => {
    const checkout = HOOKS[1];
    const source = `#!/bin/sh\n${checkout.marker}\n\n${ANCHOR}\n`;
    const result = patchSource(source, checkout.marker, checkout.endMarker);
    expect(result.status).toBe("patched");
    expect(result.source).toContain(SENTINEL);
  });
});
