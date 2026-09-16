# BlastDown V1 Gameplay Tuning Report

Date: 2026-09-09

Scope: B-10 holistic V1 gameplay/UX audit

Baseline: `b57e7157960b2c5ad4bf0d7101c3cd78f7447ebb`

## 1. Current balance table

| Setting                 | Current value                                                                                                          | Where defined                                                          | Player effect                                                                         | Risk                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Board / hand            | 8×8; 3 pieces                                                                                                          | `src/domain/board.ts`, `src/config/balance.ts`                         | Compact spatial planning with a full hand visible                                     | A bad refill can sharply reduce options                           |
| Timed-piece assignment  | Every successful placement becomes one timed piece; its cells share one timer                                          | `src/domain/game.ts`                                                   | Every move creates a future obligation                                                | Pressure is continuous, not occasional                            |
| Starting countdown      | Turns 1–15: 7; 16–40: 6; 41–75: 5; 76+: 4                                                                              | `src/config/balance.ts`                                                | Four progressively tighter planning windows                                           | Human-time pacing is not known from bot turns                     |
| Decrement order         | Clear/defuse first, then decrement surviving old timers; a newly placed timer is not decremented on its placement turn | `src/domain/game.ts`                                                   | The committed move can rescue a timer at 1 and always receives its full stated window | Ordering must remain visually understandable                      |
| Category weights        | small 40%, medium 40%, large 20%                                                                                       | `src/config/balance.ts`                                                | Most pieces remain placeable while large pieces periodically raise commitment         | No occupancy-aware protection                                     |
| Small shapes            | single, 2-lines, two small L variants; equal within category (8% each overall)                                         | `src/domain/shapes.ts`                                                 | Flexible repair and setup tools                                                       | Repeated smalls can lower tension                                 |
| Medium shapes           | 3-lines and 2×2; equal within category (13.33% each overall)                                                           | `src/domain/shapes.ts`                                                 | Core board-building pieces                                                            | Each is individually more common than any large shape             |
| Large shapes            | 4-lines, large L, T; equal within category (5% each overall)                                                           | `src/domain/shapes.ts`                                                 | High commitment and line-building leverage                                            | Awkward late draws can feel punishing                             |
| Hand generation         | Independent weighted draws; no bag, duplicate guard, fit-aware draw, pity rule, or reroll                              | `src/domain/handGeneration.ts`                                         | Fully deterministic seeded variety                                                    | Repeats and unhelpful refills are possible                        |
| Line clear              | Full rows and columns clear simultaneously                                                                             | `src/domain/lineClearing.ts`, `src/domain/game.ts`                     | Primary board recovery and scoring action                                             | Crossings can create large swings                                 |
| Natural defuse          | Clearing every surviving cell of a timed piece removes its timer before decrement                                      | `src/domain/game.ts`                                                   | Creates the central “save it before it blows” objective                               | Multi-cell pieces become hard to rescue after fragmentation       |
| Explosion               | Each expired piece becomes rubble; up to 4 empty orthogonal neighbours per piece also become rubble                    | `src/domain/explosions.ts`                                             | Failure permanently compresses the board but can later be cleared in a line           | Cascading spatial loss can look abrupt without presentation       |
| Simultaneous rubble cap | 6 adjacent cells per turn; surviving source cells are not part of this cap                                             | `src/config/balance.ts`                                                | Bounds the random extra damage from simultaneous expirations                          | Multiple large source footprints may still create much rubble     |
| Placement score         | 1 point per placed cell                                                                                                | `src/config/balance.ts`, `src/domain/scoring.ts`                       | Gives every legal move a tiny reward                                                  | Intentionally negligible beside clears                            |
| Line score              | 100 per line before multi/combo multipliers                                                                            | `src/config/balance.ts`, `src/domain/scoring.ts`                       | Makes clears the score engine                                                         | First clear already receives the combo-1 multiplier               |
| Multi-clear multiplier  | 1 line 1×; 2 lines 1.5×; 3 lines 2×; 4+ lines 3×                                                                       | `src/config/balance.ts`                                                | Strongly rewards prepared crossings                                                   | Rare high clears can create large score jumps                     |
| Combo                   | Consecutive clearing moves; `1 + 0.25 × streak`, capped at 3×; no-clear or explosion resets                            | `src/config/balance.ts`, `src/domain/scoring.ts`, `src/domain/game.ts` | Rewards sustained clearing without changing board rules                               | Cap is rarely approached in bot runs                              |
| Natural-defuse bonus    | `25 + 10 × remaining timer`                                                                                            | `src/config/balance.ts`, `src/domain/game.ts`                          | Rewards removing a timed obligation early                                             | Points reward early defuse more than clutch timing                |
| Explosion penalty       | −50 per expired piece, score floored at 0; combo resets                                                                | `src/config/balance.ts`, `src/domain/game.ts`                          | Makes explosions costly beyond rubble                                                 | Early penalties can be hidden by the score floor                  |
| Freeze                  | Hold all active timers for 2 successful placements; maximum 2 rewarded uses/run; no stacking                           | `src/config/balance.ts`, `src/domain/game.ts`                          | Buys setup time without altering placement rules                                      | Poor timing can waste much of its value                           |
| Defuse                  | Convert the lowest timer to normal cells; ties choose oldest; maximum 2 rewarded uses/run                              | `src/config/balance.ts`, `src/domain/game.ts`                          | Deterministic emergency rescue                                                        | Optimal target is automatic, so strategy is mainly when to use it |
| Game Over               | After a complete turn, none of the current hand pieces can be placed anywhere                                          | `src/domain/gameOver.ts`, `src/domain/game.ts`                         | Failure is a visible spatial lock, not a hidden life counter                          | The final refill can expose an already unrecoverable board        |
| Run-duration bands      | No level boundaries; only timer tiers at turns 16/41/76                                                                | `src/config/balance.ts`                                                | Endless mode escalates inside one run                                                 | Minute targets require human/device timing                        |
| Anti-frustration rules  | None beyond category weights, full-hand visibility, deterministic outcomes, and bounded adjacent rubble                | generator/domain trace                                                 | Preserves genuine risk and seed reproducibility                                       | No guarantee of a useful or distinct piece in a refill            |

Dormant Revive and Bolts constants remain parseable legacy data and are not V1
balance knobs because no production V1 flow invokes them.

## 2. Simulation methodology

No sufficient gameplay simulator existed. B-10 adds
`scripts/balance-simulation/v1BalanceSimulation.ts`, compiled only through
`tsconfig.simulation.json`; it is not imported by the app runtime.

The harness uses the real initial-state factory, legal-placement predicate,
pre-clear prediction, placement reducer, seeded hand generator, timer processing,
explosion/rubble resolver, power-up actions, scoring, and Game Over rules. It
does not copy those rules. It validates an 8×8 board, finite non-negative
counters, live timer cells, and positive live timers throughout each run.

Four deterministic policies ran over the same 2,000 seeds and same tie-break
random stream, capped at 500 turns:

- **Random legal:** uniformly selects a legal move.
- **Greedy clear:** maximizes immediate lines, then prefers the smaller piece.
- **Survival:** evaluates real reducer outcomes; avoids immediate Game Over and
  explosions, rescues low timers, then prefers defuse urgency, clears, fewer
  critical timers, and lower occupancy.
- **Survival + recovery:** uses the survival policy, Defuses a timer at 1, and
  Freezes when at least two timers are at 2 or lower, subject to real caps.

The primary population is **8,000 runs** (2,000/strategy). All 8,000 completed
or reached the cap without state corruption. Seventeen survival and 23 recovery
runs were right-censored at 500 turns; percentiles below the cap remain useful.
Bot turns are comparative samples, not estimates of human minutes or skill.

## 3. Baseline distributions

### Outcome distributions

Values are P25 / median / P75 / P90.

| Strategy            | Turns                 | Score                           | Lines                | Explosions           | Rubble created            | Natural defuses       | Best combo    | Hand refills      |
| ------------------- | --------------------- | ------------------------------- | -------------------- | -------------------- | ------------------------- | --------------------- | ------------- | ----------------- |
| Random legal        | 14 / 21 / 32 / 47     | 249 / 979 / 2,067 / 3,445       | 2.75 / 7 / 13 / 22   | 7 / 11 / 20 / 30     | 38 / 59 / 94 / 142        | 1 / 4 / 7 / 12        | 1 / 1 / 1 / 2 | 5 / 8 / 11 / 16   |
| Greedy clear        | 26 / 45.5 / 76 / 116  | 1,597 / 3,292 / 5,922 / 9,308   | 10 / 21 / 39 / 64    | 13 / 24 / 42.25 / 68 | 67 / 118.5 / 207 / 332    | 9 / 17 / 30 / 45      | 2 / 2 / 2 / 3 | 9 / 16 / 26 / 39  |
| Survival            | 47 / 92 / 161 / 257   | 3,307 / 7,144 / 12,733 / 20,723 | 20 / 46 / 85 / 139.1 | 23 / 49 / 90 / 146   | 105 / 227.5 / 420 / 671.1 | 19 / 39 / 67 / 107    | 2 / 2 / 3 / 3 | 16 / 31 / 54 / 86 |
| Survival + recovery | 44 / 89 / 169 / 274.1 | 3,001 / 6,956 / 13,245 / 21,866 | 18 / 43.5 / 89 / 149 | 20 / 46 / 93 / 154.1 | 89 / 206 / 420 / 703      | 17.75 / 38 / 70 / 115 | 2 / 2 / 3 / 3 | 15 / 30 / 57 / 92 |

### Pressure and failure context

| Strategy            | Timed pieces avg. | Explosions / 100 turns | Natural defuses / 100 | Timer-1 rescues / 100 | Multi-expiration turns / 100 | Forced-choice turns | Median final occupied / rubble |
| ------------------- | ----------------: | ---------------------: | --------------------: | --------------------: | ---------------------------: | ------------------: | -----------------------------: |
| Random legal        |              5.23 |                  57.98 |                 19.19 |                  2.95 |                         1.29 |              36.42% |                        44 / 28 |
| Greedy clear        |              4.07 |                  55.04 |                 36.99 |                  3.80 |                         0.80 |              34.32% |                      40 / 27.5 |
| Survival            |              3.53 |                  55.13 |                 41.38 |                  4.91 |                         0.49 |              34.51% |                        41 / 29 |
| Survival + recovery |              3.75 |                  53.44 |                 41.26 |                  5.01 |                         0.98 |              34.54% |                        41 / 29 |

“Forced-choice” means one playable hand piece or at most three legal placements.
The “unavoidable explosion” proxy means a timer at 1 where every legal move on
that turn explodes; it occurred on 50.07–54.64% of turns. This is a logically
unavoidable **expiration after earlier decisions**, not a logically unavoidable
run loss and not proof that RNG was unfair. Almost every run had timer 1 and an
explosion in its final five moves, while final boards were about 63–69% occupied
and mostly rubble. Game Over therefore usually followed accumulated visible
pressure rather than a full normal-block board.

## 4. Difficulty analysis

| Analytical phase | Turns | Pressure source                           | Finding                                                                                                                                                                     |
| ---------------- | ----- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening          | 1–7   | Countdown 7; board space abundant         | No explosion can occur in the first five turns. The opening is short, but satisfying clears are uncommon before turn 5 (8.7% for clear/survival policies).                  |
| Early pressure   | 8–15  | First timers mature at countdown 7        | Explosion pressure arrives decisively: 99.75–99.8% of non-recovery strategic bots had exploded by turn 10. This is an exposure to the core mechanic, not usually Game Over. |
| Mid game         | 16–40 | New timers start at 6                     | Pressure rises one move at a time because existing timers are not rewritten. Clear-focused play materially separates from random play.                                      |
| High pressure    | 41–75 | New timers start at 5                     | More obligations overlap; survival planning yields a wide lifespan distribution rather than a single cliff.                                                                 |
| Endurance        | 76+   | New timers start at 4; rubble accumulated | Planning remains rewarded, but repeated explosions and permanent rubble make eventual spatial lock increasingly likely.                                                     |

The curve is stepped but not abrupt: tier changes affect newly placed pieces
only. Median survival increasing from random 21 to clear-first 45.5 to survival
92 turns is strong evidence that planning matters. The wide P75/P90 tails show
an endurance game rather than a hard terminal turn. Conversely, the near-certain
first explosion around turn 8–10 is the leading human-playtest question; changing
it without observing tutorial comprehension and turn cadence would be intuition.

The proposed 1–3 / 3–6 / 6–12 minute new/average/skilled bands remain product
hypotheses. A bot does not deliberate, drag, read timers, or watch feedback, so
these simulations cannot validate those minute targets.

## 5. Fairness findings

- No timer is impossible immediately on assignment: the minimum starting value
  is 4 and a new piece is not decremented on its placement turn.
- A timer at 1 is genuinely rescuable only if one legal placement fully clears
  all of its surviving cells. The 4.91–5.01 rescues per 100 strategic turns show
  that clutch saves occur, but many mature obligations must explode.
- Simultaneous expiration is rare (0.49–1.29 turns per 100), and random adjacent
  rubble is capped at six per turn. This bounds the hardest-to-read damage.
- Independent draws allow awkward and repeated hands. The observed duplicate
  shape rate was 25.9–26.79% of refills. The theoretical chance of at least two
  large-category pieces is 10.4%, including 0.8% all-large hands.
- The engine checks Game Over only after full resolution and against every piece
  in the visible current hand. It never hides a legal move or ends before a
  legal placement.
- There is no fit-aware/pity rule. A late hand may offer no realistic recovery,
  but the simulation cannot separate bad prior spatial decisions from human-
  perceived bad luck. Instrumented human replays are required before adding any
  anti-frustration rule.

Assessment: deterministic and bounded, with meaningful agency, but not proven
fair to new players. The final-five-turn evidence supports “pressure accumulated
and then space closed”; it does not prove every seed communicates that causality.

## 6. Timer findings

Timer pressure is **high but strategically responsive** in the bot model.
Random play carries 5.23 simultaneous timed pieces versus 3.53 for survival.
Timer-2 and timer-1 warnings occur at roughly 66 and 61 events per 100 strategic
turns; warnings are therefore ambient pressure, not rare exceptions. Explosions
average 1.73 turns apart after the first strategic-bot explosion. Despite that
frequency, simultaneous expiration groups are uncommon and natural defuses rise
from 19.19/100 random turns to 41.38/100 survival turns.

This combination supports the intended near-save loop: the system continually
creates danger, and better placement approximately doubles the defuse rate. The
open risk is warning fatigue on a physical phone. No timer values changed.

## 7. Piece-generation findings

Observed category shares (39.86–39.99% small, 39.92–40.13% medium, 20.01–20.18%
large) match configuration. Individual shapes converge on their expected rates:
about 8% per small shape, 13.3% per medium shape, and 5% per large shape. There
is no accidental weight skew.

All catalog shapes contribute through the same legal-placement and clear rules.
No shape was absent or overrepresented. Duplicate hands are noticeable at about
26%, but that follows independent draws and is not by itself evidence of
monotony. Occupancy-aware weighting might improve late fairness, but it would be
a new generation rule and should not be introduced without human seed reviews.
No shape/category weights changed.

## 8. Scoring and combo findings

Placement points cannot dominate: even a four-cell placement gives 4 points,
while a first one-line clear gives 125 line points before other events. Strategy
quality strongly separates both lifespan and score, so the score does not reward
mere survival-independent placement spam.

The line/multi-clear ladder is consequential, while best combo is modest:
survival median 2, P75/P90 3. The 3× combo cap is therefore a rare ceiling, not
an active source of score inflation in these policies. The −50 per-piece
explosion cost is material over dozens of explosions and also resets combo, but
the score floor masks early penalties. The natural-defuse formula pays more for
early removal (95 at timer 7, 35 at timer 1); clutch value is currently expressed
through danger resolution, praise, audio, haptics, and survival rather than a
higher clutch point bonus. Human motivation data is needed before changing this
approved formula. No scoring constants changed.

## 9. Freeze and Defuse findings

The scripted recovery policy used nearly both allowed uses of each power-up per
run. Against survival it reduced explosions from 55.13 to 53.44 per 100 turns,
cut by-turn-10 explosion incidence from 99.75% to 5.55%, and improved the upper
tail (P90 257 → 274.1 turns). It did not improve every seed or the median (92 →
89), because automatic early use changes later board trajectories and is not an
optimal power-up policy. This is evidence that both tools are meaningful but not
evidence that they are overpowered.

One objective defect was fixed: Freeze previously allowed a rewarded use when
there were no active timers, contradicting its “freeze all active timers” copy
and risking a low-value/wasted ad. Both the capability selector and domain action
now require at least one active timer. Duration and per-run caps are unchanged.
Defuse already required a timer and deterministically selects the most urgent
oldest target.

## 10. Feedback priority matrix

Only one highest-priority semantic audio/haptic cue is admitted per committed
turn. Visual plans may show multiple true outcomes, but use one effect identity
and one group impulse; praise admits one phrase; score admits one semantic impact.

| Event              | Visual                                                                     | Praise              | Score feedback                             | Audio                           | Haptic                 | Priority |
| ------------------ | -------------------------------------------------------------------------- | ------------------- | ------------------------------------------ | ------------------------------- | ---------------------- | -------: |
| Ordinary placement | Drag ghost then placement settle                                           | None                | Ordinary HUD increment only                | Placement                       | Light impact           |       30 |
| Timer 2 / timer 1  | Persistent danger lighting + timer badge pulse                             | None                | None                                       | Separate timer-2 / timer-1 cues | Light / strong warning |  42 / 48 |
| Single clear       | Tier-1 lane impact/sweep/release                                           | NICE or CLEAR       | Level-1 slam                               | Single clear, combo pitch       | Medium impact          |       55 |
| Double clear       | Tier-2 clear + one 2 px board impulse                                      | DOUBLE              | Level-2 slam                               | Double                          | Heavy impact           |       62 |
| Triple clear       | Tier-3 clear + one 4 px impulse                                            | TRIPLE BLAST        | Level-2 slam                               | Triple                          | Heavy impact           |       68 |
| Four-plus clear    | Tier-4 clear + one 6 px impulse                                            | OVERLOAD            | Level-3 slam                               | Overload                        | Heavy impact           |       74 |
| Natural defuse     | Defused footprint within the committed effect plan                         | DEFUSED / CLOSE ONE | Level-2 slam                               | Defuse                          | Success                |       78 |
| Timer-1 clutch     | Defuse visual + critical danger resolves                                   | CLUTCH!             | Level-3 slam                               | Clutch                          | Strong success         |       88 |
| Game Over          | Game-over overlay after committed outcome                                  | None                | Final score/results                        | Game Over                       | Terminal               |       92 |
| New best           | Results/best-score treatment                                               | None                | Best value                                 | New Best                        | Strong success         |       94 |
| Explosion          | Source flash, detonation, fragments, rubble settle, one 8/10/12 px impulse | None                | Penalty reflected in HUD; no positive slam | Explosion with ducking          | Explosion              |      100 |

The hierarchy is coherent. A clear+defuse turn keeps its truthful clear/defuse
visuals, while defuse wins sound and praise. Explosion wins over terminal/new-
best sound on the same turn, avoiding stacked terminal cues; Results still shows
the achievement. Reduced Motion preserves state-changing cues without travelling
motion or shake. No redundant runtime cue required removal.

The visual information order is also structurally sound: native-backed dragged
piece; landing validity; timer badge/danger layer; pre-clear lanes; committed
effects; score/praise; ambient surface. During drag, the board suppresses a
second placement silhouette while retaining line prediction. Physical-device
testing must still judge whether danger lighting, timer pulse, praise, and a
large explosion compete on small screens.

## 11. Changes made

1. Added a deterministic, real-engine simulation and invariant test suite under
   tooling/test paths only.
2. Required at least one active timer before Freeze can be offered or applied.
3. Added domain/selector regression coverage for the Freeze precondition.
4. Added this audit and recorded the accepted B-10 decision.

No timer tier, shape weight, scoring value, combo value, explosion/rubble rule,
power-up duration, or power-up cap changed. No dependency or production renderer
changed.

## 12. Before/after comparisons

There is no balance-constant before/after population because the evidence did
not justify tuning one. Re-running the same seeds would therefore reproduce the
same gameplay distributions.

| Behavior           | Before                                             | After                                            | Evidence                                                                                        | Expected effect                                                      | Risk                                                                            |
| ------------------ | -------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Freeze eligibility | Could spend a rewarded use with zero active timers | Requires ≥1 active timer at selector and reducer | Canonical copy says “all active timers”; Defuse already follows the same meaningful-target rule | Prevent wasted/low-value reward flows and contradictory availability | Slightly delays an eager player's first possible Freeze; duration/cap unchanged |

## 13. Unresolved hypotheses requiring human/device playtesting

- Convert turns into real minutes for new, average, and skilled players; validate
  the 1–3 / 3–6 / 6–12 minute hypotheses.
- Verify whether the near-universal first explosion around turn 8–10 teaches the
  mechanic or feels punitive before timer literacy develops.
- Determine whether frequent timer-1/2 warnings create useful tension or fatigue.
- Review representative late seeds and ask players to explain why they lost;
  comprehension, not merely logical determinism, is the fairness gate.
- Measure perceived value and ad willingness for Freeze/Defuse at different
  danger states; the scripted policy is intentionally naive.
- Judge small-screen layer competition, effect readability, phone-speaker mix,
  haptic strength, Reduced Motion, thermal behavior, and 30/60 Hz smoothness.
- Assess whether ~26% duplicate-shape hands feel coherent or repetitive and
  whether late large pieces feel unlucky or earned by prior board management.
- Validate whether early-defuse score weighting and sensory clutch reward match
  player motivation.

`A-DEVICE-PENDING` remains open; this report does not claim subjective Android
feel or human-duration success.

## 14. Recommendations for future gameplay expansion

Higher complexity/risk is worse; higher player value/core-loop fit is better.

| Candidate                | Player value | Complexity | Core-loop fit | Readability risk | Balance risk | Monetization risk | Position |
| ------------------------ | -----------: | ---------: | ------------: | ---------------: | -----------: | ----------------: | -------: |
| Daily Challenge          |            5 |          3 |             5 |                1 |            3 |                 2 |        1 |
| Passive achievements     |            3 |          2 |             4 |                1 |            1 |                 2 |        2 |
| Objectives               |            4 |          4 |             4 |                3 |            3 |                 3 |        3 |
| Challenge/level mode     |            5 |          5 |             4 |                2 |            4 |                 3 |        4 |
| Advanced combo mechanics |            3 |          3 |             4 |                3 |            5 |                 3 |        5 |
| Earned items/power-ups   |            4 |          4 |             3 |                3 |            5 |                 5 |        6 |
| Special blocks           |            4 |          4 |             3 |                4 |            4 |                 3 |        7 |
| Board modifiers          |            4 |          5 |             3 |                4 |            5 |                 3 |        8 |
| Unlockable progression   |            4 |          5 |             3 |                2 |            3 |                 5 |        9 |
| New timed hazards        |            4 |          5 |             5 |                5 |            5 |                 4 |       10 |

Recommended first three post-V1 experiments:

1. **Seeded Daily Challenge prototype:** reuses the deterministic core and adds
   replay value with minimal board-language expansion.
2. **Passive achievements prototype:** observes existing mastery without changing
   moment-to-moment balance; keep rewards non-economic initially.
3. **Isolated objective challenge prototype:** tests whether constraints add
   purpose before investing in a full level system.

These are experiments only. None are implemented or added to V1 scope.

## Package-security audit (separate from gameplay tuning)

`npm audit` reports **24 vulnerabilities: 8 high, 16 moderate**, consolidated
under seven packages. No `npm audit fix` was run and no dependency changed.

| Package/group                              | Dependency class / exposure                                                                | Classification                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@xmldom/xmldom`                           | Expo config/splash and plist tooling; production dependency tree but build/config-time XML | High; lockfile-compatible fix is reported, low relevance to shipped offline gameplay; verify within the pinned Expo SDK before changing                                     |
| `baseline-browser-mapping`, `browserslist` | Expo Metro/Babel target calculation                                                        | Moderate/high; build-time/toolchain; potentially actionable without a runtime redesign, but requires Expo-compatible transitive validation                                  |
| `brace-expansion`                          | Primarily ESLint/Jest; one Expo fingerprint path                                           | High DoS on attacker-controlled patterns; development/build tooling, not shipped gameplay input; normal fix reported                                                        |
| `js-yaml`                                  | ESLint/Jest and Expo CLI                                                                   | High CPU DoS on hostile YAML; development/build tooling; normal fix reported                                                                                                |
| `image-size`                               | React Native Metro                                                                         | High parser DoS; build-time asset inspection, not an in-app parser; normal fix reported but tied to Metro compatibility                                                     |
| `decode-uri-component`                     | `expo-router` → `query-string`                                                             | Moderate DoS; production JavaScript path and the most runtime-relevant finding; audit's forced remedy downgrades to `expo-router@5.1.11`, an unsafe/breaking fix for SDK 57 |
| `uuid`                                     | Expo config plugins → Xcode tooling                                                        | Moderate bounds issue in APIs BlastDown does not call; build-time; audit's forced remedy downgrades Expo, unsafe                                                            |

The normal-fix groups should be revisited as an Expo-compatible dependency
maintenance task. The two forced remedies must not be accepted because they
would break the supported SDK 57 baseline. None expose network parsing in the
offline game loop.

## Reproduction

```text
npx tsc -p tsconfig.simulation.json
node dist/balance-simulation/scripts/balance-simulation/v1BalanceSimulation.js --runs 2000 --max-turns 500
npx jest __tests__/tooling/v1BalanceSimulation.test.ts --runInBand
```
