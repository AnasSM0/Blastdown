# BlastDown 2.0 — Monetization, Retention and Analytics Contract

**Status:** Owner directions locked; numeric prices, conversion expectations and analytics provider remain proposed/unverified. No IAP at first public release. No account needed.

## 1. Fairness and access

Core Endless, Campaign retries and Daily Defuse must remain available without ads or online services. No gameplay distortion to trigger ad demand; no deceptive reward previews or accidental double-grants. Campaign primary objective may be completed with boosters, but **three-star mastery must be achieved without external assistance**. Daily/shared challenge runs forbid external boosters, ad-based rescue and inventory advantages. Accessibility options are not 'assistance'.

## 2. One-currency economy

Bolts: spendable soft currency earned by legitimate gameplay and rewards. Stars: nonspendable mastery record. No premium gems, paid coins or paid unlocks at initial launch.

Proposed sources: run milestones, first completion, optional mastery conditions, Daily Challenge once per date, weekly goals/achievements. Proposed sinks: cosmetic themes, selected booster charges, limited recovery options in allowed modes. Exact earn/spend amounts, repeat limits, and balance must be tuned with a simulation and retention test—not invented in tasks. Maintain an idempotent rewards ledger with unique event IDs and support old save migration/rollback.

Avoid inflating currency endlessly; cosmetics need meaningful attainable goals; do not artificially inflate prices to sell ad shortcuts.

## 3. Rewarded ad catalog and gating

| Placement | Purpose | Status/conditions |
|---|---|---|
| Freeze | Pause active countdown impact by approved rule | Existing behavior must be audited; no ad when no relevant target |
| Defuse | Neutralize valid timed piece | Existing behavior must be audited |
| Revive | Rescue failed Endless/Campaign attempt if allowed | Next phase, limited per attempt; exactly-once granting |
| Double Bolts | Optional result reward multiplier | Next phase; ledger prevents repeat/double grant |
| Reroll | Replace unfavorable hand | Later; define randomness fairness and assisted flag |
| Repair | Remove specified rubble | Later; evaluate balance and presentation |

Offer only when legitimate state exists, user requests it, SDK eligible, inventory/economy rules permit it, and content rating/consent allow it. Explicit reward, cost and consequences before opt-in. Failed/cancelled/no-fill ad never changes state or consumes earned reward. Do not show external ad assistance in Daily/shared code mode.

## 4. Interstitial closed-test experiment — NOT automatic production activation

Owner chose a closed-test experiment before public rollout. **Existing published build is not authorized to activate new interstitial SDK or ad unit silently.** Compare observed user journey and player feedback, not only impressions. With small tester cohorts, treat changes as directional/qualitative, not statistically conclusive. Use a kill switch or release-level disabled default.

Proposed conservative starting guardrails for any *separately authorized* experiment:

- Never first launch, tutorial, active game/level opening, immediately after rewarded ad, before revive decision, or after very short failed runs.
- At most at a genuine completed-run/results boundary, **after result/reward acknowledgement** and before a neutral transition; never hijack a Play/Next tap unexpectedly.
- Eligible only after several meaningful completions, with multi-minute elapsed cooldown and low per-session frequency cap; exact values remain hypothesis.
- Ads must be fully loaded/consent-eligible; no waiting spinner; failure means seamless no-ad continuation.
- Account for short campaign stages: one forced ad per level is explicitly disallowed as a product policy.
- Measure interstitial impression, dismissal, next-run start, early exits, crashes/ANR; review user sentiment. No production activation without explicit owner go/no-go.

Google Mobile Ads recommends natural transition points and test ads in development; Play prohibits disruptive unexpected full-screen ads. See:
- https://developers.google.com/admob/android/interstitial
- https://support.google.com/googleplay/android-developer/answer/9857753

## 5. Daily, weekly and long-term retention

**Public launch:** one shared Daily Defuse, a forgiving streak (no irreversible loss of earned items), two or three rotating optional goals, several weekly quests, permanent achievements, stars/Bolts/sector unlocks. UI should surface one primary objective and one next goal, not five popup rewards. Stable daily/weekly content definition versions and reset semantics. Exactly-once grants after offline resume or crash. No misleading 'missed your only chance' pressure.

**Post launch:** seasons, limited-time events, large collections, extra game modes, leaderboards only after evidence/approval. Shareable challenge codes are an approved direction but may be deferred for visual/campaign priority.

## 6. Analytics scope and privacy

Analytics is approved as a **category**, not a particular SDK, collection schedule, endpoint or legal consent mechanism. First define privacy-safe event schema and specific decision each metric informs. Select provider only after evaluating export/deletion, data retention, regional compliance, automated SDK data collection, security, consent and Play Data Safety. Do not confuse Google UMP ad eligibility with universal analytics consent. Review privacy policy before implementation and release.

Proposed event vocabulary (subject to semantics, privacy and provider review):

- `onboarding_started`, `onboarding_step_completed`, `onboarding_finished`, `onboarding_skipped`
- `session_started`, `run_started`, `run_finished` (mode, duration bucket, score bucket, turn count and exit reason)
- `timed_piece_spawned`, `timed_piece_defused`, `timed_piece_exploded`, `line_cleared` (aggregate counts or privacy-safe attributes)
- `level_started`, `level_finished`, `level_failed`, `level_retried`, `level_rescued` (content ID, difficulty, assisted state)
- `daily_started`, `daily_finished`, `streak_reward_granted`
- `boost_offered`, `boost_consumed`, `rewarded_ad_requested`, `rewarded_ad_completed`, `rewarded_ad_failed`
- `interstitial_eligible`, `interstitial_impression`, `interstitial_dismissed`, `next_run_started`
- `graphics_tier_selected`, `performance_problem_detected` (coarse aggregated performance)

Avoid names, email, IP copied into app events, location, raw device IDs, contact data, challenge free-text or personally identifiable payloads. Do not log raw save files. Session identifiers only if deliberately assessed for privacy; no user accounts required. Retention D1/D7 requires an actual definition of a return event and a privacy-consistent pseudonymous or aggregated measurement design.

SDK obligations: Google Play Data Safety covers transmission by third-party SDKs; check actual integrated versions, not generic claims. References:
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://developers.google.com/admob/android/privacy/play-data-disclosure

## 7. Measurement framework and go/no-go

**North star hypotheses:** players understand countdown by first run; failure feels preventable; repeat immediately; campaign objectives are fair; Daily generates return sessions; ad interruptions do not undermine continuation. No numeric target is an observed fact. Collect current baseline from Closed testing where possible, then set pass/fail targets before shipping experiments.

Minimum evaluation: tutorial funnel, first legitimate defuse, multiple runs/session, completion attempts per level, perceived unfair loss, D1/D7 (only if compliant telemetry exists), rewarded conversion, ad-exposure→exit, FPS/ANR/crash and qualitative reviewer feedback. Avoid claiming causal impacts from very small samples.

## 8. Testing

Consent denied/unknown, AdMob no-fill, offline, ad cancelled, app background during ad, duplicated callback, retry after crash, restore from old profile, frequent result transitions and accidental tapping. Validate every award ledger is exactly-once and no mode can bypass external-booster restrictions.
