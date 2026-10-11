# CODEX TASK: BD2-001 — READ-ONLY REPOSITORY BASELINE & DESIGN 2.0 GAP AUDIT

**Agent role:** You are the sole engineering/build agent for BlastDown. This first task is **READ-ONLY ANALYSIS**. The owner has approved the direction of Design 2.0 but has NOT authorized application modifications, dependency changes, a new native build, or ad activation.

## Goal

Inspect the live BlastDown repository and compare it with the attached `BlastDown_Design_2_0` review pack. Produce a grounded, path-specific report of what exists, what differs from the newly selected direction, what needs verification, and a safe sequence of future bounded work. **Do not implement anything in this task.**

## Source of truth and precedence

1. First read `AGENTS.md` and the repository's current authority hierarchy. Read `docs/PRD.md`, `docs/TECHNICAL_DESIGN.md`, `docs/APP_FLOW.md`, `docs/UI_UX_BRIEF.md`, `docs/BACKEND_DESIGN.md`, `docs/ENGINEERING_PLAN.md`, `docs/GAME_RULES.md`, `docs/DECISIONS.md`, and release documentation where present.
2. Read the attached new review pack, especially `README.md`, `DESIGN_DECISIONS_2_0.md`, `TECHNICAL_VERIFICATION_2_0.md` and `PRODUCTION_ROADMAP_2_0.md`.
3. Treat the review pack as **owner-approved product direction with PROPOSED values not yet implementation-authorized**. Do not overwrite locked/current reducer behavior if the new document is less specific. Record conflicts and owner decisions needed.
4. Historic `BUILD_SPEC.md`, old reports and any development-only code are context, not proof of current production behavior.

## Safety and environment guardrails

- Do NOT create or switch branches, merge, commit, tag, push or force-push.
- Do NOT modify tracked or untracked user files, install packages, change dependency lockfiles, run auto-fixes or regenerate native projects.
- Do NOT modify source, docs, app config, `.env`, credentials, AdMob, UMP, analytics, target audience, game rules, scores, balance, assets or version numbers.
- Do NOT create an AAB/APK/EAS build, upload to Play, change live Console settings or initialize SDKs with production network side effects.
- Do NOT reveal or copy secrets or real ad-unit IDs into report; refer only to presence/absence and environment variable *names*.
- Protect the existing Closed-testing binary. VersionCode and exact git source must be **verified**, not assumed to be v5 or v6.
- This is analysis only; prefer git/path grep/static inspection and existing test manifests. If safe nonmutating commands can run without creating/modifying files, you may use them. If any command would write caches or artifacts, skip and say why. `git status` must remain identical before/after.

## Audit A — baseline and release state

Report current branch, HEAD, default branch, working tree status, release tags, relevant EAS config, Android package/versionName/versionCode and known release notes. Identify what the repo can verify versus what requires owner evidence from the Play Closed-testing track. If unexpected dirty state exists, do not disturb it. Record pre/post git status.

## Audit B — engine, events and tutorial

Map source and tests for 8×8 board/three-hand, seeded RNG, line clears, timer reduction order, piece-at-1 saving, defuse and genuine `DEFUSED` event, explosion/rubble, score/combo, placements/invalid guards, tutorial drag/tap parity, game-over, Freeze/Defuse and persistence. List invariants with exact path and test names. Highlight undocumented behavior and deterministic replay risks. **Do not change domain rules.**

## Audit C — app architecture and production rendering

Inventory routes/screens, HUD/board/tray/timer components, gesture handling, effects event host, renderer fallback, existing art/assets and licensing records, audio/music/voice/haptics and reduced motion. Check current production autolinking/feature flags and dependency inclusion for Skia/Reanimated/Worklets without making changes. Identify expected size/FPS risks of adding premium 2.5D and adaptive ambience. Distinguish code availability from proven physical-device performance.

## Audit D — progression and content

Determine which of Campaign, content schema, level objective evaluation, star/mastery system, Bolts, themes, Daily Challenges, missions, achievements, share codes and versioned profile save already exist. Check any legacy dormant features separately; no resurrecting out-of-scope code without approval. Propose the smallest new architectural seams and migrations to avoid coupling progression to `GameState`. Identify the first five-level vertical slice dependency chain.

## Audit E — ads, privacy, telemetry and release readiness

List actual enabled production rewarded placements; identify whether revive, Double Bolts, interstitial, analytics, crash provider exist and are enabled, disabled or no-op. Review AdMob/UMP fail-closed behavior, exactly-once rewards, service contracts and ad-eligible mode restrictions. Identify required future privacy/Data Safety/consent updates if analytics or ad types are added; do not choose a provider or change policy. Note unknown Play target age/Families info and any owner-only validation items. Identify any CDN/remote content assumptions that conflict with offline-first play.

## Audit F — tests and gap matrix

Inventory available scripts, test suites, coverage if recorded, deterministic simulations, release smoke-test plan, and known performance gaps. Compare each `LOCKED` design decision with current code and current docs. Create a table with columns:

`Decision ID | live implementation? | exact paths/symbols/tests | gap | severity | proposed next task | needs owner?`

Use `implemented / partial / absent / unknown` only with evidence, not assumptions. For every `PROPOSED`/`VERIFY` decision do not treat it as implemented scope.

## Deliverables — stdout/report only, no repo edits

1. Executive summary: existing strengths, top 5 risks, safe next phase.
2. Verified git/build baseline and unknown Console facts.
3. Per-subsystem code map and key tests with file paths.
4. Current authority/release-doc contradictions and recommended docs-only reconciliation.
5. Full Design 2.0 gap/decision matrix and `OWNER DECISION REQUIRED` list.
6. Test/evidence gaps and suggested device/asset/license QA.
7. Proposed minimal 5–8-task Phase 1 vertical-slice sequence (task IDs, allowed paths, forbidden paths, acceptance tests, rollback path); no implementation yet.
8. Recommended **exact next single bounded task** after this audit, with a short draft prompt.
9. Final before/after `git status` proof; confirmation no file edits, package installations, builds, version changes or Play operations.

If files from the review pack aren't available in your workspace, stop and explicitly ask the owner to attach or place them; do not substitute an imagined specification.

### Acceptance criteria

- Specific evidence cited for every code assertion; no made-up device results.
- No changes to repo or published build.
- Clear distinction between approved product design, proposed implementation details and unresolved owner decisions.
- A practical minimum-risk next task, not a demand to implement the entire 2.0 game at once.
