# Android Performance Baseline

## A-06 qualification record — 2026-09-07

### Build under qualification

| Field                     | Value                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Source commit             | `e3aadc96541eade966c23a2997cda0c857f81f97` (`fix(runtime): align expo and react native dependencies`) |
| Expo / React Native       | Expo 57.0.17 / React Native 0.86.3                                                                    |
| Hermes V1                 | `250829098.0.17`                                                                                      |
| React / Reanimated / Skia | 19.2.3 / 4.5.1 / 2.6.2                                                                                |
| Android package           | `com.blastdown.app`                                                                                   |
| Development client type   | Internal-distribution Android APK                                                                     |

The application/runtime source under qualification is
`e3aadc96541eade966c23a2997cda0c857f81f97`. The two explicit renderer build
profiles were introduced by A-06 commit
`e9e86a0cad158cf6148d5eba41ce3ac7e26a2391`; no gameplay or renderer source
was changed for this qualification.

### Reproducible development-client builds

Both profiles create a fresh development-client APK through EAS. They set the
renderer flag in the profile rather than relying on a shell variable, and each
build should clear the remote build cache:

```text
npx eas-cli build --platform android --profile development-cinematic-off --clear-cache
npx eas-cli build --platform android --profile development-cinematic-on --clear-cache
```

On this Windows workstation, invoke the command with `EAS_NO_VCS=1` only as a
workaround for the initial EAS CLI shallow-clone cleanup failure. The retry
uploads completed with current EAS CLI 23.2.0 and `--clear-cache`:

| Renderer | Build ID                                                                                                                                   | Submitted  | Current result                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------- |
| OFF      | [`1fdb6c12-3c28-44f3-a3c1-57959f729df5`](https://expo.dev/accounts/anassm0/projects/blastdown/builds/1fdb6c12-3c28-44f3-a3c1-57959f729df5) | 2026-09-06 | In progress at record time; no APK yet |
| ON       | [`6b186ef5-947a-4ed9-8c6c-11d7b8fef5cd`](https://expo.dev/accounts/anassm0/projects/blastdown/builds/6b186ef5-947a-4ed9-8c6c-11d7b8fef5cd) | 2026-09-06 | In progress at record time; no APK yet |

The first pair of submitted jobs reached remote workers but failed without an
artifact with EAS `SERVER_ERROR` (“lost connection to the worker”): OFF
[`db0fed1e-b045-49c0-a6c0-925ce0fd0eec`](https://expo.dev/accounts/anassm0/projects/blastdown/builds/db0fed1e-b045-49c0-a6c0-925ce0fd0eec)
and ON [`459615ff-a5aa-4e2a-a8c8-490c221955c0`](https://expo.dev/accounts/anassm0/projects/blastdown/builds/459615ff-a5aa-4e2a-a8c8-490c221955c0).
EAS supplied no application failure or artifact for either job. This is a
remote-build service result, not evidence of a native application fault.

The resulting APK must be installed as a new development client before its
matching Metro session is started. Start Metro with a cleared cache and the same
flag as the client; never reuse a server or bundle produced for the other flag:

```text
# OFF client
$env:EXPO_PUBLIC_CINEMATIC_BOARD = "0"
npx expo start --dev-client --clear

# ON client
$env:EXPO_PUBLIC_CINEMATIC_BOARD = "1"
npx expo start --dev-client --clear
```

The implementation resolves the board renderer at module load from the exact
literal flag. OFF excludes the cinematic module from the bundle and mounts the
React Native fallback; ON includes the Skia renderer. Development diagnostics
should confirm the selected renderer before any performance result is recorded.

### Local environment result

| Item                                              | Result                           |
| ------------------------------------------------- | -------------------------------- |
| Physical Android device                           | Not connected / not available    |
| Device model and Android version                  | Not available                    |
| `adb`                                             | Not installed or not on `PATH`   |
| Android SDK / `ANDROID_HOME` / `ANDROID_SDK_ROOT` | Not installed or unset           |
| Java / Gradle                                     | Not installed or not on `PATH`   |
| Checked-in native Android project                 | None (managed Expo project)      |
| EAS account                                       | Authenticated; project is linked |

Consequently, this document contains no claimed device frame time, FPS, memory,
audio, haptic, lifecycle, or crash result. A bundle/export result is not a
physical-performance measurement.

### Post-A-05 compatibility drift

The A-05-qualified graph was clean when accepted, but Expo's live SDK 57 map
changed during A-06. On 2026-09-07, `npx expo install --check` recommends
seven patch updates: `expo` 57.0.20, `expo-asset` 57.0.16,
`expo-constants` 57.0.17, `expo-dev-client` 57.0.18, `expo-font` 57.0.3,
`expo-linking` 57.0.9, and `expo-router` 57.0.19. Doctor is therefore 20/21
solely for those patch mismatches. A-06 intentionally retains the tested
A-05 graph (Expo 57.0.17) so device evidence is not conflated with a new
dependency change. Re-align and re-qualify that newer graph in a dedicated
runtime task before treating it as the baseline.

### Existing clean-export parity evidence

The A-05 source exports were rebuilt with `--clear` for each flag:

| Renderer                              | Modules | HBC bytes | Cinematic / Skia marker |
| ------------------------------------- | ------: | --------: | ----------------------- |
| OFF (`EXPO_PUBLIC_CINEMATIC_BOARD=0`) |   1,846 | 4,046,745 | Absent                  |
| ON (`EXPO_PUBLIC_CINEMATIC_BOARD=1`)  |   2,118 | 4,658,293 | Present                 |

This verifies flag isolation at bundle time only. It does not establish FPS,
frame pacing, memory stability, renderer initialization, effect visibility, or
input latency on Android hardware.

### Required device measurement matrix

Run every scenario with the diagnostics overlay enabled, recording device model,
Android version, build URL/APK hash, renderer flag, elapsed session time, and
any crash/logcat evidence.

| Scenario                          | OFF frame/FPS | ON frame/FPS | Memory       | Result / notes  |
| --------------------------------- | ------------- | ------------ | ------------ | --------------- |
| Idle gameplay                     | Not measured  | Not measured | Not measured | Awaiting device |
| Normal placement                  | Not measured  | Not measured | Not measured | Awaiting device |
| Row / column / simultaneous clear | Not measured  | Not measured | Not measured | Awaiting device |
| Explosion and rubble              | Not measured  | Not measured | Not measured | Awaiting device |
| Multiple concurrent effects       | Not measured  | Not measured | Not measured | Awaiting device |
| Timer danger state                | Not measured  | Not measured | Not measured | Awaiting device |
| Ten-minute session                | Not measured  | Not measured | Not measured | Awaiting device |

Use a reliable Android profiler or frame-timeline tool where available. If only
developer diagnostics are available, record effect enqueue-to-first-draw latency
and queue depth as delivery evidence, label it accordingly, and do not present it
as FPS.

### Current decision gate

**D — requires build/environment completion before physical qualification can
continue.** The application source and clean Android exports pass automated
checks, but there is no local Android device or native toolchain with which to
measure the required runtime behavior, and the retried EAS artifacts were not
yet available when this record was finalized. The cinematic renderer remains
optional; the fallback renderer remains the default.
