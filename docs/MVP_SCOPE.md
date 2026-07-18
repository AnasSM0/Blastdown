# MVP Scope

Derived from `BUILD_SPEC.md` sections 3 and 5. The first objective is not a
large commercial game — it's a polished, measurable version of the core
BlastDown mechanic (visible, preventable, escalating explosions on a
familiar block-placement base) that validates whether countdown pressure
makes the genre more engaging.

## Must-have for the first monetizable MVP

Home screen; first-time tutorial; 8×8 board; three-piece hand; placement
with preview and invalid-placement feedback; row/column/simultaneous
clearing; piece-based countdown with warning states; defusing via line
clears; explosion resolution; rubble; combo scoring; best-score and
active-run persistence; pause/resume; game-over flow; immediate restart; one
rewarded revive per run; rewarded timer freeze; rewarded piece defuse;
rewarded double end-of-run currency; interstitials between eligible runs
(never during gameplay); basic cosmetic theme unlocks; sound/haptic
settings; privacy and consent flow; local analytics/debug statistics;
Android dev/preview/production builds.

## Nice-to-have (after MVP)

Daily challenge, missions, achievements, additional themes/explosion
effects, weekly score challenge, cloud save, remove-ads purchase,
alternative board sizes, real-time Blitz mode, limited-time events,
shareable score cards.

## Explicitly out of scope

Multiplayer, accounts, custom backend, real-time networking, chat, friends,
user-generated content, story mode, battle pass, pets, characters,
equipment, inventory, roguelike relics, level editor, multiple gameplay
engines, complicated daily economy, advertising banners during gameplay.

## Guardrails while building

- The timer is the _only_ major gameplay twist. Don't add roguelike
  upgrades, cards, bosses, enemies, stories, campaign maps, complex
  currencies, multiple characters, multiplayer, online leaderboards, or
  social systems.
- Failure should feel like "I saw the danger and almost saved it," never
  "the game randomly punished me." Countdowns are placement-based (moves
  remaining), not real-time seconds — deliberately, for fairness,
  testability, and pause-safety. A real-time Blitz mode is out of scope.
- Gameplay (engine, progression, saves, themes, sound, active runs) must
  work fully offline. Ads may be unavailable offline; nothing else may
  break because of it.
- Rewarded ads must solve a real problem (piece about to explode, damaged
  board, a valuable run just lost, wanting a bigger reward) — never engineer
  impossible situations to force an ad.

## Prototype validation gate (before real ad integration)

Test with at least 5 external players and collect: time to understand the
timer, first-run duration, first explosion time, explosion count, immediate
restart behavior, freeze/defuse button interest, whether failure felt fair,
whether the timer felt exciting or stressful. Proceed to production
monetization only if most testers understand the timer without lengthy
explanation, recognize which piece is in danger, believe they could have
prevented the explosion, voluntarily replay, and express interest in at
least one mock rewarded action. If players ignore the timer or find it
unfair, adjust timer visibility, starting countdown, explosion severity,
tutorial, or piece distribution — not by adding unrelated progression
systems.

## Definition of done (Android MVP)

See `BUILD_SPEC.md` section 27 for the full checklist. In short: installs via
EAS build, tutorial works, full runs completable, timer/explosion/rubble
behavior matches spec, scoring and persistence work, all four rewarded
actions and interstitial caps work, consent flow works, offline gameplay
works, ad failures never break gameplay, themes and settings persist,
typecheck/lint/tests/Expo Doctor all pass, no known critical crash, no
production secret or invalid test ID committed, store release checklist
complete.
