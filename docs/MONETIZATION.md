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

# Phase 6B implementation — production ads and consent (2026-07-26)

Built on branch `phase-6b-production-ads-consent`, on top of the audit above.
Google test configuration only: **no production ad unit id is present anywhere
in this repository, and none may be added until §6 is answered.**

Sections 1–8 above are the audit as written on 2026-07-25. Where implementation
settled something the audit left open, it is corrected in §9.7 rather than
edited in place.

## 9.1 What shipped

| Area                | Files                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Build configuration | `app.config.ts`, `expo-build-properties@57.0.7`                                                                                      |
| Ad configuration    | `src/config/ads.ts`                                                                                                                  |
| Consent lifecycle   | `src/services/consent/*`, `src/config/consent.ts`                                                                                    |
| Rewarded provider   | `src/services/ads/rewardedPort.ts`, `GoogleRewardedAdPort.ts`, `GoogleAdService.ts`, `AdsRuntimeProvider.tsx`, `mobileAdsRuntime.ts` |
| Wiring              | `app/_layout.tsx`, `app/settings.tsx`, `src/components/SettingsScreen/SettingsView.tsx`                                              |
| Tests               | `adConfig.test.ts`, `googleAdService.test.ts`, `consentLifecycle.test.tsx`, `privacyOptions.test.tsx`, `adsRuntime.test.tsx`         |

## 9.2 Configuration

Ad unit ids are resolved in exactly one place, `src/config/ads.ts`. Screens
reference `REWARD_PLACEMENTS`; no component, analytics event or diagnostic ever
sees an id (asserted by a test).

- Development and preview resolve to Google's rewarded test unit for all four
  placements **even when production variables are set** — a dev build cannot
  request live inventory by accident.
- Production reads `EXPO_PUBLIC_ADMOB_REWARDED_FREEZE`, `_DEFUSE`, `_REVIVE` and
  `_DOUBLE_BOLTS`, with `EXPO_PUBLIC_ADMOB_REWARDED_DEFAULT` as a shared
  fallback, and leaves a placement **unmapped** when its id is missing or is
  still a test unit. An unmapped placement reports `unavailable` and is never
  requested.
- A production build fails on the build machine when any unit is missing or is a
  test unit, mirroring the existing app-id guard. The runtime deliberately does
  not throw: a shipped app degrades to "ads unavailable" rather than crashing.

`app.config.ts` cannot import from `src/` — Expo transpiles only the config entry
file — so the guard exists twice. `__tests__/domain/adConfig.test.ts` runs both
copies over the same fixture matrix and asserts they agree.

## 9.3 Native build

- `expo-build-properties@57.0.7` added for one reason: the UMP release ProGuard
  rule `-keep class com.google.android.gms.internal.consent_sdk.** { *; }`.
  There is no other Expo-config route to a ProGuard rule.
- `delayAppMeasurementInit: true` on the RNGMA plugin, so app-measurement does
  not start collecting before a consent decision exists.
- Verified against a local `expo prebuild --platform android`: the keep rule
  lands in the generated `proguard-rules.pro`, and the manifest carries the four
  RNGMA `meta-data` entries with `DELAY_APP_MEASUREMENT_INIT=true`. The
  generated `android/` directory was removed afterwards — the project stays
  CNG-managed.
- `com.google.android.gms.permission.AD_ID` is **not** declared by us and must
  not be. It is merged in from `play-services-ads` at Gradle merge time. It still
  has to be declared in Play's Data safety form, and stripped with
  `tools:node="remove"` if the app turns out to be child-directed (§5.2).

## 9.4 Consent lifecycle

Full behaviour in `docs/PRIVACY.md`. Design points worth recording here:

- `ConsentPort` is the seam; `UmpConsentPort` is the only consent module that
  imports the ad SDK, and it is deliberately **not** re-exported from the
  barrel. `app/_layout.tsx` constructs it. Everything else — lifecycle,
  Settings, every test — runs with no native module present.
- The provider never gates its children. Gameplay is offline; a pending,
  refused or failed consent request means ads are unavailable and nothing else.
- Consent is never persisted by us. UMP owns it.
- `canRequestAds` is read from UMP, never re-derived from the consent status.
- SDK initialization is guarded by a flag set before the await, so the launch
  gather, a development refresh and a return from the privacy form cannot race
  into two initializations; `initializeMobileAdsOnce` memoizes as well,
  including on rejection.
- Debug geography, test devices and the consent reset are development-build only,
  gated on `EXPO_PUBLIC_APP_ENV` — a build gate, not a runtime toggle.
- `tagForUnderAgeOfConsent` is never set, pending the audience decision.

## 9.5 Rewarded provider

`RewardedAdPort` reduces a rewarded ad to four events (loaded / earned / closed /
error). `GoogleRewardedAdPort` is the only ads module that imports the SDK and
carries no policy at all; every rule lives in `GoogleAdService`, which is
therefore fully testable against a fake port.

Reward safety, enforced in the service rather than at the four call sites:

- Only the SDK's earned-reward event produces `earned`. Close, load failure,
  show failure, timeout, missing ad unit and outstanding consent all resolve to
  a non-earning outcome.
- A presentation resolves exactly once — every path into the resolver passes a
  `settled` guard.
- A close with no reward yet holds a short grace window for a late earned event
  (the SDK does not contractually order the two) rather than dropping a reward
  the player earned. The once-only guard still holds.
- A presentation error _after_ earning keeps the reward.
- One ad on screen at a time across all placements; the gate is set
  synchronously, so two calls in the same tick cannot both pass. This layers
  under the pre-existing single-flight guard in `useRewardedAction`.
- Nothing here touches gameplay. The service returns a result; the caller applies
  the domain change, and only on `earned`.

Lifecycle: a rewarded ad is single-use, so the instance is released after every
presentation and every failure — a stale ad is never shown twice. The next ad is
preloaded once the slot frees, never while consent is outstanding. `dispose()`
settles anything a caller is still awaiting and drops every listener and timer,
so an unmount mid-presentation cannot leave a promise hanging.

Failure mapping is deliberate: no-fill, network error and load timeout are
`unavailable` — normal, quiet, no retry prompt, because this game is playable
entirely offline — while a refused presentation is `error`. Richer internal
reasons go to diagnostics with enumerated values only.

The consent gate is **pushed into** the service (`setAdsAllowed`) rather than
read out of it, so the ads seam holds no reference to the consent seam and a
mid-session decision takes effect on the next request without rebuilding the
service and discarding a preloaded ad.

## 9.6 Placements

All four wire through the existing seams unchanged: `app/game.tsx` freeze,
defuse and revive, `app/results.tsx` double Bolts. Eligibility guards,
confirmation dialog, per-run caps, analytics offer/result events, outcome
feedback and diagnostics are untouched — only what `AdService` resolves to has
changed. `rewarded_repair_blast` stays unmapped (post-MVP, BUILD_SPEC §6.18).

Interstitials report `unavailable`. No ad unit, no frequency policy, and whether
release 1 carries them at all is still an open owner decision (§7).

## 9.7 Corrections to the audit above

- **§5.5 / §7 — `expo-build-properties`.** Now installed (57.0.7), for the
  ProGuard rule rather than for SDK levels.
- **§5.5 — SDK levels.** Settled from `ExpoRootProjectPlugin.kt`: Expo SDK 57
  resolves `minSdk 24`, `compileSdk 35`, `targetSdk 35`. The ad SDK declares
  `minSdk 23`, so no override is needed. The audit's "must be confirmed at first
  prebuild" is discharged.
- **R8 is currently off.** `android.enableMinifyInReleaseBuilds` is unset, so the
  UMP keep rule is inert today. It is in place so that enabling minification
  later cannot silently break the consent form — a failure that appears only in
  a release build, only on device.
- **Adapter boundary.** The audit proposed a single `GoogleAdService.ts` with a
  lazy `require`. Implementation split it into a port plus an adapter — which is
  the right shape and made the reward state machine testable — but initially
  dropped the lazy require in favour of static imports, on the mistaken belief
  that keeping the SDK out of the barrels gave the same guarantee. It did not:
  see §9.10. Both ports now resolve the SDK lazily, as the audit originally
  said.
- **The dependency was already installed.** `react-native-google-mobile-ads@16.4.0`
  has been a committed dependency since Phase 0 and the Expo plugin was already
  wired in `app.config.ts`; only the JS adapter was missing. The Phase 6B brief
  stated otherwise.

## 9.8 Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check` — clean.
- Full suite green, twice: 99 suites / 687 tests, with `randomize: true`
  shuffling order within every file.
- `npx expo config --type public` evaluates with both new plugins.
- `npx expo prebuild --platform android` produces the expected manifest and
  ProGuard output (see §9.3).
- `npx expo export --platform android` exits 0.
- `npx expo-doctor` 19/20 — the one failure is the pre-existing upstream Expo
  patch-version drift, unchanged by this work; `expo-build-properties@57.0.7`
  is not among the mismatched packages.
- A read-only Codex integration audit of the diff found three real defects
  (consent re-checking across awaits, inventory left alive on withdrawal, raw
  SDK error text in diagnostics). All three are fixed and covered — see
  `docs/DECISIONS.md`.
- **Device validation is the owner's.** This build machine has no Android
  device, no Android SDK and no JDK. The checklist is in `docs/TEST_ADS.md`;
  results will be recorded, never fabricated.

## 9.9 Still blocked on the owner

Unchanged from §6, and now the only thing between this and a real ad:

- Audience: general, mixed, or child-directed — gates the native build.
- Production Android AdMob app id.
- Production rewarded ad unit id(s).
- Privacy-policy URL.
- Play Console: Ads, Advertising ID and Data safety declarations.
- Published AdMob GDPR consent message (nothing can show a form without it).
- UMP test-device identifier, read from the physical device.
- Whether interstitials ship in release 1.

## 9.10 The ad SDK must never be imported at module scope

Found at runtime, not by any test: the app crashed on startup with an
`ExpoRoot`/`ContextNavigator` stack the moment `app/_layout.tsx` began importing
the ad SDK.

`react-native-google-mobile-ads`'s entry point re-exports `AdsConsent`, which
pulls in a module that runs
`TurboModuleRegistry.getEnforcing('RNGoogleMobileAdsConsentModule')` **while it
loads**. `getEnforcing` throws when the native module is absent. So merely
importing the package takes the whole app down before a single screen renders,
in Expo Go and in any development build made before the ad SDK was autolinked.

Nothing had noticed because until Phase 6B **no JS in the app had ever imported
the package** — it was a dependency with a config plugin, never touched at
runtime. The port structure kept the SDK out of the _tests_, which is what the
suite was checking, but said nothing about the _runtime_. That is the gap: the
invariant "gameplay never depends on ads" was documented and believed, and was
not actually true.

The first fix — a lazy, try/catch-guarded `require` — was not enough. Catching
the throw does not stop React Native surfacing an `Invariant Violation` in
development, so a build without ads still showed a red error on every launch,
and the real failing module turned out to be `RNGoogleMobileAdsModule` (the
package's entry point loads **eight** spec modules, every one of them calling
`getEnforcing` eagerly, so a single missing module breaks the import).

`src/services/ads/adsSdk.ts` therefore does not catch the throw — it avoids
causing one. `TurboModuleRegistry.get` is the non-throwing variant, so all eight
native modules are probed first and the package is required only when every one
is present. Absent SDK now means no ads, silently, and nothing else —

- `createUmpConsentPort()` and `createGoogleRewardedAdPort()` construct without
  touching the SDK (both are built during render in `app/_layout.tsx`, which is
  exactly where the crash was).
- `ConsentPort.gather` rejects with an explanation; `ConsentProvider` treats it
  as a lifecycle failure, so ads are off and the tree still renders.
- `AdsRuntimeProvider` configures **no ad units** when the SDK is unavailable,
  so every placement reports `unavailable` and the rewarded port is never
  reached.
- The event and consent mappings now match the SDK's wire values instead of
  importing its enums, which keeps them pure; `adSdkMapping.test.ts` still drives
  them with the real enum members, so upstream value changes fail there rather
  than on a device.

`__tests__/integration/adsSdkUnavailable.test.tsx` reproduces the missing native
module and asserts the app still renders and stays playable.

**Practical consequence for running the app:** ads and consent need a
development build that includes the ad SDK. They do not work in Expo Go, and a
dev client built before Phase 6B needs rebuilding. Neither case breaks the game
any more — it runs with ads switched off.
