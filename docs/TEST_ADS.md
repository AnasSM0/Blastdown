# Testing ads and consent

How to exercise the rewarded and consent flows without touching live ad
inventory, and the device checklist that has to pass before real ad unit ids go
anywhere near this app.

Companion to `docs/MONETIZATION.md` (policy) and `docs/PRIVACY.md` (consent
behaviour).

## Test ad units

`src/config/ads.ts` is the only place an ad unit id is read.

- **Development and preview builds always resolve to Google's rewarded test
  unit**, `ca-app-pub-3940256099942544/5224354917`, for all four placements —
  even when production variables happen to be set in the environment. A
  development build can never request live inventory by accident.
- **Production reads per-placement variables** and leaves a placement _unmapped_
  when its id is missing or is still a Google test unit. An unmapped placement
  reports `unavailable` and is never requested.

App ids follow the same pattern one level up, in `app.config.ts`: Google's
sample app ids by default, real ids from `ADMOB_ANDROID_APP_ID` /
`ADMOB_IOS_APP_ID` for production.

Test ads serve real, fillable ad content with no AdMob account involved, so the
full load → show → earn → close path is genuinely exercised.

## Environment variables

All `EXPO_PUBLIC_`-prefixed values are inlined into the JS bundle at build time,
so they are read as literal `process.env.EXPO_PUBLIC_X` accesses. A computed
lookup would silently read `undefined` in a release bundle.

| Variable                                    | Used by         | Notes                                                            |
| ------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| `EXPO_PUBLIC_APP_ENV`                       | everything      | `development` · `preview` · `production`; set per EAS profile    |
| `EXPO_PUBLIC_ADMOB_REWARDED_FREEZE`         | production only | Rewarded unit for Freeze                                         |
| `EXPO_PUBLIC_ADMOB_REWARDED_DEFUSE`         | production only | Rewarded unit for Defuse                                         |
| `EXPO_PUBLIC_ADMOB_REWARDED_REVIVE`         | production only | Rewarded unit for Revive                                         |
| `EXPO_PUBLIC_ADMOB_REWARDED_DOUBLE_BOLTS`   | production only | Rewarded unit for Double Bolts                                   |
| `EXPO_PUBLIC_ADMOB_REWARDED_DEFAULT`        | production only | Fallback for any placement without its own                       |
| `EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY`           | dev builds only | `eea` · `regulated_us_state` · `other` · `disabled`              |
| `EXPO_PUBLIC_UMP_TEST_DEVICE_IDS`           | dev builds only | Comma-separated device hashes                                    |
| `ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID` | build time      | Not `EXPO_PUBLIC_`: read by `app.config.ts` on the build machine |

A production build **fails on the build machine** if any rewarded unit is
missing or is still a Google test unit. The runtime deliberately does not throw
— it degrades to "ads unavailable" — so a misconfiguration is caught at build
time rather than crashing a shipped app.

## Seeing the consent form outside the EEA

This is the part that costs a day if you skip it. Three things must all be true
before a UMP form can appear:

1. **A published AdMob consent message.** AdMob → Privacy & messaging → GDPR,
   created _and published_ for this app. Without it, `requestInfoUpdate` returns
   "not required" and no form appears however correct the code is. This is the
   single most common reason a correct implementation looks broken. **Owner
   input — not yet supplied.**
2. **A forced debug geography.** `EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY=eea`.
3. **A registered test device.** `EXPO_PUBLIC_UMP_TEST_DEVICE_IDS=<hash>`.

### Getting the device hash

Install the development build on the physical device, launch it once, and read
logcat:

```
adb logcat | grep -i "setTestDeviceIds\|test device"
```

The ad SDK logs a line of the form
`Use RequestConfiguration.Builder.setTestDeviceIds(Arrays.asList("33BE2250B43518CCDA7DE426D04EE231"))`.
The quoted hash is the value for `EXPO_PUBLIC_UMP_TEST_DEVICE_IDS`. It is
per-device and changes on reinstall.

Debug geography and test devices are **ignored outside a development build**
(`CONSENT_DEBUG_ENABLED` in `src/config/consent.ts`), so a forced geography
cannot reach a preview or production build.

### Replaying first-install consent

Settings → **RESET CONSENT (DEV)** clears UMP's stored decision and re-runs the
launch sequence, so the first-install form appears again without reinstalling.
The row exists in development builds only.

## Building for device

There is no Android SDK or JDK on the repository build machine, so the native
build is done on the device owner's machine or via EAS.

```
# EAS (development profile sets EXPO_PUBLIC_APP_ENV=development)
npx eas build --profile development --platform android

# or locally, with an Android SDK and JDK present
npx expo prebuild --platform android
npx expo run:android
```

The native configuration in `app.config.ts` — the UMP ProGuard rule,
`delayAppMeasurementInit`, the AdMob app id — **cannot ship as a JS update**.
Any change to it needs a new native build.

### Confirmed by prebuild (2026-07-26)

- The UMP keep rule lands in `android/app/proguard-rules.pro`:
  `-keep class com.google.android.gms.internal.consent_sdk.** { *; }`
- The manifest carries the four RNGMA `meta-data` entries, with
  `DELAY_APP_MEASUREMENT_INIT` = `true`.
- `com.google.android.gms.permission.AD_ID` is **not** written by us. It is
  merged in from `play-services-ads` at Gradle merge time, and must not be
  duplicated in `app.config.ts`. It still has to be declared in Play's Data
  safety form.
- Expo SDK 57 resolves `minSdk 24`, `compileSdk 35`, `targetSdk 35` (defaults in
  `ExpoRootProjectPlugin.kt`). The ad SDK declares `minSdk 23`, so no override
  is needed.
- `android.enableMinifyInReleaseBuilds` is unset, so R8 is currently off for
  release builds and the ProGuard rule is inert. It is in place so that enabling
  minification later cannot silently break the consent form — a failure that
  only shows up in a release build, on device.

## Device QA checklist

Run on a **physical Android device** with a development build. Record results;
never infer them. Nothing here can be verified on the repository build machine.

**Results live in `docs/debug/2026-07-28-fabric-consent-crash/device-qa-record.md`,
not in this file.** This is the checklist; that is the record of what has
actually been observed. As of 2026-07-28 exactly one line of it is ticked — the
Fabric crash no longer reproduces on the device that reproduced it reliably
(commit `2f2f03c`). Every ads and consent scenario below is still open.

Sections 2 and 3 of that record are blocked on a published AdMob consent
message. Section 4 — the four rewarded placements — is **not** blocked: Google
test ads need no AdMob account and can be run today.

**Consent**

- [ ] First install with `EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY=eea` and the device
      registered: the consent form appears at launch.
- [ ] Accepting the form leads to ads being requestable.
- [ ] Declining leaves the game fully playable and rewarded buttons resolve
      without granting anything.
- [ ] Settings shows **PRIVACY OPTIONS** under the forced EEA geography.
- [ ] The privacy form reopens, and reopens again after being used.
- [ ] Dismissing or failing the privacy form leaves the row on screen and a
      second press reopens it.
- [ ] Settings shows **RESET CONSENT (DEV)**; using it replays the launch form.
- [ ] With no forced geography, no form appears and no privacy row is shown.

**Rewarded ads — each of Freeze, Defuse, Revive, Double Bolts**

- [ ] Test ad loads and presents.
- [ ] Watching to completion grants the reward exactly once.
- [ ] Closing early grants nothing, and the run state is untouched.
- [ ] Repeating the same reward within a run behaves per the existing per-run
      caps — no change from Phase 3.
- [ ] Existing eligibility, confirmation dialog, analytics and outcome feedback
      are unchanged.

**Failure and lifecycle**

- [ ] Airplane mode: the button resolves as unavailable, no error dialog,
      gameplay continues normally.
- [ ] Backgrounding during an ad and returning does not double-grant, and does
      not leave the game locked.
- [ ] Rapid double-press on a reward button presents one ad only.
- [ ] Restart and Home leave no lingering ad, timer or locked input.
- [ ] Second reward in the same run presents promptly (the previous completion
      preloads the next ad).

**Performance (Phase 2/3 regression check)**

- [ ] Drag responsiveness unchanged.
- [ ] No new stutter around a reward presentation or on return from an ad.
- [ ] No black or invisible blocks after an ad closes.

## Before production ad ids go in

1. Every box above ticked on device with test ads.
2. Owner supplies the §6 inputs in `docs/MONETIZATION.md`.
3. The audience / child-directed decision is recorded — it gates the `AD_ID`
   handling in the native build, not just a runtime flag.
4. Play Console ads, Advertising ID and Data safety declarations match the
   merged manifest.

## Running the app without an ad-enabled build

Ads and consent require a **development build that includes the ad SDK**. They
do not work in Expo Go, and a dev client built before Phase 6B has no Google
Mobile Ads native module in it.

Neither case breaks the game. The SDK is resolved lazily behind a guard, so a
binary without it runs normally with ads switched off: the consent lifecycle
reports a failure (visible once in diagnostics), every rewarded placement
resolves `unavailable`, and gameplay is untouched.

If ads appear to do nothing, check this first — a stale dev client is the usual
explanation, and `npx expo start -c` alone will not fix it because the missing
piece is native, not JS. Rebuild.
