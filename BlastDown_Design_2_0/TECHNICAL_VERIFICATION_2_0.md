# BlastDown Design 2.0 — Technical Verification and Open Decisions

**Purpose:** Separate approved product direction from unverified current code/Play facts and implementation-specific choices. Read-only repository audit is the next action; live Play Console information may still require owner screenshots/export.

## P0 — Must verify before updating authoritative specs or changing game rules

| ID | Question | Evidence and decision gate |
|---|---|---|
| TV-01 | Exact current release baseline | Current git HEAD/default branch, Closed-testing track versionCode/versionName, build ID or tag, status and clean working tree; never infer from v5 legacy audit |
| TV-02 | Authoritative repo documents | Read `AGENTS.md`, `docs/PRD.md`, `TECHNICAL_DESIGN`, `APP_FLOW`, `UI_UX_BRIEF`, `BACKEND_DESIGN`, `ENGINEERING_PLAN`, `GAME_RULES`, `DECISIONS`; preserve precedence and capture contradictions |
| TV-03 | Current engine invariants | Capture timer countdown operation order, rescue-at-1, line clear, defuse semantics, explosion/rubble events, refill/randomness, score/combo, game-over, legal placements and seed replay |
| TV-04 | Tutorial interaction parity | Verify current drag/tap flow on steps 1–2 and normal play, avoid reintroducing prior pointer/gesture bug |
| TV-05 | Storage and migration | Schema versions, active-run persistence, settings, tutorial flag; design separate progression profile/award ledger with backwards migration and rollback |
| TV-06 | Existing feature scope | Which features actually exist: Freeze, Defuse, Revive, bolts, themes, daily, ads, analytics. Distinguish dormant/test code from production paths |
| TV-07 | Actual renderer/native autolinking | Current Expo/RN, Reanimated/Worklets/Skia JS vs native inclusion, cinematic flag, gesture handling, bundle size. Rendering approach cannot be guessed |
| TV-08 | Current AdMob, UMP and ad rules | Test vs production IDs in safe nonsecret form, consent gate, actual rewarded grants/availability, whether interstitial exists but disabled |
| TV-09 | Baseline quality evidence | Test suites, static analysis, run simulations, missing device/thermal/FPS tests, crash/ANR, beta tester feedback |
| TV-10 | Existing docs vs proposals | Full conflict matrix: new Design 2.0 directions versus current locked V1 requirements and exclusion list. Owner must approve authority changes |

## P0 owner declarations required before public release (not inferable solely from code)

1. Current Play target ages and exact Families status—accurate self-declaration, not selection to bypass requirements.
2. Actual Closed-testing participant count, feedback and eligibility/status.
3. Commercial rights/redistribution rights for user-supplied ZIP references, stock HUD, Suno/reference music, generated/promotional art, fonts and voice samples. A mood reference is not a license.
4. Analytics privacy decisions: vendor, consent/opt-out UX as required, retention, transmission, Play Data Safety and privacy-policy changes.
5. Ad test approval: whether experiment has adequate size, what constitutes unacceptable interruption, exact launch default.
6. Content release priority: whether shareable codes and all daily/weekly goals are launch blockers if campaign/visual schedule runs long.

## P1 — Resolve before building vertical slice

- Device test matrix (low/mid/high RAM, GPU, Android versions, accessibility font scaling and gesture navigation), FPS frame budget and effects tier policy.
- Graphics assets format (sprite atlases, gradients, Skia native, combination), licensing, size impact, shader/bloom fallback and reduced motion.
- Event semantics for music/voice/VFX: exact core events and order; compatibility when multiple lines and explosions occur in the same move.
- Independent controls for music, sound effects, operator voice and haptics; accessibility, phone-speaker QA.
- Baseline screen capture and device telemetry of actual Closed-test game for side-by-side acceptance.

## P1 — Resolve before Campaign

- Content schema, deterministic hand strategy, ruleSetVersion/content hash and solver/test harness.
- Stage completion/failure/event criteria, 1/2/3 star definitions and assisted-record handling.
- New hazard candidates and power-up semantics approved individually.
- Persistent profile data, idempotent rewards, save migration, offline repeat attempts and time/date manipulations.
- Sector theming production asset plan, memory/bundle budget.

## P1 — Resolve before Daily/retention and analytics

- UTC or local day definition and displayed reset; cross-timezone offline behavior.
- Whether same daily puzzle is shipped via deterministic algorithm or bundled curated content; versioning across app updates.
- Streak grace, weekly start day and reward grant semantics; no implied global anti-cheat.
- Challenge code forward/backward compatibility, input validation and zero external boosters.
- Event taxonomy & measurement definitions; product analytics can be aggregated/local until provider approved.

## P1 — Resolve before ads and public build

- Rewarded Revive/Double Bolts semantics, exactly-once reward, consent and no-fill fallbacks.
- Interstitial closed-test experiment design, owner authorization, disabled default and policy review; no advertising SDK activation solely from this draft.
- Privacy page, Data Safety and age/ads declarations re-reviewed against actual new binaries and SDKs.
- New versionCode **greater** than all relevant uploaded codes for the track; don't guess an absolute next code.
- Genuine Android closed-test delivered binary smoke tests on supported devices; track transition and upgrade testing.

## Report template for Codex

For each item report `PASS / FAIL / UNKNOWN / NEEDS OWNER / NOT IMPLEMENTED`, repository path and symbol/test proof, risk, and proposed next action. Never report a manual test as passed without a device test record. For unknown access to Google Play Console, write `OWNER EVIDENCE NEEDED`, not a fabricated status.
