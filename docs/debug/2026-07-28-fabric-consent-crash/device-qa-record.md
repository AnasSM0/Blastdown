# Phase 6B device QA record

The running record of what has actually been observed on a physical Android
phone. Checklist source: `docs/TEST_ADS.md`.

**Filling rule.** A box is ticked only when the owner reports that specific
scenario. This repository's build machine has no Android device, no Android SDK
and no JDK, so nothing here can be verified locally and nothing is inferred from
a general "it works". A scenario nobody ran stays open — an unticked box is
information, a wrongly-ticked one is a lie that ships.

Last updated 2026-07-28 against commit `2f2f03c`.

## Build under test

| Field                   | Value                                                |
| ----------------------- | ---------------------------------------------------- |
| Commit                  | `2f2f03c`                                            |
| Branch                  | `phase-6b-production-ads-consent`                    |
| Build profile           | **not supplied** (EAS `development` assumed)         |
| Device model            | **not supplied**                                     |
| Android version         | **not supplied**                                     |
| OS reduced-motion state | ON (inferred from the earlier Reanimated warning)    |
| Ad units                | Google test units only — no production IDs exist yet |

## 1. Fabric crash — RESOLVED

The one part of this document with a device result behind it.

- [x] **The crash no longer reproduces.** Owner rebuilt from `2f2f03c` and ran
      it on the phone that previously crashed on every launch: "the rebuilt app
      now runs correctly without recurring crashes."

Everything below was on the confirmation list but was not itemised in the
report, so it stays open. Most are probably fine — the app evidently runs — but
"probably fine" is not a test result.

- [ ] Fresh launch
- [ ] Reduced motion OFF
- [ ] Reduced motion ON
- [ ] Consent initialization
- [ ] Home and gameplay
- [ ] Pause, Defuse and game-over panels
- [ ] Background / resume
- [ ] Repeated gameplay
- [ ] No Fabric assertion over a measured duration — duration: ______
- [ ] No black or invisible blocks
- [ ] Drag remains responsive

The reduced-motion pair matters more than the rest. The fix works by making the
reduced-motion signal never travel in the unsafe direction, so both states
exercise different halves of it: ON means no transition at all, OFF means one
safe _adding_ transition. A pass in only one state leaves the other unproven.

## 2. Consent

Requires `EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY=eea`, a registered test device, and —
the usual blocker — a **published** AdMob GDPR message. Without that last one
`requestInfoUpdate` returns "not required" and no form can appear however
correct the code is. It does not exist yet, so section 2 cannot start.

- [ ] Clear app data, launch with forced EEA geography: the form appears
- [ ] Gameplay stays usable when the consent request or form fails
- [ ] Mobile Ads initializes only when `canRequestAds` is true
- [ ] Restart: the consent lifecycle is stable across launches

## 3. Privacy options

- [ ] The Settings row appears when UMP requires it
- [ ] The privacy form opens and closes repeatedly
- [ ] A presentation failure does **not** remove the retry row
- [ ] The valid consent snapshot survives a dialog failure

The last two guard `c825540`, which is the fix for a real regression: a failed
privacy form used to drop the phase to `error`, and since the lifecycle runs
once per launch nothing brought the row back for the session.

## 4. Rewarded test ads

Google test unit `ca-app-pub-3940256099942544/5224354917` for all four
placements. Development and preview builds resolve to it even when production
variables are set, so a dev build cannot request live inventory by accident.

| Check                                      | Freeze | Defuse | Revive | Double Bolts |
| ------------------------------------------ | ------ | ------ | ------ | ------------ |
| Ad loads and opens                         | [ ]    | [ ]    | [ ]    | [ ]          |
| Completing grants exactly one reward       | [ ]    | [ ]    | [ ]    | [ ]          |
| Closing early grants nothing               | [ ]    | [ ]    | [ ]    | [ ]          |
| Failure / no-fill / offline grants nothing | [ ]    | [ ]    | [ ]    | [ ]          |
| Rapid taps cannot show two ads             | [ ]    | [ ]    | [ ]    | [ ]          |
| Next ad preloads safely                    | [ ]    | [ ]    | [ ]    | [ ]          |
| No duplicate analytics, audio or haptics   | [ ]    | [ ]    | [ ]    | [ ]          |

"Exactly one reward" is the row to be pedantic about. The service grants only
from the earned-reward event, applies each reward once, blocks concurrent
presentations, and keeps a grace window for an `earned` that arrives after
`closed` — all covered by unit tests, none of it proven against a real ad.

## 5. Lifecycle and offline

- [ ] Airplane mode: placement reports unavailable, no dialog, gameplay continues
- [ ] Background / resume during ad loading
- [ ] Background / resume after an ad closes
- [ ] Force-close and reopen
- [ ] Restart after an earned reward (the reward is not re-granted)
- [ ] Home and return to gameplay
- [ ] Results screen and Double Bolts
- [ ] Gameplay fully usable with no ads available at all

## 6. Regression

- [ ] Drag remains smooth
- [ ] Event effects remain smooth
- [ ] No Android Fabric crash
- [ ] No stale modal or loading state
- [ ] No listener or timer leak
- [ ] Reduced motion ON and OFF both behave

## Not run at all

The diagnostic flags added for the crash matrix were never exercised, because
the fix was applied and retested directly rather than bisected:

- `EXPO_PUBLIC_DIAG_DISABLE_CONSENT`
- `EXPO_PUBLIC_DIAG_BYPASS_CONSENT_FORM`
- `EXPO_PUBLIC_DIAG_ANDROID_NAV_ANIMATION_NONE`

They stay in the tree until Phase 6B closes, since they cost nothing in a
non-development build and are the fastest way to isolate a recurrence.

## Blocked on owner input

Sections 2 and 3 cannot run without a published AdMob consent message and a UMP
test-device hash. Section 4 can run today — test ads need no AdMob account.
Production credentials are listed in `docs/MONETIZATION.md` §6 and none of them
are required to finish this record.
