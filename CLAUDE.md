# CLAUDE.md

This file governs how Claude Code operates in the BlastDown repository.

## Role

Claude Code is the **lead engineer and repository orchestrator** for BlastDown, an
ad-supported mobile puzzle game built with Expo, React Native, and TypeScript.

`BUILD_SPEC.md` is the authoritative product, gameplay, architecture, and
process specification. Read it in full before starting any new phase. When
generated code, an agent recommendation, or a Codex suggestion conflicts with
`BUILD_SPEC.md`, the spec wins. Record any approved deviation in
`docs/DECISIONS.md` — do not silently diverge.

## Ownership

Claude Code owns:

- Architecture and repository structure
- The pure domain engine (`src/domain/`): shapes, seeded random, placement,
  line clearing, timers, explosions, scoring, game-over detection, power-ups
- The typed game reducer and its event output
- Persistence schemas and migrations
- Service interface contracts (ads, analytics, storage, consent, audio,
  haptics) — the interfaces, not necessarily every concrete UI-facing wiring
- Ad frequency and monetization rules
- Analytics event schema
- Test strategy across unit, component, and integration layers
- Reviewing every Codex diff before it is committed
- Running full verification before any commit
- Preventing scope creep against `BUILD_SPEC.md`

Claude Code is the only agent allowed to approve changes to:

- `BUILD_SPEC.md`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_RULES.md`
- `src/domain/**`
- Shared service interfaces
- Persistent data schemas
- Balance contracts (`src/config/balance.ts` and friends)

## Delegating to Codex

The installed Codex plugin implements small, clearly bounded frontend tasks:
screens, components, responsive layouts, touch controls, animations, visual
polish, accessibility, and UI tests. See `AGENTS.md` for the full boundary
rules and `docs/TASKS.md` for the current phase-by-phase task breakdown and
ownership tags.

Never delegate an ambiguous "build the whole game" task. Every Codex task
must be scoped to a specific numbered task in `docs/TASKS.md` and must
include, at minimum:

- Task ID
- Objective
- Documents to read first
- Files Codex may edit
- Files Codex must not edit
- Requirements
- Acceptance criteria
- Exact commands to run
- Expected return format

After Codex returns a diff, Claude Code must: inspect the entire diff, confirm
file-boundary compliance, run the required verification commands, fix or
reject any architecture violation, update `docs/TASKS.md`, and only then
commit the accepted result. Codex must not add dependencies, change domain
rules, change board size, change timer/explosion rules, add ad placements, or
touch `src/domain/**` without explicit authorization in the task.

## Codex delegation

Claude may delegate bounded tasks with:

    codex exec --sandbox workspace-write "<task>"

Rules:

- Claude remains lead engineer.
- Give Codex exact allowed and forbidden files.
- Claude and Codex must never edit the same files concurrently.
- Codex must not commit or push.
- Claude must inspect git status and git diff after every Codex task.
- Claude must run relevant tests before accepting the diff.
- Use Codex for isolated UI, tests, documentation, and mechanical refactors.
- Never delegate domain logic, gameplay balance, persistence, economy, rewards,
  ads, or release configuration.
- If apply_patch fails on Windows, Codex may use direct PowerShell file writes,
  but only inside the assigned repository files.

## Working rules

- Keep gameplay logic pure (see `docs/ARCHITECTURE.md` section on the domain
  engine). No AsyncStorage reads, animation triggers, ad SDK calls, sound, or
  navigation inside `src/domain/`.
- No hardcoded balance values in components or the reducer — everything
  balance-related lives in `src/config/balance.ts` (or a sibling config file)
  and is imported.
- Preserve seeded determinism: the same seed and the same input sequence must
  always produce the same board state.
- Maintain offline gameplay: the game must never depend on network
  availability to function. Ads may be unavailable offline; nothing else may
  break because of it.
- Do not add features outside `BUILD_SPEC.md`. When in doubt, it is out of
  scope until the spec is updated.
- Run full verification (`npm run typecheck`, `npm run lint`, `npm run test`,
  `npm run format:check`, `npx expo-doctor`) before treating any task as done.
- Record architecture and process decisions, especially any deviation from
  `BUILD_SPEC.md`, in `docs/DECISIONS.md` as they happen.
- Do not begin the next phase until the current phase's acceptance criteria
  in `docs/TASKS.md` are met and checked off.

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community
structure, and cross-file relationships. Use it to orient before reading source.

Investigate in this order — the order matters, because the tools are not equally
precise:

1. `graphify explain "<symbol>"` when the symbol name is known. Returns every
   edge with its call site. This is the sharpest tool; reach for it first.
2. `graphify path "<A>" "<B>"` when tracing between two known systems.
3. `graphify query "<question>"` only when the relevant symbol is unknown. A
   query seeds a BFS from whatever it matches — often a test file — so it can
   answer confidently around the thing you asked about.
4. Start query budgets at 1500–2500 (`--budget`) and raise only when the result
   is visibly incomplete.
5. Once graphify has identified the relevant nodes, read only the 2–6 files
   actually needed for the work.

Also:

- A truncated query result is not evidence that the omitted nodes are
  irrelevant. The cut list gives no signal about what was cut; assume the answer
  may be in it and narrow the query or raise the budget.
- Do not read the whole of `graphify-out/GRAPH_REPORT.md` for routine tasks.
  Reserve it for broad architecture review.
- If `graphify-out/wiki/index.md` exists, prefer it over raw source browsing for
  broad navigation.
- After modifying code, run `graphify update .` to keep the graph current
  (AST-only, no API cost).
- **After deleting or renaming files, run `graphify update . --force`.** Plain
  `update` refuses to write a graph with fewer nodes than the one it replaces,
  which is precisely what a deletion produces — so it silently keeps the old
  graph and leaves nodes pointing at files that no longer exist. A rename counts
  as a deletion. Stale nodes are worse than a stale graph: `explain` and `path`
  return call sites that cannot be opened, and nothing in the output says the
  source is gone.
- The git hooks (`post-commit`, `post-checkout`) rebuild in the background and
  as shipped do **not** force, so they hit the same guard: a branch switch or a
  commit that deletes files produces a smaller graph, the write is refused, and
  the graph keeps describing the branch you left. `scripts/patch-graphify-hooks.cjs`
  closes this by inserting `export GRAPHIFY_FORCE="${GRAPHIFY_FORCE:-1}"` into
  both hooks. Because `.git/hooks/` is untracked, a fresh clone has no graphify
  hooks at all, so the script **installs them when missing** and patches them
  either way — otherwise it would no-op on exactly the machines that need it.
  It runs from `npm run prepare`, so `npm install` is the one entry point; it is
  idempotent, and skips when `CI` or `GRAPHIFY_NO_HOOKS=1` is set. A hook slot
  that already holds someone else's **shell** hook (husky, lefthook,
  hand-written) is fine: `graphify hook install` appends its block below the
  existing script rather than replacing it, and the patch is applied inside
  graphify's block only. If a hook is in another language — a `#!/usr/bin/env
python` or Node hook — the script installs nothing and says so, because the
  appended `/bin/sh` block would be a syntax error under that interpreter and
  would break a working hook on every commit. Rebuild by hand there:
  `graphify update . --force`.
  `.git/hooks/` is not tracked, so **the script — not the hook — is the shipped
  fix.** Re-run it after `graphify hook uninstall`, after a graphify upgrade that
  rewrites the hooks, or whenever a rebuild looks like it kept a stale graph.
  (Plain `graphify hook install` reports "already installed" and leaves existing
  hooks alone, so it does not by itself drop the patch.)
- Hook rebuilds are detached: output goes to `~/.cache/graphify-rebuild.log` and
  a failure is invisible at the terminal. Check that log when the graph looks
  wrong after a commit or checkout.
- If a query returns a symbol you cannot find in the working tree, suspect a
  stale graph before concluding the code is missing. Rebuild with
  `graphify extract . --code-only` when in doubt; it is AST-only and costs
  nothing.
