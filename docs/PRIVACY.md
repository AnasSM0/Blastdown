# Privacy and consent

How BlastDown handles the user's ad-consent decision, what the app does and does
not store, and which declarations the owner still has to make. Companion to
`docs/MONETIZATION.md` (why ads exist and what governs them) and
`docs/TEST_ADS.md` (how to exercise the flow on a device).

Implemented in Phase 6B on branch `phase-6b-production-ads-consent`.

## The short version

BlastDown is a single-player, entirely offline puzzle game. It collects no
account, no contacts, no location, and no free-text input. The only third party
in the app is Google Mobile Ads, and it is reached only when Google's User
Messaging Platform (UMP) reports that ads may be requested.

## What the app stores itself

All of it in local device storage (`AsyncStorage`), namespaced to BlastDown, and
never transmitted:

| Data                                                           | Why                       |
| -------------------------------------------------------------- | ------------------------- |
| Active run state (board, score, timers)                        | Resume an interrupted run |
| Profile (best score, Bolts, owned themes, lifetime aggregates) | Progression               |
| Settings (sound, music, haptics, reduced motion, theme)        | Preferences               |

**The consent decision is deliberately not in that list.** UMP owns it. A second
copy in our storage would go stale the moment the user changed their mind in the
privacy options form, and the stale copy would then be the one gating ads. The
app reads consent from UMP at every launch and never writes it.

Analytics and error diagnostics are seams with in-memory and no-op
implementations only (`docs/ANALYTICS.md`, `docs/ERROR_REPORTING.md`). Nothing
leaves the device through them today. Error reports carry a surface label, a
short message, a code stack and small enumerated aggregates — never stored
state, and never an ad unit or app id.

## The consent lifecycle

Runs once per app launch, in `src/services/consent/ConsentProvider.tsx`:

1. Request fresh consent information from UMP.
2. Present a consent form if — and only if — UMP reports one is required.
3. Read `canRequestAds`.
4. Initialize the Google Mobile Ads SDK, once ever, and only if step 3 said yes.

`canRequestAds` is read from UMP rather than re-derived from the consent status:
the two can legitimately disagree (a partial consent may still permit ads), and
UMP's answer is the one that governs an ad request.

Two properties matter more than the sequence:

- **Consent never gates gameplay.** The provider always renders its children.
  The game is fully offline; a pending, refused or failed consent request means
  ads are unavailable and nothing else. A device in airplane mode plays normally.
- **App-measurement is held back.** `delayAppMeasurementInit: true` in
  `app.config.ts` stops the measurement SDK collecting at process start, before
  any consent decision exists.

### States the app distinguishes

`ConsentState` in `src/services/consent/types.ts`:

| Field                       | Values                                              |
| --------------------------- | --------------------------------------------------- |
| `phase`                     | `idle` · `loading` · `ready` · `error`              |
| `status`                    | `unknown` · `required` · `notRequired` · `obtained` |
| `canRequestAds`             | ads allowed / ads unavailable                       |
| `isConsentFormAvailable`    | a form exists to show                               |
| `privacyOptionsRequirement` | `unknown` · `required` · `notRequired`              |
| `failure`                   | `request` · `form` · `privacyOptions`               |

Derived by `isConsentFormRequired`, `isPrivacyOptionsRequired` and
`areAdsAllowed`. Ads are allowed only when the phase is `ready` **and**
`canRequestAds` is true — a loading or failed lifecycle keeps them off.

## Privacy options entry point

Settings shows a **PRIVACY OPTIONS** row that reopens the consent form, so a
user can change their decision at any time.

It appears **only** when UMP reports `privacyOptionsRequirement: "required"` —
that is, only for users under a regulation that grants the right. It is not
shown speculatively, not shown while the lifecycle is loading, and not shown at
all in a tree with no consent provider. UMP reports the requirement on every
snapshot, so the row survives being used and can be reopened as often as the
user likes. A second press while a form is on screen is ignored rather than
queueing a second form.

## Development-only tooling

Forced debug geography, registered test devices, and the consent reset are
available in **development builds only**, gated on `EXPO_PUBLIC_APP_ENV` in
`src/config/consent.ts` — a build-environment gate, not a runtime toggle, so a
forced geography cannot reach a shipped app. `docs/TEST_ADS.md` covers how to
use them.

## Child-directed treatment — unresolved

`tagForUnderAgeOfConsent` and `tagForChildDirectedTreatment` are **never set**.
They depend on the owner's audience decision, which is still outstanding
(`docs/MONETIZATION.md` §6). Setting either wrongly is a compliance failure in
both directions, so neither is guessed. A test asserts the tag is absent while
the decision stands open.

The answer is a native-build gate, not a runtime flag: a child-directed app must
strip `com.google.android.gms.permission.AD_ID` from the merged manifest, which
requires a config-plugin change and a new build (`docs/MONETIZATION.md` §5.2).

## Owner declarations still required

None of these can be derived from the repository, and the app cannot ship real
ads without them.

- **Privacy-policy URL.** Required by Play and referenced by the consent form.
  `app/index.tsx` still passes `onPrivacy={() => {}}` — a dead control that stays
  dead until there is a URL to open.
- **Published AdMob GDPR/EU consent message.** Created and published under
  AdMob → Privacy & messaging for this app. Until it exists, `requestInfoUpdate`
  returns "not required" and no form can appear, however correct the code is.
- **Audience / child-directed decision.** See above.
- **Play Console — Advertising ID declaration.** `play-services-ads` merges
  `com.google.android.gms.permission.AD_ID` into the manifest automatically; it
  is not written in `app.config.ts` and must not be duplicated there. The Data
  safety form must declare that the app uses an advertising ID, and the
  declaration must match what the merged manifest actually contains.
- **Play Console — ads declaration and content rating** consistent with the
  audience answer.

## Verified

- 98 suites / 679 tests green, including `consentLifecycle.test.tsx` and
  `privacyOptions.test.tsx`, which cover every branch above against an injected
  consent port — no native module involved.
- On-device confirmation of the real UMP form is the owner's, pending the
  published consent message and a registered test device. It will be recorded,
  never fabricated: this build machine has no Android device.
