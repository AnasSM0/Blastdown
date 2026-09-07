# Android qualification baseline

## A-06B — 2026-09-07 (Asia/Karachi)

Physical device and Android version: **NOT AVAILABLE**.
FPS: **NOT MEASURED**. Frame time: **NOT MEASURED**.
Memory: **NOT MEASURED**. Physical renderer verdict: **NOT VERIFIED**.
Cloud compilation, APK inspection, and exports are separate evidence below.

## Frozen source and runtime

Both named qualification builds use commit
`33f23d6a71e714f1cc9b07610563017de51a867a`. Application source, app config,
package.json, and package-lock.json are unchanged from A-05 commit
`e3aadc96541eade966c23a2997cda0c857f81f97`. Subsequent evidence-only commits
will not alter the tested application. Use `npm ci` to reproduce this graph.

Lockfile SHA-256:
`740b4d1ceb747cddd4c17cb41c19f940ed011500f7bf816809ee6737bfd530b7`.

| Component                                   | Locked version                      |
| ------------------------------------------- | ----------------------------------- |
| Expo / React / React Native                 | 57.0.17 / 19.2.3 / 0.86.3           |
| Hermes V1 / hermes-compiler                 | 250829098.0.17                      |
| Reanimated / Worklets                       | 4.5.1 / 0.10.1                      |
| Gesture Handler / Skia                      | 2.32.0 / 2.6.2                      |
| Screens / Safe Area / AsyncStorage          | 4.26.2 / 5.7.0 / 2.2.0              |
| Google Mobile Ads                           | 16.3.4                              |
| Expo Router / Dev Client                    | 57.0.17 / 57.0.16                   |
| Expo Asset / Constants / Font               | 57.0.15 / 57.0.15 / 57.0.1          |
| Expo Audio / Haptics / Linking              | 57.0.4 / 57.0.2 / 57.0.8            |
| Expo Splash Screen / Status Bar / System UI | 57.0.8 / 57.0.1 / 57.0.3            |
| Local Node / npm                            | 22.16.0 / 10.9.2                    |
| EAS CLI / cloud Node / cloud npm            | 23.2.0 / 22.23.1 / 10.9.8           |
| Cloud Android image                         | ubuntu-26.04-jdk-17-ndk-r27b-sdk-57 |
| Cloud Java / NDK                            | 17 / 27.1.12297006                  |
| Package / app version / build number        | com.blastdown.app / 1.0.0 / 1       |

Hermes is recorded in React Native's `sdks/hermes-engine/version.properties`
and the installed compiler package. No dependencies changed in A-06B.

## Original A-06 builds retained

| Mode | Build                                                                                                                                    | Result   | APK                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| OFF  | [1fdb6c12-3c28-44f3-a3c1-57959f729df5](https://expo.dev/accounts/anassm0/projects/blastdown/builds/1fdb6c12-3c28-44f3-a3c1-57959f729df5) | FINISHED | [Original fallback APK](https://expo.dev/artifacts/eas/AMEA7Wquj4PIlAEUmCrqEAFJx1AcXoAGav3b6c2JGo4.apk)  |
| ON   | [6b186ef5-947a-4ed9-8c6c-11d7b8fef5cd](https://expo.dev/accounts/anassm0/projects/blastdown/builds/6b186ef5-947a-4ed9-8c6c-11d7b8fef5cd) | FINISHED | [Original cinematic APK](https://expo.dev/artifacts/eas/f8Rnm0QYtYvtLY1t9bi0fu47fbnXsWN41x0kkO2sx3o.apk) |

Profiles were `development-cinematic-off` / `development-cinematic-on`.
Worker logs confirm the development environment, flags 0 / 1, SDK-57 image,
successful `:app:assembleDebug`, and Google's sample AdMob app IDs. Runtime
versions are the A-05 graph. Their EAS `gitCommitHash` is null because uploads
used `EAS_NO_VCS=1`: local history associates these with A-06's `e9e86a0`, but
an exact uploaded commit cannot be independently certified from EAS metadata.
The artifacts remain evidence; they were not discarded as stale.

Earlier jobs `db0fed1e-b045-49c0-a6c0-925ce0fd0eec` and
`459615ff-a5aa-4e2a-a8c8-490c221955c0` ended with EAS `SERVER_ERROR`, lost
connection to the worker. That generic message cannot establish OOM versus
network failure. Successful original retries establish that no application fix
was required for this dependency graph to compile in the cloud.

## Named qualification builds

| Mode | Profile                         | Flag | EAS build                                                                                                                                | Result / APK                                                                                               |
| ---- | ------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| OFF  | android-qualification-fallback  | 0    | [303a3b6c-9668-4338-937e-877f161531ea](https://expo.dev/accounts/anassm0/projects/blastdown/builds/303a3b6c-9668-4338-937e-877f161531ea) | FINISHED / [fallback APK](https://expo.dev/artifacts/eas/8cy6Qwi_NxgaaHhIFTSOuITJrsldjfb79xm6bMbg-7Q.apk)  |
| ON   | android-qualification-cinematic | 1    | [24190ab7-2526-4f90-b8e2-8bf0ef9cb87d](https://expo.dev/accounts/anassm0/projects/blastdown/builds/24190ab7-2526-4f90-b8e2-8bf0ef9cb87d) | FINISHED / [cinematic APK](https://expo.dev/artifacts/eas/OP2YUrCwNVK7ft8XM5oo4pVNJJxV3QUzhj7ryE0yOpU.apk) |

Both record Git commit `33f23d6a71e714f1cc9b07610563017de51a867a` and
native fingerprint `e71380c7fab6e1f587fa625cf58b7b3c495f8f5d`.
They qualify the new named configuration and restore missing source provenance.
Logs record literal flags 0 / 1 and successful `:app:assembleDebug` tasks.

Both downloaded APKs are 326,435,031 bytes and have SHA-256
`6874348e64d7586272c5652da3e779d85188734a77bba9320011856d406f0f56`.
They are byte-identical, which is correct for this development-client design:
the profiles compile the same native runtime and the clean Metro session selects
the renderer. ZIP inspection found 1,727 entries, ten DEX files, package marker
`com.blastdown.app`, and Hermes/Skia native libraries for `arm64-v8a`,
`armeabi-v7a`, `x86`, and `x86_64`. This establishes valid archive structure,
not successful installation or launch.

Both profiles are explicit, without `extends`: `developmentClient: true`,
`distribution: internal`, `environment: development`, Android `buildType: apk`,
the same pinned Node and image, and `EXPO_PUBLIC_APP_ENV=development`.
Only `EXPO_PUBLIC_CINEMATIC_BOARD` differs. CLI `requireCommit: true` rejects
dirty uploads. Identifiers, signing, and AdMob configuration are unchanged.

A development APK loads JavaScript from Metro; the profile flag does **not**
permanently fix the Metro-served bundle inside that APK. The matching clean
Metro start and runtime diagnostic are mandatory. Both native clients can
contain Skia libraries. Static JS exclusion below applies to production
exports, not native APK libraries or development Metro dead-code elimination.

### Windows archive blocker and future cloud commands

EAS 23.2.0 initially failed before upload in temporary shallow-clone cleanup:
`ENOTEMPTY` on `.git`. Inspection found a leftover reparse-point entry there.
A clone with `core.symlinks=false` left no such entry; the same process-scoped
setting allowed EAS to upload with Git metadata enabled. No vendor code was
patched. There are no tracked symlinks; reassess this setting if any are added.

Run in **Windows CMD** from a clean checkout of the frozen commit:

```bat
cd /d "C:\Users\Anas SM\Desktop\blastdown"
git status --short
git rev-parse HEAD
npm ci
set "EAS_NO_VCS="
set "GIT_CONFIG_COUNT=1"
set "GIT_CONFIG_KEY_0=core.symlinks"
set "GIT_CONFIG_VALUE_0=false"
npx eas-cli@23.2.0 build --platform android --profile android-qualification-fallback --non-interactive --no-wait --json
npx eas-cli@23.2.0 build --platform android --profile android-qualification-cinematic --non-interactive --no-wait --json
set "GIT_CONFIG_COUNT="
set "GIT_CONFIG_KEY_0="
set "GIT_CONFIG_VALUE_0="
```

Do not edit files between the uploads. Successful stored APKs need no rebuild.
Cloud image and artifact retention depend on EAS; preserve APKs and hashes.

## Expo Doctor drift investigation

`git diff e3aadc9 -- package.json package-lock.json` is empty. Installed
`expo/bundledNativeModules.json` matches the lockfile. Online, Expo CLI's
`getVersionedNativeModulesAsync` instead fetches live
`sdks/57.0.0/native-modules`; `getCombinedKnownVersionsAsync` overlays
`versions/latest`. These cache for one and five minutes, respectively.
Installed metadata is a fallback. A new Doctor version is therefore not
necessary to explain the changed recommendation.

| Package         | Installed | Live recommendation on 2026-09-07 |
| --------------- | --------- | --------------------------------- |
| expo            | 57.0.17   | ~57.0.20                          |
| expo-asset      | 57.0.15   | ~57.0.16                          |
| expo-constants  | 57.0.15   | ~57.0.17                          |
| expo-dev-client | 57.0.16   | ~57.0.18                          |
| expo-font       | 57.0.1    | ~57.0.3                           |
| expo-linking    | 57.0.8    | ~57.0.9                           |
| expo-router     | 57.0.17   | ~57.0.19                          |

Only **packages match versions required by installed Expo SDK** fails (20/21);
`expo install --check` exits 1 for the same seven recommendations. No checks
are suppressed and no offline result substitutes for the live check.

A-06B accepts this lockfile for Android qualification: cloud builds succeed,
the graph matches SDK-57's installed map, and the reviewed patch changes
identify no required Android correctness/security fix among those seven.
Expo's functional change concerns iOS reloads and Font's concerns web fonts;
the other listed release entries report no user-facing changes. Sources:
[Expo](https://github.com/expo/expo/blob/sdk-57/packages/expo/CHANGELOG.md),
[Asset](https://github.com/expo/expo/blob/sdk-57/packages/expo-asset/CHANGELOG.md),
[Constants](https://github.com/expo/expo/blob/sdk-57/packages/expo-constants/CHANGELOG.md),
[Dev Client](https://github.com/expo/expo/blob/sdk-57/packages/expo-dev-client/CHANGELOG.md),
[Font](https://github.com/expo/expo/blob/sdk-57/packages/expo-font/CHANGELOG.md),
[Linking](https://github.com/expo/expo/blob/sdk-57/packages/expo-linking/CHANGELOG.md),
[Router](https://github.com/expo/expo/blob/sdk-57/packages/expo-router/CHANGELOG.md).

`npm ci` reports 23 audit findings (16 moderate, 7 high). Advisory roots include
xmldom, brace-expansion, browserslist, decode-uri-component, image-size,
js-yaml, and uuid. Many counts propagate through build tooling;
decode-uri-component is also in Router's query-string path. This is not a
security-clean declaration. These seven top-level recommendations do not
establish a fix for all audit findings. Separate security triage remains;
no forced SDK downgrade or blanket audit fix was applied.

## Clean OFF → ON → OFF exports

Run `node scripts/verify-android-qualification.cjs` from the repository root.
It runs the installed Expo CLI's production Android exports with `--clear`,
`--source-maps`, distinct outputs, explicit app/renderer variables, and
`EXPO_NO_DOTENV=1`. It checks source-map exclusion/inclusion, Hermes markers,
and identical first/last OFF hashes. Logs and a JSON report are retained under
ignored `dist/qualification-*`.

| Run       | Modules | HBC bytes | Cinematic/Skia source entries | Compiled markers |
| --------- | ------: | --------: | ----------------------------: | ---------------- |
| OFF first |   1,846 | 3,297,160 |                             0 | Absent           |
| ON        |   2,118 | 3,789,716 |                           226 | Present          |
| OFF again |   1,846 | 3,297,160 |                             0 | Absent           |

Markers: `CinematicBoardCanvas`, `buildBoardScene`, `buildEffectScene`.
OFF SHA-256: `3e56a75dc8db921c160545a5716a594293df2da1f3506252e6d7c06b17120c58`.
ON SHA-256: `1f8e16866f96c5c4691cc6799c43ca38694a0e2b963b72bb742706b9b7f45b9e`.
These are this source-map-enabled procedure's sizes, not the differently
configured A-05 sizes. None measure device FPS.

## Physical-device procedure — Windows CMD only

1. Download **SDK Platform-Tools for Windows** from
   [Android's official page](https://developer.android.com/tools/releases/platform-tools),
   accept its license, and extract `platform-tools` to
   `%LOCALAPPDATA%\Android\platform-tools`. Java/Gradle are unnecessary for
   installing an already-built APK.
2. On the phone, tap Build number seven times; enable Developer Options → USB
   debugging, connect USB, and approve the computer's RSA prompt.
3. Use one attached device. If adb says `unauthorized`, unlock and approve the
   phone; if no device appears, check the cable and OEM USB driver.

```bat
cd /d "C:\Users\Anas SM\Desktop\blastdown"
set "PATH=%LOCALAPPDATA%\Android\platform-tools;%PATH%"
adb version
adb devices
mkdir dist\device-evidence
adb shell getprop ro.product.model > dist\device-evidence\model.txt
adb shell getprop ro.build.version.release > dist\device-evidence\android.txt
adb shell getprop ro.build.version.sdk >> dist\device-evidence\android.txt
adb shell getprop ro.product.cpu.abilist > dist\device-evidence\abis.txt
```

Download the final APK links above as `dist\qualification-apks\fallback.apk`
and `dist\qualification-apks\cinematic.apk`; both must match SHA-256
`6874348e64d7586272c5652da3e779d85188734a77bba9320011856d406f0f56`.
Both install as `com.blastdown.app` and replace each other. `adb install -r`
preserves app data. Do not uninstall/clear storage during persistence checks.

In CMD window 1, install OFF and start Metro:

```bat
certutil -hashfile dist\qualification-apks\fallback.apk SHA256
adb install -r dist\qualification-apks\fallback.apk
adb reverse tcp:8081 tcp:8081
set "EXPO_NO_DOTENV=1"
set "EXPO_PUBLIC_APP_ENV=development"
set "EXPO_PUBLIC_CINEMATIC_BOARD=0"
npx expo start --dev-client --clear
```

Use the frozen application source and `npm ci` for Metro. Accept port 8081
only: stop the old Metro server with Ctrl+C if occupied. Do not reuse another
server or an old recent-server entry in the development-client launcher.

In CMD window 2, repeat the PATH/working-directory setup, then launch and log:

```bat
adb shell am force-stop com.blastdown.app
adb shell am start -a android.intent.action.VIEW -d "blastdown://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" com.blastdown.app
adb logcat -v threadtime > dist\device-evidence\fallback-logcat.txt
```

The URL is for interactive CMD; if saving it as a `.bat` file, double every
literal `%`. Stop logging with Ctrl+C. In Settings → Effect harness, the
existing diagnostic must read `renderer views` (OFF/0) or `renderer skia`
(ON/1). It reports the resolved renderer; the profile and build logs record
literal 0/1. Discard runs where the diagnostic disagrees with the selected flag.

Stop OFF Metro and logging with Ctrl+C, then in window 1:

```bat
adb shell am force-stop com.blastdown.app
certutil -hashfile dist\qualification-apks\cinematic.apk SHA256
adb install -r dist\qualification-apks\cinematic.apk
adb reverse tcp:8081 tcp:8081
set "EXPO_NO_DOTENV=1"
set "EXPO_PUBLIC_APP_ENV=development"
set "EXPO_PUBLIC_CINEMATIC_BOARD=1"
npx expo start --dev-client --clear
```

Launch the same URL in window 2 and log to `cinematic-logcat.txt`. Repeat the
same scenarios. Then stop Metro, reinstall fallback with `-r`, set the flag
explicitly to `0`, and restart with `--clear`; the diagnostic must return to
`views`. Cold process restart plus the cleared Metro session is mandatory.

### Scenarios and measurements

Record device, APK hash, commit, flag, diagnostic, and start time for each run.
Test fresh launch/Home, New Game confirm/cancel, Continue after hydration,
repeated placement, rows/columns/simultaneous clears, timed pieces, natural
defuse, explosions/rubble, combo, Freeze/Defuse, Pause/Resume/Back, Restart
confirm/cancel, Results/Play Again/Home, rapid repeated actions, background/
resume, and force-stop/relaunch after allowing persistence to flush. Results
Back must not reopen completed gameplay. Use the existing Effect harness for
identical effects; observe duration/overlaps/missing effects and delivery
latency. The previous disappearing-effects report still needs hardware evidence.

In a further CMD window, while gameplay runs:

```bat
adb shell dumpsys meminfo com.blastdown.app > dist\device-evidence\fallback-memory-start.txt
adb shell dumpsys gfxinfo com.blastdown.app reset
```

Exercise one named scenario, then capture frames. Take the second memory
sample after an actual ten-minute session:

```bat
adb shell dumpsys gfxinfo com.blastdown.app framestats > dist\device-evidence\fallback-placement-frames.txt
adb shell dumpsys meminfo com.blastdown.app > dist\device-evidence\fallback-memory-10min.txt
```

Repeat with distinct filenames for idle, placement, line clear, explosions/
rubble, concurrent effects, timer danger, and ON. `gfxinfo`/HWUI metrics can
miss separately rendered Skia surfaces: prefer Android System Tracing/Perfetto
FrameTimeline for display-level frame pacing. Record refresh rate/tool and
retain raw traces. Effect delivery timings are not FPS; an empty frame trace
cannot establish smoothness. Observe audio/haptic settings and repeated cues,
resource behavior after backgrounding, and native errors on the actual device.

## Verification and gate

- `npm ci`: passed; unchanged lockfile, audit findings above.
- Typecheck, lint, and format check: passed.
- `npm test -- --runInBand`: 111 suites / 902 tests passed.
- `npm run test:coverage -- --runInBand`: 111 suites / 902 tests passed;
  statements 88.69%, branches 81.05%, functions 87.97%, lines 88.32%.
- Existing React `act` warnings remain; no mocks/skips added.
- Profile contract test and clean export verifier passed.
- `npx expo install --check`: exit 1, seven documented patch deltas.
- `npx expo-doctor`: 20/21, the same live-map deltas.
- `git diff --check`: passed.

Named cloud builds and artifact inspection passed. Classification is
**A-DEVICE-PENDING**: the reproducible cloud-build and artifact gate is clear,
and only physical Android qualification remains. Physical performance, renderer
behavior, audio/haptics, and persistence/navigation are still unverified.
B-01 has not begun.
