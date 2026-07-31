#!/usr/bin/env node
/**
 * Re-apply the `GRAPHIFY_FORCE` patch to graphify's git hooks.
 *
 * Why this script exists
 * ----------------------
 * `graphify hook install` writes `post-commit` and `post-checkout` into
 * `.git/hooks/`, which git does not track. Both hooks rebuild the knowledge
 * graph in a detached background process, and both read the force flag as:
 *
 *     _force = os.environ.get('GRAPHIFY_FORCE', '').lower() in ('1','true','yes')
 *
 * Unset by default. The rebuild then refuses to write a graph with fewer nodes
 * than the one it replaces — which is exactly what a branch switch or a commit
 * that deletes files produces. The write is rejected, the old graph survives,
 * and `graphify explain` / `graphify path` keep returning file:line for code
 * that no longer exists. A stale node is indistinguishable from a live one, and
 * because the rebuild is detached the refusal appears only in
 * ~/.cache/graphify-rebuild.log.
 *
 * Editing `.git/hooks/*` by hand fixes one clone and travels nowhere, since git
 * does not track that directory. This script makes the fix a tracked, repeatable
 * artifact: it installs the hooks when they are missing and patches them either
 * way, so `npm install` (via `prepare`) is the one entry point and a fresh clone
 * is genuinely covered rather than silently skipped.
 *
 * Safe to run at any time: it is idempotent, it only patches hooks graphify
 * actually wrote, it honours `CI` and `GRAPHIFY_NO_HOOKS=1`, and it always exits
 * 0 so it can never break `npm install`.
 *
 * CommonJS, and the pure parts are exported, so `__tests__/tooling/` can cover
 * the classification and patch rules without touching a real `.git/hooks/`.
 */

const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

/** Hooks graphify installs, with the marker proving graphify owns the file. */
const HOOKS = [
  { name: "post-commit", marker: "# graphify-hook-start" },
  { name: "post-checkout", marker: "# graphify-checkout-hook-start" },
];

/** Anchor present in both hooks, immediately after the shebang block. */
const ANCHOR = "export PYTHONHASHSEED=0";

/** Proof the patch is already applied. */
const SENTINEL = "GRAPHIFY_FORCE:-1";

const PATCH = `
# --- patched by scripts/patch-graphify-hooks.cjs -------------------------------
# A branch switch, or a commit that deletes or renames files, legitimately
# shrinks the graph -- exactly the condition the non-forced rebuild refuses to
# write. Without this the graph keeps nodes pointing at files that are gone, and
# since the rebuild is detached the refusal is only visible in
# ~/.cache/graphify-rebuild.log. An explicit GRAPHIFY_FORCE still wins.
export GRAPHIFY_FORCE="\${GRAPHIFY_FORCE:-1}"
# ------------------------------------------------------------------------------
`;

/** Interpreters that can execute the `/bin/sh` block graphify appends. */
const SHELL_SHEBANG = /^#!.*\b(sh|bash|dash|zsh|ksh|ash)\b/;

/**
 * Classify hook contents.
 *
 *   missing        no file (caller passes null)
 *   graphify       contains graphify's block, ours to patch
 *   foreign-shell  somebody else's POSIX shell hook; graphify can append to it
 *   foreign-other  somebody else's hook in another language; appending breaks it
 *
 * Existence alone is not enough. A repo can already have a `post-commit` from
 * husky, lefthook, or a hand-written script. Treating that as "installed" makes
 * the whole script a silent no-op: install is skipped because the file exists,
 * the patch is skipped because the graphify marker is absent, and nobody is told
 * the knowledge graph will never rebuild.
 *
 * The language matters because `graphify hook install` appends a `/bin/sh` block
 * to whatever is already there. Appended to a shell hook that is fine. Appended
 * to a `#!/usr/bin/env python` or Node hook, git still runs the file under the
 * original interpreter and the shell text is a syntax error — so the append
 * would break a hook that worked, on every commit, for the sake of a graph
 * rebuild. A file with no shebang is treated as shell, since that is what git
 * falls back to.
 */
function classifySource(source, marker) {
  if (source === null || source === undefined) return "missing";
  if (source.includes(marker)) return "graphify";
  const first = source.split(/\r?\n/, 1)[0] ?? "";
  if (!first.startsWith("#!")) return "foreign-shell";
  return SHELL_SHEBANG.test(first) ? "foreign-shell" : "foreign-other";
}

function classify(path, marker) {
  if (!existsSync(path)) return "missing";
  return classifySource(readFileSync(path, "utf8"), marker);
}

/**
 * Insert the force default into graphify's own block.
 *
 * Splitting at the marker matters: when graphify appends to a pre-existing hook
 * the file holds foreign script above its block, and a bare replace on the first
 * ANCHOR match could land there instead — putting the flag outside the block
 * that reads it, in a hook that still looks patched.
 *
 * The "already patched" test is scoped to that block too. A whole-file test
 * reports a mixed hook as done: the sentinel can sit in the foreign script above
 * graphify's block — a hand-rolled `GRAPHIFY_FORCE` workaround, or a leftover
 * from a hook that was reorganised — while graphify's own block still lacks it.
 * The file then looks patched to every later run and the block that actually
 * reads the flag never gets it.
 *
 * Returns `{ status, source }`. `status` is "patched", "already", or
 * "no-anchor" when graphify's block no longer contains the anchor line.
 */
function patchSource(source, marker) {
  const at = source.indexOf(marker);
  if (at === -1) return { status: "no-anchor", source };

  const head = source.slice(0, at);
  const own = source.slice(at);
  if (own.includes(SENTINEL)) return { status: "already", source };
  if (!own.includes(ANCHOR)) return { status: "no-anchor", source };

  return {
    status: "patched",
    source: head + own.replace(ANCHOR, ANCHOR + "\n" + PATCH),
  };
}

function hooksDir() {
  // `git rev-parse --git-path hooks` resolves correctly for worktrees and for a
  // custom core.hooksPath, unlike hardcoding `.git/hooks`.
  const out = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
    encoding: "utf8",
  });
  return out.trim();
}

/**
 * Install graphify's hooks when they are absent.
 *
 * A fresh clone has no graphify hooks at all: `.git/hooks/` is not tracked, so
 * nothing arrives with the checkout. Patching alone would therefore no-op on
 * exactly the machines that most need covering, and the next person to run
 * `graphify hook install` by hand would get the unpatched hooks with nothing to
 * tell them the force flag is missing. Installing here makes `npm install` the
 * single entry point, so the install and the patch cannot drift apart.
 *
 * Safe when a slot already holds somebody else's SHELL hook: `graphify hook
 * install` APPENDS its block rather than replacing it ("appended to existing
 * post-commit hook"), leaving husky, lefthook, or a hand-written script intact
 * above it. An earlier version refused to install whenever any foreign hook was
 * present, which blocked a safe install and left the repo with no graph rebuild.
 *
 * Declines when a foreign hook is in another language, because the append would
 * corrupt it. `graphify hook install` writes BOTH hooks, so one Python hook is
 * enough to make the whole command unsafe — there is no way to ask it for the
 * other slot only.
 *
 * `shell: true` because on Windows graphify is a `.exe` resolved through
 * PATHEXT, which `execFileSync` does not apply on its own. The arguments are
 * constants, so nothing user-controlled reaches the shell.
 */
function ensureHooksInstalled(dir, states) {
  if (HOOKS.every(({ name }) => states.get(name) === "graphify")) return;

  const unsafe = HOOKS.filter(({ name }) => states.get(name) === "foreign-other");
  if (unsafe.length > 0) {
    for (const { name } of unsafe) {
      console.warn(
        `[graphify hooks] ${join(dir, name)} is not a shell script, and ` +
          `\`graphify hook install\` appends a /bin/sh block to existing hooks. ` +
          `Appending would break it, so no hooks were installed. Rebuild the ` +
          `graph by hand with \`graphify update . --force\`, or port that hook ` +
          `to shell and re-run \`npm run graphify:hooks\`.`,
      );
    }
    return;
  }

  try {
    execFileSync("graphify", ["hook", "install"], {
      encoding: "utf8",
      stdio: "pipe",
      shell: true,
    });
    console.log("[graphify hooks] installed missing git hooks");
  } catch {
    console.log(
      "[graphify hooks] graphify is not installed, so the knowledge-graph git " +
        "hooks were skipped. Install graphify, then run `npm run graphify:hooks`.",
    );
  }
}

function main() {
  // Opt-outs. CI clones are throwaway and never need a rebuild-on-commit hook,
  // and a contributor who does not want hooks should not have to fight npm.
  if (process.env.CI || process.env.GRAPHIFY_NO_HOOKS === "1") return;

  let dir;
  try {
    dir = hooksDir();
  } catch {
    // Not a git repo (tarball install, CI export). Nothing to patch.
    return;
  }

  const before = new Map(
    HOOKS.map(({ name, marker }) => [name, classify(join(dir, name), marker)]),
  );
  ensureHooksInstalled(dir, before);

  for (const { name, marker } of HOOKS) {
    const path = join(dir, name);
    // Re-classify: install may have just created the file, or appended its
    // block to a foreign hook that was there first.
    const state = classify(path, marker);
    if (state === "missing") continue;
    if (state === "foreign-other") continue; // reported above, deliberately untouched
    if (state === "foreign-shell") {
      console.warn(
        `[graphify hooks] ${join(dir, name)} exists but has no graphify block, ` +
          `so the knowledge graph will not rebuild from it. Install graphify ` +
          `and re-run \`npm run graphify:hooks\`.`,
      );
      continue;
    }

    const result = patchSource(readFileSync(path, "utf8"), marker);
    if (result.status === "already") continue;
    if (result.status === "no-anchor") {
      console.warn(
        `[graphify hooks] ${name}: anchor "${ANCHOR}" not found; skipped. ` +
          `The hook format changed — re-check the force flag by hand.`,
      );
      continue;
    }

    writeFileSync(path, result.source, "utf8");
    console.log(`[graphify hooks] patched ${name} with GRAPHIFY_FORCE default`);
  }
}

// Only run when executed directly, so importing this for tests has no effect.
if (require.main === module) {
  try {
    main();
  } catch (error) {
    // Never fail the install over a convenience patch.
    console.warn(`[graphify hooks] skipped: ${error.message}`);
  }
}

module.exports = { classifySource, patchSource, HOOKS, ANCHOR, SENTINEL };
