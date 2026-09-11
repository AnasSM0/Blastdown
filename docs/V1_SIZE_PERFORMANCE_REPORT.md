# V1 size and performance report

## P-01 — 2026-09-11 (Asia/Karachi)

**Release decision: BLOCKED.** The audited source is smaller and the static
runtime review found no unbounded gameplay work, but a real production AAB and
physical low-end Android evidence are unavailable. EAS rejects the production
configuration before upload because the project has no production
`ADMOB_ANDROID_APP_ID` or `ADMOB_IOS_APP_ID`. The repository also still uses
the mock ad service and no-op analytics/error-reporting adapters, so the locked
production ads, analytics, and crash-reporting scope is not release-complete.

This report separates exact measurements from estimates and unknowns. It does
not relabel a development APK, Metro export, or source audit as production or
device evidence.

## Scope and provenance

| Item                           | Value                                                              |
| ------------------------------ | ------------------------------------------------------------------ |
| Task branch                    | `perf/v1-release-optimization`                                     |
| Baseline commit                | `7278a5cd3bfb548e41db4566f785b42952cdbc39`                         |
| Lockfile SHA-256               | `740b4d1ceb747cddd4c17cb41c19f940ed011500f7bf816809ee6737bfd530b7` |
| Package / version / build      | `com.blastdown.app` / `1.0.0` / `1`                                |
| Intended release profile       | EAS `production`, Android App Bundle, cinematic OFF                |
| Baseline export evidence       | ignored `dist/qualification-1789125406005`                         |
| Final export evidence          | ignored `dist/qualification-1789126121336`                         |
| Retained APK evidence          | `dist/qualification-apks/fallback.apk`                             |
| Physical device                | NOT AVAILABLE                                                      |
| Android SDK / adb / bundletool | NOT AVAILABLE                                                      |

Gameplay rules, balance, persistence shape, timers, RNG, scoring, combo,
explosions/rubble, rewards, navigation, and the default renderer are unchanged.
No file under `src/domain/` or any balance value under `src/config/` was changed.

## Production artifact gate

The baseline EAS production command failed during `app.config.ts` evaluation,
before source upload or compilation:

```text
Production builds require ADMOB_ANDROID_APP_ID and ADMOB_IOS_APP_ID to be set.
Refusing to ship Google test ad unit IDs in a production build.
```

`eas env:list --environment production` returned no variables. Real IDs are
owner-provided release credentials and were not guessed, copied from another
environment, or replaced by Google's test IDs. Consequently these requested
values remain unavailable:

| Metric               | Baseline | Final | Status                                                       |
| -------------------- | -------: | ----: | ------------------------------------------------------------ |
| Production AAB bytes |        — |     — | BLOCKED by missing production AdMob app IDs                  |
| Play device download |        — |     — | BLOCKED; requires AAB plus Play/bundletool device spec       |
| Installed size       |        — |     — | BLOCKED; requires generated split APKs or a physical install |
| Cold/warm startup    |        — |     — | NOT MEASURED on physical Android                             |
| FPS / frame time     |        — |     — | NOT MEASURED on physical Android                             |
| Java/native heap     |        — |     — | NOT MEASURED on physical Android                             |

An AAB is a publishing artifact, not the bytes a particular phone downloads.
Play generates ABI/density/language splits, so download and installed size must
be recorded separately for a named device configuration.

### Retained development APK evidence

The available `fallback.apk` is an older four-ABI development client, not a
production build. Exact ZIP inspection is still useful for locating native
cost centers:

| Measurement                  |                    Exact value |
| ---------------------------- | -----------------------------: |
| APK                          | 326,435,031 bytes (311.31 MiB) |
| ZIP entries                  |                          1,727 |
| Native libraries, compressed |                     276.92 MiB |
| DEX, compressed / raw        |              28.11 / 70.97 MiB |
| Resources, compressed / raw  |                2.01 / 3.52 MiB |
| Packaged assets              |                       0.84 MiB |

Native library bytes by ABI in that development APK are 79,450,400 arm64-v8a,
48,799,756 armeabi-v7a, 82,077,268 x86, and 80,042,704 x86_64. Skia alone is
68,264,696 bytes across the four ABIs: 18,147,856 arm64-v8a, 11,900,368
armeabi-v7a, 19,350,456 x86, and 18,866,016 x86_64. A Play-delivered release
will not deliver all four ABIs to one device, so these values are not a release
size forecast.

### Largest measured entries in the retained development APK

| Rank | ZIP entry                       | Compressed MiB |
| ---: | ------------------------------- | -------------: |
|    1 | arm64 `libreactnative.so`       |          22.34 |
|    2 | x86_64 `libreactnative.so`      |          21.57 |
|    3 | x86 `libreactnative.so`         |          21.52 |
|    4 | x86 `librnskia.so`              |          18.45 |
|    5 | x86_64 `librnskia.so`           |          17.99 |
|    6 | arm64 `librnskia.so`            |          17.31 |
|    7 | armeabi-v7a `libreactnative.so` |          12.93 |
|    8 | armeabi-v7a `librnskia.so`      |          11.35 |
|    9 | x86 `libreanimated.so`          |           8.08 |
|   10 | arm64 `libreanimated.so`        |           7.90 |
|   11 | x86_64 `libreanimated.so`       |           7.54 |
|   12 | `classes.dex`                   |           6.20 |
|   13 | x86 `libbarhopper_v3.so`        |           5.84 |
|   14 | x86_64 `libbarhopper_v3.so`     |           5.64 |
|   15 | `classes6.dex`                  |           5.24 |
|   16 | `classes7.dex`                  |           4.93 |
|   17 | arm64 `libbarhopper_v3.so`      |           4.72 |
|   18 | x86 `libhermesvm.so`            |           4.65 |
|   19 | arm64 `libworklets.so`          |           4.42 |
|   20 | arm64 `libappmodules.so`        |           4.36 |

Run `npm run analyze:android-size -- <artifact.aab-or-apk>` for the reproducible
ZIP inventory. It uses Node core only, prints category/ABI totals and largest
entries, and deliberately does not invent Play or installed-size estimates.

## JavaScript and asset footprint

The source-map-enabled Android export is a consistent before/after comparison,
not an AAB measurement. Both were clean-cache, development-environment,
cinematic-OFF exports from the same lockfile. Production-mode export remains
blocked by the same missing release credentials as the AAB.

| Metric              |     Baseline |       Final |                  Delta |
| ------------------- | -----------: | ----------: | ---------------------: |
| Metro modules       |        1,870 |       1,839 |           -31 (-1.66%) |
| Hermes bytecode     |  3,356,700 B | 3,341,180 B |     -15,520 B (-0.46%) |
| Asset files         |           81 |          51 |                    -30 |
| Raw exported assets |  7,539,064 B | 4,534,938 B | -3,004,126 B (-39.85%) |
| HBC + raw assets    | 10,895,764 B | 7,876,118 B | -3,019,646 B (-27.71%) |

The exported asset delta is almost entirely unused font faces. Direct face
imports replaced package barrels in both normal and cinematic code. The one
remaining 963,776-byte Material Symbols face is reached through Expo Router's
Android `expo-symbols` native-tab icon utility. Removing it safely would require
patching framework code, so it is retained.

The unused V1-excluded `revive.wav` was removed from the static manifest and
asset graph, saving 15,918 raw bytes. Deprecated persisted fields and gameplay
compatibility paths remain parseable.

### Final exported asset inventory

| Asset group                  | Files | Raw bytes | Decision                                                              |
| ---------------------------- | ----: | --------: | --------------------------------------------------------------------- |
| Gameplay music + SFX WAV     |    19 | 3,022,100 | Retain; bounded catalog, existing deterministic production candidates |
| Five app font faces          |     5 |   526,312 | Retain; only the weights used by the UI                               |
| Router Material Symbols face |     1 |   963,776 | Retain; framework-reachable                                           |
| Router PNGs                  |    24 |    22,131 | Retain; framework-reachable, negligible                               |
| Router XML drawables         |     2 |       619 | Retain; framework-reachable, negligible                               |

The 19 audio files are: `button` 4,896 B, `clearDouble` 34,716 B,
`clearOverload` 42,668 B, `clearTriple` 38,660 B, `clutch` 42,010 B,
`defuse` 34,620 B, `defusePowerUp` 36,254 B, `explosion` 48,226 B, `freeze`
34,866 B, `gameOver` 66,908 B, `invalid` 15,920 B, `lineClear` 30,774 B,
`music-loop` 2,457,644 B, `newBest` 63,228 B, `placement` 11,510 B,
`rubbleClear` 18,516 B, `selection` 6,660 B, `timer1` 20,330 B, and `timer2`
13,694 B. The five app fonts are Geist Regular 90,768 B, Geist SemiBold
90,896 B, JetBrains Mono Medium 114,920 B, SemiBold 114,900 B, and Bold
114,828 B.

Native-config source images are also audited: `icon.png` 393,493 B, adaptive
icon foreground 78,796 B, background 17,549 B, monochrome 4,140 B,
`splash-icon.png` 17,547 B, and web-only `favicon.png` 1,129 B. Their final
compiled resource contribution cannot be measured without the production AAB.
No duplicate app-owned bitmap, stale theme asset, Bolts asset, or oversized
photo asset was found.

### Renderer proof

The final clean OFF → ON → OFF qualification passed:

| Run                            | Modules | HBC bytes | Cinematic/Skia sources | Markers |
| ------------------------------ | ------: | --------: | ---------------------: | ------- |
| OFF first (development export) |   1,839 | 3,341,180 |                      0 | absent  |
| ON development                 |   2,112 | 3,845,172 |                    227 | present |
| OFF again (development export) |   1,839 | 3,341,180 |                      0 | absent  |

The two OFF HBC files are byte-identical with SHA-256
`dc80b862c3f1aeb909c58b6ccce31b33350a4904dcc22cae4209a8b27939eae3`.
Markers checked are `CinematicBoardCanvas`, `buildBoardScene`, and
`buildEffectScene`. This proves JavaScript exclusion and flag isolation; it
does not prove native AAB contents or device performance.

## Dependency audit

| Dependency area                                    | Production need                          | Finding / action                                                            |
| -------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Expo / React Native / Router / Screens / Safe Area | Required                                 | Retained                                                                    |
| Gesture Handler                                    | Required for tray drag                   | Retained; one gesture stream per active drag                                |
| AsyncStorage                                       | Required for settings/profile/active run | Retained; writes are serialized/coalesced                                   |
| Expo Audio / Haptics                               | Required V1 feedback                     | Retained; audio native setup/preload deferred until settings hydrate        |
| Google Mobile Ads                                  | Required V1 rewarded ads                 | Retained, but vendor adapter and real release IDs are still missing         |
| Skia                                               | Optional cinematic renderer              | Excluded from production Android autolinking when cinematic OFF             |
| Reanimated / Worklets                              | Used only by cinematic renderer          | Excluded with Skia in production OFF; retained in development and ON builds |
| Expo Dev Client                                    | Development tooling                      | Retained for qualification profiles; production AAB contribution unverified |
| Font packages                                      | Required typography                      | Retained; barrel imports eliminated                                         |
| Analytics / crash SDK                              | Required V1 capability                   | No vendor SDK exists; current adapters are no-op, a release blocker         |

`react-native.config.js` uses Expo's supported React Native autolinking opt-out
(`platforms.android = null`) only for production cinematic-OFF builds. Static
tests execute Expo Autolinking and prove Skia, Reanimated, and Worklets are
absent from that native dependency graph while production ON and development
OFF retain all three. The EAS production profile now explicitly sets
`environment: production` and `EXPO_PUBLIC_CINEMATIC_BOARD=0`.

No package was uninstalled: Skia/Reanimated/Worklets are still needed by the
approved optional renderer and Android development qualification, and removing
Expo Dev Client would break the named development profiles. The conditional
native link boundary gives the release footprint benefit without changing the
lockfile or adding a dependency.

Release minification/resource shrinking was not enabled. Expo supports those
Gradle properties through `expo-build-properties`, but that package is not
installed and there is no production AAB or physical device with which to prove
that a new shrinker configuration preserves reflection/resources and rewarded
ads. `inlineRequires` was also rejected for this pass because startup cannot be
measured and eager module side effects would need a separate compatibility
audit. These are explicit deferred experiments, not claimed optimizations.

## Startup and service lifecycle

The root layout renders immediately with system font fallbacks while fonts load.
Settings, profile, and active-run storage hydrate asynchronously. Analytics and
error reporting are failure-contained and currently no-op. The current mock ad
service creates no native SDK, network request, or eager ad preload.

Previously, constructing the root audio service immediately configured native
audio mode and its provider preloaded the entire audio catalog before settings
hydration. Now construction is side-effect free. Native audio-mode setup and
the idempotent finite preload run only after persisted settings are available;
play/music remain settings-gated and best-effort. Root unmount releases all
players and clears timers. This removes noncritical native work from the initial
render path without changing feedback semantics.

Measured cold/warm launch time and time-to-interactive remain unavailable until
physical Android testing. Static inspection alone cannot claim a millisecond
improvement.

## Render, drag, animation, idle, and memory audit

| Area              | Static finding                                                                                              | Risk / status                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Fallback board    | Memoized board and cells; cells receive primitive/stable props                                              | No per-pixel board React rerender found            |
| Drag path         | RNGH pan callback moves an imperative ghost; React drag origin changes only when the logical anchor changes | Preserves B-07 behavior; device latency unmeasured |
| Placement/clear   | Domain transition is event-driven; effects are queued from committed semantic events                        | No polling or frame-based domain work              |
| Effect pipeline   | Bounded queue cap of 6 and deduped identities                                                               | No unbounded effect accumulation found             |
| Pre-clear         | One native-driver pulse and cleanup                                                                         | Bounded                                            |
| Danger/timers     | Animation loops exist only while the relevant danger/urgent state is active                                 | No permanent timer loop found                      |
| Background        | Reactor background is static                                                                                | No idle animation loop                             |
| Development tools | `__DEV__` dynamic-require seams; OFF export contains no harness markers                                     | Production JS exclusion verified by export/tests   |
| Persistence       | Serialized/coalesced writes; lifecycle flush paths                                                          | No write-per-frame behavior                        |
| Audio             | Finite preloaded catalog, max four SFX voices, bounded 256-ID dedupe, release cleanup                       | No unbounded player growth found                   |
| Ads               | One injected service; rewarded hook is single-flight                                                        | Real SDK lifecycle still unimplemented/unverified  |

No production `setInterval` loop, per-frame React state update, unbounded array,
screen-owned native ad instance, or accumulating app-state listener was found.
Static review cannot establish FPS, native heap stability, GC pauses, GPU cost,
audio decode latency, or thermal behavior.

## Low-end Android qualification profile

Use a physical 60 Hz Android device representative of the budget/low-memory
cohort (prefer 2–3 GB RAM, Android 9–11, and an older ARM big.LITTLE or A53-class
CPU), plus one current mid-range phone. Record exact model, OS, ABI, RAM,
refresh rate, thermal state, battery saver state, artifact SHA, build ID, and
renderer diagnostic. Do not use an emulator as low-end evidence.

For a release candidate AAB, generate device-specific APKs with official
bundletool or install through an internal Play track. Record AAB bytes, split
download bytes, installed package bytes, cold start after force-stop, warm start,
and process memory at start and after a real ten-minute session.

Exercise Home, New Game confirm/cancel, Continue hydration, repeated placement,
row/column/simultaneous clears, timed pieces, natural defuse, explosion/rubble,
combo, rewarded Freeze/Defuse success/cancel/failure, Pause/Resume/Back,
Restart confirm/cancel, Results/Play Again/Home, background/resume, force-stop
restore, sound/music/haptic toggles, reduced motion, and rapid repeated input.
Capture FrameTimeline/Perfetto where possible; `gfxinfo` alone may miss a
separate Skia surface. Capture idle, drag, placement, line clear, heavy
simultaneous effects, timer danger, and ten-minute-session traces. Verify no
progressive frame degradation, growing memory, missing effects, input lag,
native exception, leaked audio, duplicated rewarded callback, or stale restore.

Target smooth 60 FPS where device capability permits. A pass requires no
correctness regression and no observable progressive degradation; exact frame,
startup, and memory thresholds must be recorded with the named hardware rather
than invented in this source-only audit.

## Verification summary

| Check                                    | Result                                                             |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `npm ci`                                 | Pass; lockfile unchanged                                           |
| TypeScript / ESLint / Prettier           | Pass, zero errors or warnings                                      |
| Focused size/profile/audio tests         | 5 suites / 19 tests pass                                           |
| Full Jest pass 1                         | 141 suites / 1,119 tests pass                                      |
| Full Jest pass 2                         | 141 suites / 1,119 tests pass                                      |
| Coverage                                 | 89.20% statements, 81.86% branches, 88.77% functions, 88.82% lines |
| Clean OFF → ON → OFF                     | Pass; first/last OFF byte-identical                                |
| APK analyzer on retained development APK | Pass                                                               |
| `git diff --check`                       | Pass                                                               |
| Final `graphify update .`                | Pass; 3,416 nodes, 6,490 edges, 213 communities                    |

The existing React concurrent-`act` warnings remain in the tutorial suite; no
test was skipped or weakened. `npm audit` and `npm audit --omit=dev` both report
24 dependency findings: 16 moderate, 8 high, zero critical. The reported fix
paths include incompatible Expo/Router downgrades and transitive build-tool
changes, so no `audit fix` or lockfile mutation was accepted in this footprint
task. This is not a security-clean declaration and requires separate triage.

Remaining release gates are:

1. Owner supplies real production AdMob Android and iOS app IDs in the EAS
   production environment.
2. Replace the mock rewarded-ad adapter and no-op analytics/crash adapters with
   approved production providers without changing service boundaries.
3. Build the real cinematic-OFF production AAB from a clean committed source
   revision, inspect it with this repository's analyzer and Android tools, and
   record Play/device-specific size.
4. Run the low-end physical Android matrix above and retain raw traces/logs.
5. Reassess R8/resource shrinking only with that artifact and regression suite.
