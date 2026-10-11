# BlastDown 2.0 — Game Design Document (draft requirements)

**Document role:** Product contract from interviews, pending live-code audit and owner approval of proposed implementation details. See `DESIGN_DECISIONS_2_0.md` for statuses.

## 1. Pillars and target experience

1. **Tactical control:** one-finger portrait interactions, precise previews, consistent grid placement, readable danger.
2. **Earned excitement:** meaningful timed-piece saves, combo clears, recovery from rubble and escalating sensory response.
3. **Meaningful progress:** campaign objectives/stars, Bolts, daily/weekly achievements; repeatable Endless mastery.
4. **Fairness:** move-based countdowns, no pressure from real-time delays, no deliberately ad-forcing unwinnable hands, no mandatory purchases/ads/accounts.
5. **Reliable offline play:** domain, progress and daily bundled content remain available without connection; ads and telemetry optional/fail-safe.

**Audience:** mobile puzzle players; actual Play target age selection must be verified. **Platform:** Android-first, portrait; iOS later if qualified.

## 2. Core moment-to-moment loop

Select or pick up one of three shapes → preview legal anchor and prospective clear → commit valid placement → apply line clears/defuse → resolve move-based timers → handle explosion/rubble events according to **existing verified** reducer semantics → award score/combo and presentation events → refill hand as defined by existing rules → repeat or reach defined game over.

Retain standard 8×8 and three-piece hand in Endless; special layouts are experimental. Invalid taps or releases must not consume a turn. A timed piece's countdown is measured in future **successful placements**, not wall-clock seconds. The exact existing operation order, initial countdown semantics, explosion footprints, multi-explosion ordering, rubble behavior, and scoring constants must be recovered from `docs/GAME_RULES.md` and tests, not inferred from this draft.

### Invariants to preserve

- `DEFUSED` praise appears only when a timed piece is **actually** neutralized through valid gameplay/defuse action, not merely when any row is cleared.
- A piece at one move remaining must be saveable by a valid final clear if supported by existing rule semantics.
- Domain actions are deterministic and testable; presentation does not alter reducer outcomes.
- Fast repeated input cannot commit a piece twice.
- Gameplay drag and tap-to-place share the same placement path and tutorial gating. A rejected move never changes state.
- App pause/background/force-close never advances move-based timers.
- Existing saved runs must survive updates via explicit migration.

## 3. Modes

### 3.1 Endless Reactor (LOCKED)

Immediately accessible, score/high-score oriented. Adaptive challenge emerges from the countdown/recovery loop and fair piece randomness. Preserve player agency: no hidden ad-trigger difficulty changes. Some rare dramatic abilities may be restricted for scored comparability; policy requires explicit design decision.

### 3.2 Reactor Campaign (LOCKED direction)

20–30 hand-authored and tested stages; **proposal**: five sectors of five stages. Primary objective gates completion, no lives/energy, unlimited retry. Optional stars reward skill; three-star mastery requires unassisted play. Assistance should remain marked for that attempt, even if the player uses assistance and later clears it. Separate unassisted best result can supersede an assisted record. No ads required for completion.

Suggested objective primitives (PROPOSED, only after engine capability verification): line clears, defuse count, rubble cleared, max move count, survival count, score target, specified cells cleared, no-explosion completion. Combine cautiously; no mutually contradictory goal states. If an objective requires a new event, specify its semantics first.

Stage data contract (PROPOSED): `schemaVersion`, `levelId`, `sectorId`, `ruleSetVersion`, `boardInitialState`, `handSequenceOrGenerator`, `legalPlacementConstraints`, `primaryObjectives`, `optionalMasteryConditions`, `failureConditions`, `reward`, `presentationTheme`, `contentHash`. Exact types must fit existing domain architecture, not duplicate `GameState`.

**Prototype first:** five handcrafted levels with validated solvability; ask at least several external testers if goals feel fair and understandable. Generate remaining content only after balancing acceptance. If solver cannot prove solvability because of stochastic hands, define validation as seeded scenario suite plus user test evidence, not a false guarantee.

### 3.3 Daily Defuse (LOCKED direction)

One shared puzzle per civil date, deterministic and playable offline without account. No player-owned boosters, purchased charges, rewarded revive, reward multiplier affecting mastery, or other external advantages. Define a versioned daily configuration/seed and explicit fixed reset clock (**UTC proposal awaiting owner approval**). Record completion and reward once per challenge ID, allowing retry according to approved rules. Display the relevant reset time and handle offline, boundary time changes, timezone changes and clock manipulation honestly; without a backend no globally verified leaderboard or trustworthy anti-cheat.

### 3.4 Shareable challenge codes (LOCKED interest; schedule may defer)

Codes encode or resolve supported `ruleSetVersion`, content version/seed and mode/options without personal data. Same starting puzzle and piece generation, no external boosters. Explicit invalid/unsupported-version UI. No implied authenticated competitions or global verification.

## 4. Campaign results and mastery

- **Primary success:** advances campaign and grants base completion reward once.
- **Optional mastery:** clear, per-level criteria surfaced before run and at results; 3-star requires unassisted completion. Define precise 2-star policy through tests.
- **Retries:** unlimited and fast; optional rescue only in Campaign/Endless where approved.
- **UI:** results summarize objective, stars, assisted/unassisted label, new best, Bolts earned, next sector progress, Replay/Next. Never stack multiple blocking popups or interstitials.
- **Data:** record best awarded stars, best unassisted stars, completion, attempts, durable idempotent reward ledger; no duplicate economy grants on retry or interrupted save.

## 5. Difficulty, fairness and special mechanics

Endless uses mostly randomized piece hands with explicit fairness protections, documented and covered by distribution simulations. Campaign can use curated hands, always clearly solvable as designed. Do not generate impossible situations to push Freeze/Defuse ads. Prototype special blocks separately (candidates from interview: coolant effect; reinforced rubble); **none is fully approved** until interaction matrices, effect semantics, tutorialization and balancing pass.

Power-ups: ordinary tactical interventions + rare dramatic ability, but only after selecting exact semantics. Preserve scoring/achievement integrity by marking assisted state. Power-ups never change core game rules without an approved engine amendment. Challenge/Daily runs disable external aids.

## 6. Onboarding, navigation and accessibility

Playable tutorial begins in seconds. Teach placement first, then line clear, timed danger, real defuse and rubble recovery through actions and minimal text. Both drag and tap support must work identically. The first user should see the actual timer novelty early. Repeatable tutorial from Settings. Buttons and explanations should be accessible; no sound-only or color-only cues. No ad on first launch or tutorial.

Main nav: Home with obvious Endless / Campaign / Daily entry points, optional continuation of current run, visible progress/rewards, Settings/Privacy. Game screen minimizes UI intrusion and keeps board/tray legible on small Android widths and gesture navigation areas. Pause/Resume and return paths never lose run state.

## 7. Retention and progression boundaries

Campaign progress, stars, Bolts, missions and achievements persist in a **separate versioned profile** from run state (proposal). Support completion notifications and streaks without punitive resets or required login. Daily goals and weekly achievements count verified local game events and award once. Seasons, collections at scale, Meltdown and advanced social systems are later releases. No dark patterns, artificial lives or time-gated core access.

## 8. Acceptance tests to author during implementation

- Deterministic reducer/game event golden fixtures, operation-order equivalence, challenge seed/versions.
- Level schema validation, goal completion/failure, fair/solvable first five stages.
- Assisted vs unassisted 3-star award/achievement protection; idempotent completion/reward grant.
- Offline first launch, daily boundary, timezone/manual-clock behavior; no duplicate rewards.
- Restoring old endless saves, migrating profile schema, power loss between result and reward grant.
- Tutorial drag/tap parity, fast repeated inputs, invalid placements, touch targets and accessibility.
- Short playtests: discovery of timer, ability to explain failures, replay intention, first five level pacing.

**Not yet specified:** precise scoring rebalance, exact event schema, stage list, stars and Bolts economy values, new hazard semantics and power-up effects. Do not invent them during implementation.
