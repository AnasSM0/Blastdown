# Monetization

Derived from `BUILD_SPEC.md` sections 8 and 11. All numeric caps below must be
configurable, never hardcoded at call sites. The per-run rewarded caps live in
`src/config/balance.ts` today (`MAX_REWARDED_FREEZES_PER_RUN`,
`MAX_REWARDED_DEFUSES_PER_RUN`); revive is a per-run boolean on the domain
state. A separate `src/config/monetization.ts` will be introduced with the
interstitial caps, which have no home yet.

## Ad formats

Rewarded and interstitial only. **No banner ads during gameplay, ever.**

## Rewarded placements

- `rewarded_revive`
- `rewarded_freeze`
- `rewarded_defuse`
- `rewarded_double_bolts`
- (optional, future, feature-flagged) `rewarded_repair_blast`

## Interstitial placement

May appear after a completed run only when **all** of these hold:

- Player has completed ≥2 lifetime runs.
- The run lasted ≥60 seconds.
- ≥120 seconds since the previous interstitial.
- No rewarded ad completed in the previous 45 seconds.
- Current session hasn't exceeded its frequency cap.
- Consent state permits the requested ad type.
- An interstitial is already loaded.

Never show: on first app open, during gameplay, immediately after a
rewarded ad, before the revive decision, after every very short failed run,
or two ads back-to-back.

## Session frequency caps (initial, all configurable)

- Max 1 rewarded revive per run.
- Max 2 freezes per run.
- Max 2 defuses per run.
- Max 1 double-reward ad per run.
- Max 3 interstitials per 20-minute session.

## Ad failure behavior

On not-loaded / timeout / crash / closed-without-reward / SDK error: preserve
current state, show a short non-blaming message, never silently drop a
promised reward, allow retry when appropriate, record the failure event.

## Development vs. production ads

Dev and preview builds use Google test ad IDs by default (see
`.env.example` and `app.config.ts`). Production IDs are loaded through
`ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID` environment configuration —
`app.config.ts` throws at config-eval time if a production build doesn't
have both set, to prevent shipping test IDs. Real AdMob integration
requires an Expo development build (native config), not Expo Go — see
`react-native-google-mobile-ads`'s Expo config plugin, already wired in
`app.config.ts`.

## Consent

Before requesting personalized ads: obtain required consent, respect
non-personalized choices, persist consent state, offer a Settings entry to
revisit privacy choices, and never initialize ad requests in a way that
bypasses required consent. Use the consent support built into the chosen
Google Mobile Ads integration rather than a hand-rolled flow.

## Bolts and the double-reward offer

`Bolts = floor(score / 250) + successfully defused pieces` per run. At final
results, offer to watch an ad to double that run's Bolts — only if the
player didn't revive via an unfinished ad flow, an ad is available, and the
reward hasn't already been doubled.

## Ownership

Claude Code owns the contracts and rules above (frequency caps, consent
requirements, `AdService` interface, failure-handling contract). Codex owns
the presentation layer built on top of them (buttons, loading states,
failure-state UI) — see Phase 6/7 in `docs/TASKS.md`.

---

# Phase 6B audit — production ads and consent (2026-07-25)

Read-only audit of what exists today, taken on branch
`phase-6b-production-ads-consent` before any implementation. **No dependency was
installed and no production ad id was added.** Nothing below changes behaviour.

## 1. Existing mock reward architecture

The seam is already the right shape, and it is the only thing the game talks to.

| Piece               | File                                     | What it does                                                                                                                                                                 |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdService`         | `src/services/ads/types.ts`              | Four methods: `preloadRewarded`, `showRewarded`, `preloadInterstitial`, `showInterstitial`. `RewardedResult` is the closed union `earned \| closed \| unavailable \| error`. |
| `MockAdService`     | `src/services/ads/MockAdService.ts`      | Deterministic in-memory implementation — no timers, no randomness, no network. Per-placement scripted outcomes; records every show for assertions.                           |
| `AdServiceProvider` | `src/services/ads/AdServiceProvider.tsx` | Single injection point. **Defaults to the mock**, so tests and Expo Go never touch a native SDK.                                                                             |
| `REWARD_PLACEMENTS` | `src/services/ads/placements.ts`         | Typed placement constants, so a rename is a compile error.                                                                                                                   |
| `useRewardedAction` | `src/hooks/useRewardedAction.ts`         | Single-flight guard, once-only `onEarned` that fires **only** on `earned`, unmount guard, SDK exceptions caught and reported as `error`.                                     |
| `useRewardOutcome`  | `src/hooks/useRewardOutcome.ts`          | Shared outcome vocabulary and feedback timing across all four rewards, including the `unapplied` case.                                                                       |

Reward entry points — all four, and there are no others:

- `app/game.tsx:403` — Freeze (`REWARD_PLACEMENTS.freeze`)
- `app/game.tsx:447` — Defuse (`REWARD_PLACEMENTS.defuse`)
- `app/game.tsx:487` — Revive (`REWARD_PLACEMENTS.revive`)
- `app/results.tsx:75` — Double Bolts (`REWARD_PLACEMENTS.doubleBolts`)

Every one follows the same shape: `reward.run(placement, () => { if (guardedMutation()) { applied = true; … } })`
then `.then((result) => { track(...); outcome.settle(result, applied); })`. The
mutation is a pure domain call behind its own precondition
(`canActivateFreeze`, `canApplyRewardedDefuse`, `canRevive`, and the session's
once-per-run Double Bolts guard), so an ad can never grant a reward the rules
forbid, and success is reported only when the mutation actually applied.

Per-run caps are already enforced in the domain, not the ad layer:
`MAX_REWARDED_FREEZES_PER_RUN` = 2, `MAX_REWARDED_DEFUSES_PER_RUN` = 2, revive
once via `reviveUsed`, Double Bolts once via `doubledRunId`.

## 2. Proposed production adapter boundary

Add one file, change one line. Nothing else.

```
src/services/ads/GoogleAdService.ts   (new)  createGoogleAdService(): AdService
app/_layout.tsx                       (edit) <AdServiceProvider service={…}>
```

Rules for the adapter:

- It implements `AdService` exactly. It does **not** widen the interface, and it
  does not leak SDK types past its own module boundary — callers keep seeing
  `RewardedResult`, never a Google reward object.
- It maps SDK outcomes into the existing union and nothing else: reward earned →
  `earned`; dismissed without earning → `closed`; no fill / not loaded →
  `unavailable`; anything thrown, timed out, or unrecognized → `error`.
- It never applies a reward. Only `useRewardedAction`'s `onEarned` runs a
  mutation, and only on `earned`.
- The **mock stays the provider default**. The real adapter is passed in
  explicitly from `app/_layout.tsx` and only when the SDK is actually available,
  so jest, Expo Go and any web target keep working with zero native code. The
  ad SDK module must be required lazily inside the adapter, never at module
  scope of a shared barrel, or the test suite starts loading native modules.
- Offline is a first-class path: an unavailable ad resolves `unavailable`, the
  game continues, and nothing else breaks. This is already how every caller
  behaves — it must not regress.

Work that belongs to the adapter and does not exist anywhere yet:

- **Preload strategy.** `preloadRewarded` is defined and _never called_ by any
  screen. Real ads need a load-ahead, or the first Freeze of every run stalls.
- **Timeouts.** `showRewarded` has no timeout today. `BUILD_SPEC.md` §11.5
  requires timeout handling; it belongs in the adapter, resolving `error`.
- **Initialization order.** `mobileAds().initialize()` must not run before the
  consent step below (§11.7: "do not initialize ad requests in a way that
  bypasses required consent").

## 3. Consent / UMP flow

**There is no consent code in the repository at all** — no `AdsConsent`, no UMP
call, no persisted consent state. This is the largest gap in Phase 6B.

Planned flow, using the UMP support built into
`react-native-google-mobile-ads` (no hand-rolled dialog, per §11.7):

1. On app start, before any ad request: request a consent-info update, passing
   the child-directed / under-age-of-consent settings the owner decides (§ 5).
2. If a form is required and available, load and show it.
3. Only once consent is resolved (or determined not required) initialize the
   ads SDK and allow preloads.
4. Respect a non-personalized outcome — request non-personalized ads rather than
   refusing to serve.
5. UMP persists its own state; the app stores nothing about the user's choice
   beyond what the SDK holds. No consent data goes into analytics.
6. Settings gains a **Privacy choices** entry that re-opens the form on demand
   (§11.7 requires it; `src/components/SettingsScreen` has no such row today).
7. Consent failure is non-fatal: the game is fully playable offline and without
   ads, so a failed consent step degrades to "no ads", never to a blocked app.

Related gap: `app/index.tsx:47` passes `onPrivacy={() => {}}` — the Home privacy
control is a dead no-op, and there is no `app/privacy` route. It needs the
owner's privacy-policy URL (§5).

## 4. Test-ad strategy

Already in place:

- `app.config.ts` defaults `androidAppId`/`iosAppId` to Google's published test
  **app** IDs and passes them to the `react-native-google-mobile-ads` config
  plugin, which is already wired.
- It **throws at config-eval time** if a production build lacks
  `ADMOB_ANDROID_APP_ID`/`ADMOB_IOS_APP_ID`, so test app IDs cannot ship in a
  production bundle.
- `.env.example` documents both, and `.env` is gitignored.
- `eas.json` separates `development` / `preview` / `production` and sets
  `EXPO_PUBLIC_APP_ENV` per profile.

Missing:

- **Ad _unit_ IDs are not configured anywhere.** Only app IDs are. Development
  and preview must use the SDK's `TestIds.REWARDED`; production must read real
  per-placement unit IDs from the environment, and the existing production guard
  in `app.config.ts` must be extended to cover them too.
- The project is CNG-managed (no `android/` or `ios/` directory). Ads require a
  **development build**; Expo Go cannot load the native module. `expo-dev-client`
  is already a dependency, so this is a build step, not a code change.

Never point a debug or internal build at production ad units — that is invalid
traffic and risks the AdMob account.

**Testing the consent form is a build-configuration problem, not a code
problem** — see §5.3. Without it the EEA form cannot be exercised from here.

## 5. Android build configuration for ads and UMP

This is native configuration, and none of it is optional. Every item below
requires a **new development build** — none of it can be delivered as a JS
update, so it has to be settled before the first ad-enabled build rather than
discovered during it.

### 5.1 What the config plugin does and does not do

`react-native-google-mobile-ads@16.4.0`'s Expo plugin writes exactly four
Android manifest `meta-data` entries into the main application —
`com.google.android.gms.ads.APPLICATION_ID`, `DELAY_APP_MEASUREMENT_INIT`,
`flag.OPTIMIZE_INITIALIZATION`, `flag.OPTIMIZE_AD_LOADING` — plus iOS Info.plist
keys. That is its entire Android surface.

It does **not** configure UMP, does not touch Gradle, and does not manage
permissions. UMP itself needs no Gradle work: the library declares
`api "com.google.android.ump:user-messaging-platform:4.0.0"`, so the SDK arrives
transitively. Everything else below is ours to add.

### 5.2 `AD_ID` permission — gated on the child-directed decision

`play-services-ads` merges `com.google.android.gms.permission.AD_ID` into the
manifest automatically. Two consequences:

- The Play Console **Data safety** form must declare that the app collects and
  uses an advertising ID. Play rejects a mismatch between the declared answer
  and the merged manifest.
- If the owner answers that the app **is** child-directed / under age of consent,
  that permission must be **removed**, not merely left unused:

  ```xml
  <uses-permission android:name="com.google.android.gms.permission.AD_ID"
                   tools:node="remove" />
  ```

  The RNGMA plugin has no option for this, so it needs a small local
  `withAndroidManifest` config plugin (or `expo-build-properties`, which is not
  currently a dependency). **This is the concrete build consequence of the
  child-directed answer**, and it is why that answer blocks the build and not
  just the runtime flags.

### 5.3 UMP cannot be tested without explicit debug configuration

`AdsConsent.requestInfoUpdate` accepts `debugGeography` and
`testDeviceIdentifiers`. Both are required to see a consent form from a
non-EEA device: without a registered test device the SDK reports consent as not
required and the form never appears, so "no form showed" is indistinguishable
from "consent works". The device's hashed identifier is printed by the SDK to
logcat on first run and must be collected from the physical device.

Debug geography must be wired so it is **impossible** to enable in a production
build — it belongs behind `EXPO_PUBLIC_APP_ENV`, alongside the existing test/
production ad-id split, not behind a hand-set constant.

Two console-side prerequisites sit outside the repository and are easy to miss:
a **GDPR/EU consent message must be created and published** in AdMob under
Privacy & messaging for this specific app, and the app must be linked to Play.
Until the message is published, `requestInfoUpdate` legitimately returns "not
required" no matter how correct the code is.

### 5.4 App-measurement init must be delayed for a consent-first flow

`delayAppMeasurementInit` is currently unset in `app.config.ts`, so app
measurement starts with the SDK. For a consent-first flow it should be `true`,
which keeps measurement from initializing before the consent step resolves. The
plugin already exposes it; it just has to be passed. `optimizeInitialization`
and `optimizeAdLoading` default to `true` even when omitted — worth stating so
nobody assumes they are off.

### 5.5 SDK levels

`react-native-google-mobile-ads@16.4.0` declares `minSdk 23` (and Google Mobile
Ads 25.4.0 / UMP 4.0.0 on Android). Expo SDK 57's generated Android project sets
its own levels; the resolved `minSdkVersion`, `compileSdkVersion` and
`targetSdkVersion` must be confirmed at the first prebuild against Play's
current target-API requirement. If they need pinning, `expo-build-properties` is
the lever — **it is not currently a dependency**, and adding it is a dependency
change, so it waits for approval like any other.

### 5.6 iOS, if it comes into scope

`userTrackingUsageDescription` and `skAdNetworkItems` are both unset in
`app.config.ts` today, and UMP on iOS sits alongside App Tracking Transparency.
None of that is worth building until the iOS scope question in §6 is answered.

## 6. Required owner inputs

None of these can be derived from the repository. Ads stay unimplemented until
they are supplied.

| Input                                                           | Why it is needed                                                                                                                                                                                                                                                                                                                                                   | Status   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **AdMob Android app ID**                                        | `app.config.ts` production guard; ships in the manifest                                                                                                                                                                                                                                                                                                            | ❗ owner |
| **Rewarded ad-unit IDs** (Freeze, Defuse, Revive, Double Bolts) | Per-placement production units; one shared unit is also acceptable if the owner prefers, but that loses per-placement reporting                                                                                                                                                                                                                                    | ❗ owner |
| **Interstitial ad-unit ID**                                     | Only if the owner wants interstitials at all (see risks)                                                                                                                                                                                                                                                                                                           | ❗ owner |
| **Privacy-policy URL**                                          | Required by Play and by UMP; also fills the dead Home privacy control                                                                                                                                                                                                                                                                                              | ❗ owner |
| **Audience / child-directed decision**                          | Drives `tagForChildDirectedTreatment`, `tagForUnderAgeOfConsent`, the Play Console content rating, whether personalized ads are permitted at all, **and whether the `AD_ID` permission must be stripped from the manifest (§5.2)** — so it gates the native build, not just runtime flags. Cannot be guessed; a wrong answer here is a policy violation, not a bug | ❗ owner |
| **Play Console access and configuration**                       | App created, package `com.blastdown.app` reserved, Data safety form, ads declaration, content rating questionnaire, target audience, and an internal-testing track for the first ad-enabled build                                                                                                                                                                  | ❗ owner |
| **AdMob ↔ Play linkage**                                        | AdMob app linked to the Play listing before real fill is reliable                                                                                                                                                                                                                                                                                                  | ❗ owner |
| **Published AdMob GDPR/EU consent message**                     | Created and published under AdMob → Privacy & messaging for this app. Until it exists, `requestInfoUpdate` returns "not required" and no form can appear, however correct the code is (§5.3)                                                                                                                                                                       | ❗ owner |
| **UMP test-device identifier**                                  | The hashed device id the SDK logs on first run, collected from the physical Android device. Required to see the EEA consent form from a non-EEA location (§5.3)                                                                                                                                                                                                    | ❗ owner |
| **iOS scope**                                                   | `app.config.ts` already carries an iOS app ID and the spec is Android-first. Confirm whether iOS is in scope now (adds ATT/SKAdNetwork work) or deferred                                                                                                                                                                                                           | ❗ owner |

## 7. Risks and unresolved decisions

- **Consent is all-or-nothing for compliance.** Serving a personalized ad before
  a required consent form is a policy breach, not a degraded experience. The
  initialization order in §2 is the mitigation and must be tested, not assumed.
- **The child-directed answer changes the design**, not just a flag. If the app
  is directed to children, personalized ads are off entirely and the UMP flow
  simplifies — but the Play content rating and Data safety answers must match.
  Blocking decision.
- **Interstitials are entirely unbuilt.** `showInterstitial`/`preloadInterstitial`
  exist on the interface but are called from nowhere, and none of the §11.3
  gating conditions (≥2 lifetime runs, ≥60 s run, ≥120 s since last, ≥45 s since
  a rewarded ad, ≤3 per 20-minute session, loaded, consented) or the session cap
  has an implementation or a home in config. Lifetime run count and session
  timing are not currently tracked. Open question for the owner: **ship rewarded
  ads only for the first release and defer interstitials?** Rewarded alone is
  lower risk and matches §3.5 ("valuable, not deceptive").
- **No device-verifiable ad behaviour on this machine.** There is no Android
  device or emulator here. Every ad path — fill, no-fill, dismissal, timeout,
  EEA consent form, offline — must be confirmed on hardware by the owner, and
  will be recorded, never fabricated.
- **Reward integrity must not regress.** The current guarantees — once-only
  `onEarned`, mutation behind a domain precondition, success reported only when
  the mutation applied, state preserved on every failure branch — are the
  property the real adapter is most likely to break. They are covered by tests
  today; those tests stay green against the real adapter's mapping, which is why
  the mapping is the only thing the adapter is allowed to do.
- **Preload and timeout tuning is unknown until measured on a device.** Values
  belong in config, not at call sites.
- **Native configuration cannot be shipped as a JS update.** Every item in §5 —
  the `AD_ID` decision, `delayAppMeasurementInit`, SDK levels, UMP debug wiring —
  lands only in a new development build. Getting one of them wrong costs a
  rebuild cycle on hardware this machine does not have, so they are settled on
  paper first.
- **`expo-build-properties` may become necessary** to pin Android SDK levels or
  strip `AD_ID` (§5.2, §5.5). It is not a dependency today. Adding it is a
  dependency change and waits for explicit approval.
- Pre-existing `expo-doctor` 19/20 dependency drift is unrelated to ads but sits
  in the same release path and should be cleared before the first production
  build.

## 8. Sequencing (proposed, not started)

1. Owner supplies §6 inputs and answers the child-directed and interstitial
   questions.
2. Android build configuration per §5: `AD_ID` handling for the answered
   audience, `delayAppMeasurementInit`, confirmed SDK levels, UMP debug wiring
   bound to `EXPO_PUBLIC_APP_ENV`.
3. Consent/UMP module + Settings privacy entry + privacy-policy route.
4. Ad-unit configuration and the extended production guard.
5. `GoogleAdService` adapter with mapping, preload and timeout.
6. Provider swap behind availability detection; mock stays the default.
7. Development build, then on-device validation of every branch — including the
   consent form, which needs the published AdMob message and the registered test
   device before it can appear at all.
8. Interstitials only if the owner opts in, with the §11.3 gate implemented
   against real tracked counters.

Nothing in steps 2–8 begins until step 1 is answered.
