# Phase 6B device QA record

The running record of what has actually been observed on a physical Android
phone. Checklist source: `docs/TEST_ADS.md`.

**Filling rule.** A box is ticked only when the owner reports that specific
scenario. This repository's build machine has no Android device, no Android SDK
and no JDK, so nothing here can be verified locally and nothing is inferred from
a general "it works". A scenario nobody ran stays open — an unticked box is
information, a wrongly-ticked one is a lie that ships.

Last updated 2026-07-28. Crash fix confirmed against `2f2f03c`; the rewarded
test ad confirmed against the build the owner was running when Phase 6B work
stopped, which is `2f2f03c` or later.

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

**The end-to-end path works.** On 2026-07-28 the owner reported, of the build
under test: "the current rewarded test ad works and grants its reward." That is
the first device evidence that the whole chain — consent gate, SDK
initialization, test-unit resolution, load, present, earned-reward event, reward
application — functions on real hardware. Every unit test in the tree could have
passed with that chain broken at the native seam; now it demonstrably is not.

What that sentence does **not** say is which placement was used, or that the
reward arrived exactly once. So it ticks one cell's worth of behaviour in a
column nobody named. Recorded as its own row rather than spread across the
table:

- [x] **A rewarded test ad loads, opens, completes and grants its reward** —
      placement not identified by the reporter.

| Check                                      | Freeze | Defuse | Revive | Double Bolts |
| ------------------------------------------ | ------ | ------ | ------ | ------------ |
| Ad loads and opens                         | [ ]    | [ ]    | [ ]    | [ ]          |
| Completing grants exactly one reward       | [ ]    | [ ]    | [ ]    | [ ]          |
| Closing early grants nothing               | [ ]    | [ ]    | [ ]    | [ ]          |
| Failure / no-fill / offline grants nothing | [ ]    | [ ]    | [ ]    | [ ]          |
| Rapid taps cannot show two ads             | [ ]    | [ ]    | [ ]    | [ ]          |
| Next ad preloads safely                    | [ ]    | [ ]    | [ ]    | [ ]          |
| No duplicate analytics, audio or haptics   | [ ]    | [ ]    | [ ]    | [ ]          |

The table stays open because per-placement behaviour is what it measures, and
one unattributed success does not fill a named column. The four placements share
one service and one ad unit, so a second and third are cheap to run — but they
differ in what they do with the reward, which is the half that is still untested.

"Exactly one reward" is the row to be pedantic about. The service grants only
from the earned-reward event, applies each reward once, blocks concurrent
presentations, and keeps a grace window for an `earned` that arrives after
`closed` — all covered by unit tests, and now known to grant at least once
against a real ad. Whether it can ever grant twice is a different question and
is still open.

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
test-device hash. Section 4 is under way and needs nothing further — test ads
need no AdMob account, and the path is now known to work end to end. Production
credentials are listed in `docs/MONETIZATION.md` §6 and none of them are
required to finish this record.
