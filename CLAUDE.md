# CLAUDE.md

Claude Code is the sole engineering agent for BlastDown (handover from Codex
recorded in `docs/DECISIONS.md`, 2026-10-12). This file is a concise operating
summary; `AGENTS.md` is the authoritative rule set, and product direction comes
from the approved document hierarchy beginning with `docs/PRD.md`. If this file
and `AGENTS.md` disagree, `AGENTS.md` wins.

Historical Codex ownership text in archived plans and decision records
describes how earlier work was performed. It is not a current instruction.

## Non-negotiables

- Preserve the V1 scope lock, gameplay rules (8×8 board, three-piece hand,
  move-based timers, defuse/explosion/rubble, scoring, seeded determinism),
  persistence, offline play, ads/consent, and the Google Play Closed-testing
  release. Do not change package name, versionCode, release configuration, or
  dependencies without explicit owner authorization.
- No agent changes architecture, product direction, or specifications
  silently; surface it and record an approved decision. The owner retains
  approval over gameplay rules, scope, monetization, production dependencies,
  significant architecture, release configuration, Play publication, and
  analytics/privacy integrations.
- BlastDown 2.0 is an approved post-V1 direction, but it activates no V2
  feature by itself; each feature needs explicit task authorization.
- Finish, verify, and review one bounded task before starting the next.
- Review before merge. Do not merge, force-push, or publish unless the owner
  has said to.

## Reasoning effort

MEDIUM by default. HIGH only when the owner sets it for one specific problem.
If genuinely stuck, state the exact blocker with evidence and stop; do not
widen scope on your own.

## Live validation (permanent; full text in `AGENTS.md`)

Code completion is not product completion. For any task that changes the app:

- Run typecheck, lint, relevant tests, and the full suite.
- Launch the real Android app (emulator or device) and exercise the feature
  with real interactions, including invalid and interrupted cases.
- Capture real Android screenshots and recordings; review them against approved
  references. Mockups and generated images do not count.
- Check logs for crashes and errors; measure performance only with real tools.
- Run the full gameplay regression after significant UI, graphics, animation,
  gesture, or gameplay changes.
- Keep evidence outside tracked source (or in a gitignored directory) and
  report its paths. Never fabricate screenshots, recordings, or results.
- If live testing is impossible, state the exact limitation, ask the owner for
  access, and mark the work
  `IMPLEMENTED — LIVE VALIDATION PENDING`. Only a task that meets every
  criterion is `FULLY VALIDATED`.
- Docs-only tasks skip the Android build but still run governance and
  automated checks.

Every future implementation prompt must reference this policy, repeat the
MEDIUM/HIGH workflow, and define its task-specific live tests and screenshot
evidence.
