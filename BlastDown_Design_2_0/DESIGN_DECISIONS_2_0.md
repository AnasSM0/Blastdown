# BlastDown Design 2.0 — Decision Register

**Status definitions:** `LOCKED` = explicitly selected by owner across the interviews; `PROPOSED` = design-lead elaboration requiring owner acceptance; `VERIFY` = cannot be asserted until current code/Play/device evidence. `LATER` = deliberately deferred. A product direction is not a license to rewrite the existing reducer or persisted schema.

| ID | Status | Decision | Interpretation / guardrail |
|---|---|---|---|
| BD2-001 | LOCKED | Emotion: excitement and achievement | Alternate calm planning with earned high-impact moments. |
| BD2-002 | LOCKED | Refine and expand core mechanics | Preserve distinctive move-based countdown/defuse loop, tune only with tests. |
| BD2-003 | LOCKED | Hybrid game | Endless, Campaign and Daily Challenge. |
| BD2-004 | LOCKED | Skill plus progression for retention | Goals, mastery, rewards; no required login. |
| BD2-005 | LOCKED | Balanced ad monetization | Optional rewarded ads; rare interstitials only after evaluation. |
| BD2-006 | LOCKED | Standard 8×8, three-piece hand | Special boards/presets are allowed experiments, not default. |
| BD2-007 | LOCKED | Balanced danger escalation | Manageable early game, increasing threat later. |
| BD2-008 | LOCKED | Existing explosion→rubble consequences | Rubble can later be cleared; no new explosion rule silently introduced. |
| BD2-009 | LOCKED | Mostly random Endless hands with fairness protection | No deliberate unwinnable/ad-forcing states. |
| BD2-010 | LOCKED | Few special blocks introduced gradually | Each requires separate balance and interaction approval. |
| BD2-011 | LOCKED | Tactical and rare dramatic power-ups | Avoid trivializing core tension or mastery. |
| BD2-012 | LOCKED | Reward both combos and genuine countdown rescues | Distinct high-skill celebrations. |
| BD2-013 | LOCKED | 20–30 polished campaign levels | Prioritize quality over quantity. |
| BD2-014 | LOCKED | Reactor sectors/chapters | Distinct environment theming; no full narrative required. |
| BD2-015 | LOCKED | Primary objective plus optional mastery stars | Beating primary objective advances. |
| BD2-016 | LOCKED | Unlimited campaign retries + optional rescue | No lives/energy gating. |
| BD2-017 | LOCKED | One shared daily challenge per day | Seeded/curated, offline-first; clear date semantics needed. |
| BD2-018 | LOCKED | Stars + single spendable currency, Bolts | Stars indicate mastery, Bolts used for approved items. |
| BD2-019 | LOCKED | Daily goals, weekly missions, achievements | Seasonal events deferred; avoid punitive streak design. |
| BD2-020 | LOCKED | Shareable challenge codes | Same rules and versioned deterministic replay; offline friend challenges, not verified rankings. |
| BD2-021 | LOCKED | Vibrant premium arcade, subtly sci-fi | Neon Reactor Arcade art direction. |
| BD2-022 | LOCKED | Glossy beveled 2.5D tiles | Clear silhouettes, readable mechanics, modest depth. |
| BD2-023 | LOCKED | Balanced contrast, vivid colors | Dark readable board; more inviting UI and environments. |
| BD2-024 | LOCKED | Stylized reactor background | Subtle animation that never competes with board. |
| BD2-025 | LOCKED | Premium polished HUD and menus | Quiet during placement, richer outside play. |
| BD2-026 | LOCKED | Springy tactile motion | Rare moments may be cinematic; don't block input. |
| BD2-027 | LOCKED | Energy clears/defuses/explosions | Control intensity and accessibility. |
| BD2-028 | LOCKED | Visually themed sectors | Preserve consistent tile/board semantics. |
| BD2-029 | LOCKED | Melodic arcade electronic music | Adaptive musical layers follow move-based danger. |
| BD2-030 | LOCKED | Occasional calm technical operator voice | Sparse callouts, separate volume/mute. |
| BD2-031 | LOCKED | Tactile varied haptics | Distinct intensities; optional/reduced motion considered. |
| BD2-032 | LOCKED | Polished lively menus + celebratory level results | Skip/fast-forward possible, Next action immediately clear. |
| BD2-033 | LOCKED | Learn by playing immediately | Minimal-text interactive onboarding; never force drag when it fails. |
| BD2-034 | LOCKED | Subtly alive ambience | No visual or musical suggestion that move-based timers tick in real time. |
| BD2-035 | LOCKED | Expanded rewarded opportunities | Tactical rescue, Revive and reward multipliers staged. |
| BD2-036 | LOCKED | Earn charges, use Bolts or opt-in rewarded ads | Unassisted progress always feasible. |
| BD2-037 | LOCKED | No in-app purchases at initial launch | No premium economy or entitlement system required. |
| BD2-038 | LOCKED | Stronger return loops, limited launch scope | Daily/weekly/achievements at launch; events later. |
| BD2-039 | LOCKED | Gradual campaign mastery curve | Levels tested for solvability and frustration. |
| BD2-040 | LOCKED | Privacy-conscious analytics | Provider and data flows require approval/disclosure before SDK install. |
| BD2-041 | LOCKED | Adaptive graphics quality | Premium experience with stable low-end fallbacks. |
| BD2-042 | LOCKED | Focused public launch | Visual upgrade + campaign first if schedule slips. |
| BD2-043 | LOCKED | Assisted campaign completion, unassisted three-star mastery | Mark assistance explicitly; define exact stars after validation. |
| BD2-044 | LOCKED | No external boosters in Daily and challenge-code runs | Equal gameplay conditions and no rewarded rescue in these modes. |
| BD2-045 | LOCKED | Interstitial closed-test experiment before decision | Do not automatically enable in production. |
| BD2-046 | LATER | Meltdown mode, seasons, full collections, IAP, leaderboards | Only after public launch evidence or renewed owner decision. |
| BD2-047 | PROPOSED | First 25 levels = five sectors of five | Refine after first five authored levels are playtested. |
| BD2-048 | PROPOSED | 1 star primary completion; 3 stars requires no assistance | Exact optional requirements per stage TBD; no hidden criteria. |
| BD2-049 | PROPOSED | UTC day rollover for Daily | Explicit UI countdown/date label; confirm owner preference. |
| BD2-050 | PROPOSED | Interstitial experimental policy | No first-use/onboarding ads, post-result natural transitions only, multi-minute cooldowns, session caps. |
| BD2-051 | PROPOSED | Local profile separately versioned from active run | Idempotent grants and safe migrations. |
| BD2-052 | VERIFY | Current release versionCode, source commit and git branch | Do not assume v5 or v6 is latest; query repository and Console evidence. |
| BD2-053 | VERIFY | Current live renderer, input, ads, consent and test coverage | Audit actual code, not historical build reports. |
| BD2-054 | VERIFY | Target age/audience and applicable Families requirements | Truthful Console declaration; do not change just to avoid rules. |
| BD2-055 | VERIFY | Art, video, SFX, voice and music commercial rights | Inspiration assets are not automatically redistributable. |

## Unresolved owner/technical decisions not to invent

- Exact star thresholds and how assisted completions interact with 2-star awards.
- What counts as a level move, valid target, rescue allowance, and partial progress on failure; these require level prototypes.
- Specific two new block mechanics and first dramatic power-up; evaluate independently against existing engine rules.
- Bolts earn/spend formulas, caps, inventory limits and award idempotency.
- UTC-vs-local daily reset, missed-day streak grace, and device clock integrity limits.
- Initial production interstitial enablement, evidence threshold, and remote/off switch mechanism.
- Analytics provider, event schema, geography/consent rules, privacy updates.
- Target device tiers and actual renderer performance, especially current production cinematic-off native exclusion.
- Content copyrights/licenses, especially stock HUD, commercial music, synthesized voice and generated media.

## Decision control

Only explicitly approved revisions to this register may change locked game behavior. All unapproved values remain hypotheses. Each engineer task must cite affected IDs, scope, tests, and compatibility considerations. Written specs will be reconciled into current authoritative `docs/*` only after the read-only repository audit.
