# BlastDown 2.0 — Staged Production and Release Roadmap

**Guiding rule:** Protect the currently shipped Closed-testing binary; new development occurs on an explicitly named branch after repo audit/owner approval. Sequential Codex tasks with review between each. Never import references merely because they look good; verify rights and mobile performance.

## Phase 0 — Baseline audit and document reconciliation

**BD2-001 read-only audit** (task in this bundle): report current repository, source/track baseline, code-vs-spec conflict matrix, test/bundle inventory, technical risks, proposed next task. No code changes, docs mutation, rebuild or upload. Owner evaluates findings.

**BD2-002 docs-only integration** *after audit*: update authoritative docs (`PRD`, `GAME_RULES`, `TECHNICAL_DESIGN`, `APP_FLOW`, `UI_UX_BRIEF`, `DECISIONS`, `ENGINEERING_PLAN`) with approved new scope while preserving frozen V1 rules. Version the decisions, update AGENTS only if necessary and authorized; no gameplay modifications. Gate: contradictions explicitly resolved.

## Phase 1 — Visual/game-feel vertical slice

1. Audit existing event/render/audio paths; establish visual acceptance fixtures and reusable effect tokens.
2. Build one representative board scene with premium tiles and high-contrast countdown badges, preserving precision and 8x8 constraints.
3. Implement/retune pickup, drag/preview/placement and clear presentation using single event source; performance-first.
4. Implement timer danger, valid critical defuse, explosion/rubble presentation; prioritized music/voice/haptic behavior.
5. Real-device AB test against current Closed-test build, including reduced-motion and offline.

**Gate:** no input regression, no false praise, no reducer changes, no material performance/thermal regression, acceptable bundle size and readable on small screens. Use owner's aesthetic approval and real device evidence; do not ship purely on emulator screenshots.

## Phase 2 — Campaign foundation: five levels

- Versioned content and objective evaluation outside existing reducer as practical.
- Separate local profile/award ledger schema with upgrade tests.
- Primary objective, stars/assisted flag, retry/rescue contract, first sector map and results.
- Five handcrafted levels with solvability and playtest review.

**Gate:** no duplicated rewards or impossible intended levels; existing endless saves migrate; tests for results and mastery.

## Phase 3 — Complete focused launch content

- Expand to 20–30 levels (suggestion: 25 across five sectors) after first sector passes usability.
- Daily shared challenge with explicit date policy, offline deterministic versioned content, no external boosters.
- Bolts inventory/earn/spend, a few achievements and daily/weekly optional missions.
- Shareable codes if schedule allows; optional cosmetic unlocks if art/QA capacity permits.

**Gate:** content validated on supported devices and offline; time boundary, idempotency, old-save upgrade, no star shortcuts.

## Phase 4 — Monetization/analytics qualification

- Verify/extend rewarded Freeze/Defuse; separately add approved Revive and Double Bolts, no lost or duplicated grants.
- Define low-data analytics event taxonomy and provider due diligence; update policy/consent/Data Safety prior to release.
- Run *optional separately authorized* interstitial Closed-test experiment with conservative caps; record qualitative feedback and honest limits of statistical power.

**Gate:** every ad fail/no-fill/close path keeps game playable; approval recorded for launch activation or disabled policy. No IAP.

## Phase 5 — Release qualification

- Verify signed AAB from current approved source, incrementing versionCode appropriately; store screenshots must be real build captures.
- Full suite: type/lint/tests, deterministic seeds, content validation, old-profile migrations, ads/consent, accessibility, small-screen layouts, app suspend/resume, offline, crash/ANR, low/mid/high hardware thermal and FPS.
- Confirm Play Console target audience and declarations actually align with SDKs and content.
- Deliver to Closed testing for qualified end-to-end QA and feedback before promotion.

**Gate:** no blocking crashes, correct core mechanics, legitimate rewards, acceptable player feedback, current Play policies addressed and owner signoff. Do not promise a launch date from this roadmap.

## Scope cuts under schedule pressure

Priority order: (1) reliable core + premium visual/feel slice, (2) high-quality Campaign 20–30, (3) fair Daily Challenge, (4) Bolts/mastery + lightweight achievements, (5) rewarded ad extensions, (6) optional share codes/cosmetics, (7) seasonal/complex LiveOps. Never cut accessibility, privacy, migration, consent or device stability. Existing Endless and existing rewarded functions stay intact unless a tested fix is authorized.

## Suggested objective metrics (set numeric goals *after* baseline)

First tutorial completion, time to understand timer, first legitimate defuse, replay rate, level attempts/clear rate, abandon reason, star distribution, ad impression→next-run, D1/D7 retention if privacy-consistent, crash-free sessions, Android vitals and measured effects FPS. Do not invent target rates or conflate tiny Closed-test samples with causal evidence.
