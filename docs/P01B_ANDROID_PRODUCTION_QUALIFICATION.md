# P-01B Android production qualification

## Status — 2026-09-11 (Asia/Karachi)

**Build status: BLOCKED BY OWNER CONFIGURATION.** The Android/iOS validation
coupling is fixed and production rewarded ads now fail closed per placement,
but the EAS `production` environment contains no variables. A real AAB cannot
be generated without the owner-provided Android AdMob App ID. No test, guessed,
or hardcoded ID was used to bypass this gate.

| Provenance                    | Value                                               |
| ----------------------------- | --------------------------------------------------- |
| Base commit                   | `0edbd1508eddd707ba8f270e17163db5c19280cf`          |
| Branch                        | `fix/android-production-admob-build`                |
| Intended profile              | EAS `production`, Android App Bundle, cinematic OFF |
| EAS production variables      | None                                                |
| Metro qualification evidence  | ignored `dist/qualification-1789145400025`          |
| Physical Android / bundletool | Not available; bundletool requires the blocked AAB  |

## Root cause and fix

The Google Mobile Ads config plugin declares `androidAppId?` and `iosAppId?`
independently. Its Android mod writes only
`com.google.android.gms.ads.APPLICATION_ID` to AndroidManifest.xml; its iOS mod
writes only `GADApplicationIdentifier` to Info.plist. Missing values produce a
platform-specific warning, and unselected platform mods are not generated.

BlastDown's `app.config.ts` instead had one unconditional production check for
both environment variables. EAS evaluates dynamic config locally before upload,
so every Android build stopped there even though Android native generation does
not consume the iOS ID.

The production profile now supplies `BLASTDOWN_BUILD_PLATFORM=android` in its
Android `env` block and `ios` in its iOS block. The app config requires only the
selected platform App ID, passes only that value to the plugin, rejects Google
sample or malformed production identifiers, and retains a fail-closed both-ID
check when no platform is declared. Focused config tests prove Android resolves
without an iOS ID and iOS resolves without an Android ID.

## Required production variables and status

Values are not printed. Suffixes are unavailable because every value is
missing from both the current process and EAS production.

| Android variable                        | Status  | Effect                                            |
| --------------------------------------- | ------- | ------------------------------------------------- |
| `ADMOB_ANDROID_APP_ID`                  | MISSING | Mandatory; blocks production Android config/build |
| `ADMOB_ANDROID_REWARDED_FREEZE_UNIT_ID` | MISSING | Freeze returns `unavailable`; no reward           |
| `ADMOB_ANDROID_REWARDED_DEFUSE_UNIT_ID` | MISSING | Defuse returns `unavailable`; no reward           |

Add these to EAS production with sensitive visibility. They are identifiers
embedded in the client rather than server secrets, but must not be committed or
echoed in reports.

## Production rewarded behavior

`AdServiceProvider` selects `GoogleMobileAdsService` only for production native
builds. Development and tests retain the deterministic mock. Missing unit IDs
return `unavailable` without initializing the SDK. Present units initialize
lazily, keep one bounded pending ad per approved placement, and request
non-personalized inventory. The service returns `earned` only when the SDK sends
an earned event and then closes. Close-without-earn, load error, show error, or
missing inventory cannot mutate gameplay. The existing single-flight and
mounted checks remain the sole bridge to domain actions.

Consent/privacy UI remains a separate release gate. Non-personalized requests
do not substitute for the approved consent flow.

## AAB and delivery measurements

| Requested measurement                          | Result                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| EAS build ID / artifact URL                    | UNAVAILABLE — build cannot start                                                    |
| Source commit in artifact                      | UNAVAILABLE                                                                         |
| Raw AAB size / SHA-256                         | UNAVAILABLE                                                                         |
| Package / version / versionCode                | Intended `com.blastdown.app` / `1.0.0` / remote auto-increment; unverified artifact |
| targetSdk / minSdk / ABIs                      | UNAVAILABLE without generated native artifact                                       |
| Native libraries / resources / assets / Hermes | UNAVAILABLE without AAB                                                             |
| arm64-v8a download/install estimate            | UNAVAILABLE without AAB and bundletool/device spec                                  |
| armeabi-v7a download/install estimate          | UNAVAILABLE without AAB and bundletool/device spec                                  |
| Preferred ≤100 MB download / ≤150 MB installed | NOT ASSESSABLE                                                                      |

The retained 311.31 MiB four-ABI development client remains invalid evidence
for these release targets. A fresh release-mode Metro OFF → ON → OFF
qualification reproduced byte-for-byte across both OFF exports:

| Export            | Modules | Hermes bytes | Asset files / bytes | HBC + assets |
| ----------------- | ------: | -----------: | ------------------: | -----------: |
| P-01 baseline OFF |   1,870 |    3,356,700 |      81 / 7,539,064 |   10,895,764 |
| P-01B current OFF |   1,967 |    3,468,244 |      51 / 4,534,938 |    8,003,182 |
| P-01B current ON  |   2,240 |    3,972,472 |      51 / 4,534,938 |    8,507,410 |

The current OFF export remains 2,892,582 bytes (26.55%) below the P-01
baseline. Wiring the required Google Mobile Ads production adapter adds 127,064
Hermes bytes relative to P-01's final mock-only export, while preserving all
3,004,126 bytes of font/audio asset savings. These are Metro/export
measurements, not a production AAB or Play-delivery estimate.

## Static production exclusion evidence

The production cinematic-OFF autolinking contract still excludes Skia,
Reanimated, and Worklets from Android native configuration while retaining them
for cinematic/development profiles. `revive.wav` remains absent, the export has
exactly the approved six font files, and removed faces did not return. The
production profile has no development-client flag. Release source maps retain
the two tiny compile-time development entry guards, but not
`EffectHarnessScreen`, `PlaytestObserver`, `PlaytestRecorder`, or recorder
runtime implementations. Expo dev-client sources are absent. Reanimated and
Worklets JavaScript remain transitively reachable in the Metro graph; the
native autolinking exclusion—not a JS-source claim—is the proof P-01 provides.

The production React Native autolink result includes Google Mobile Ads and
excludes the three cinematic native packages. Expo's separate module resolver
still enumerates `expo-dev-client`, `expo-dev-launcher`, `expo-dev-menu`, and
`expo-dev-menu-interface`; configuration resolution alone therefore cannot
prove their compiled release contribution is zero. The AAB inventory remains
the required definitive check.

These are source/config/export proofs only. Definitive YES/NO statements for
native libraries and Expo dev-client runtime require the real AAB; until then
their artifact presence is **UNVERIFIED**, not inferred.

## Verification

- `npm ci`: passed; 1,084 packages installed from the lockfile. npm reported 24
  existing audit findings (16 moderate, 8 high); dependencies were not changed.
- Focused AdMob/config/autolinking tests: 5 suites, 14 tests passed.
- Full Jest, run twice independently: 144 suites, 1,129 tests passed on each
  run.
- Coverage: 89.62% statements, 83.26% branches, 88.55% functions, 89.71%
  lines.
- TypeScript, ESLint, Prettier, diff whitespace, and Graphify gates are recorded
  in the task handoff after their final post-edit run.

## Required completion procedure

After the owner adds the three Android variables:

1. Run the clean committed EAS `production` Android build.
2. Record build ID, source commit, URL, raw bytes, SHA-256, package metadata,
   SDK levels, ABIs, and native library inventory.
3. Run `npm run analyze:android-size -- <artifact.aab>` and search explicitly
   for Skia, Reanimated, Worklets, and dev-client content.
4. Use official bundletool device specs for arm64-v8a and armeabi-v7a; record
   compressed download and installed APK-set sizes separately.
5. Compare those device results with the 100 MB / 150 MB preferred targets.
