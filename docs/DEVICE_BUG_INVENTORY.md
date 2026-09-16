# Device bug inventory

## A-06B qualification record — 2026-09-07

No confirmed physical-device bugs: no Android device was used.
FPS/frame time/memory remain **NOT MEASURED** and the physical renderer verdict
remains **NOT VERIFIED**. Do not treat cloud builds or passing Jest tests as a
device verdict.

## Qualification status

| ID      | Classification                    | Evidence                                                                                                                                                                                                                 | Status                                                                                             |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| ENV-001 | Physical test prerequisite        | No device, adb, Java, Gradle, or local Android SDK available in this environment. EAS supplies the native build toolchain; only platform-tools and a phone are needed for later installation.                            | Device testing pending; not a cloud-build blocker.                                                 |
| ENV-002 | Live compatibility recommendation | Unchanged A-05 lockfile; live Expo metadata recommends seven patches, yielding Doctor 20/21. Reviewed changelogs identify no required Android fix among these patches; original OFF/ON APK builds succeeded.             | Accepted frozen baseline under A-06B's decision rule; no suppressed checks.                        |
| ENV-003 | Earlier cloud worker failure      | The first A-06 pair lost worker connection. Both original retry IDs and both provenance-backed named builds listed in the baseline are now FINISHED with APKs.                                                           | Resolved; no cloud-build blocker remains.                                                          |
| ENV-004 | Windows EAS archive cleanup       | EAS 23.2.0 failed before uploading with ENOTEMPTY in temporary shallow-clone .git; a leftover reparse-point entry was present. Process-scoped core.symlinks=false allowed Git-enabled upload with exact commit metadata. | Resolved by a documented process-scoped workaround; both named builds and artifacts passed.        |
| SEC-001 | Dependency audit follow-up        | npm ci reports 23 advisory findings (16 moderate, 7 high), with propagated tooling findings and a Router query-string dependency. The seven Expo recommendations alone do not resolve this audit report.                 | Separate security triage needed; not a confirmed device defect or claim of a clean security audit. |

Full build IDs, runtime versions, source/lockfile hashes, failure details,
artifact links, and the Windows CMD procedure are in
[ANDROID_PERFORMANCE_BASELINE.md](ANDROID_PERFORMANCE_BASELINE.md).

## Required record for a physical-device defect

For each observed defect record: ID, P0–P3 severity, device model, Android
version, APK hash/build ID/source commit, cinematic flag, reproduction steps,
expected/actual result, frequency, suspected cause, evidence (logcat,
diagnostic overlay, screenshot/recording), and status. P0 means crash/data
loss/unplayable, P1 major gameplay/rendering failure, P2 noticeable performance/
polish issue, and P3 minor UI/visual issue. Do not add hypothetical bugs.
