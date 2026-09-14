# BlastDown 1.0.0 Release Smoke Test

Automated results prove logic and component contracts; they do not replace a
test of the exact Play-delivered build on real hardware. Record device model,
Android version, tester, date, network state, and Play test-track version code
when performing the manual column.

| Flow                         | Automated proof                                              | Release-device check                                                                                                         |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Fresh install / first launch | Persistence and tutorial contracts covered                   | **MANUAL DEVICE CHECK** — clean install, no stale state, no crash, tutorial starts as designed                               |
| Home                         | Screen/navigation component coverage                         | **MANUAL DEVICE CHECK** — layout, Play, Continue visibility, footer links                                                    |
| Play                         | Game/controller integration coverage                         | **MANUAL DEVICE CHECK** — new run starts and accepts touch input                                                             |
| Continue                     | Active-run round-trip and launch restoration covered         | **MANUAL DEVICE CHECK** — saved run resumes exactly after process death                                                      |
| How To Play                  | Tutorial route/component coverage                            | **MANUAL DEVICE CHECK** — complete/replay tutorial and return Home                                                           |
| Settings                     | Settings persistence/component coverage                      | **MANUAL DEVICE CHECK** — every toggle changes and persists                                                                  |
| Privacy                      | Privacy route/link tests                                     | **MANUAL DEVICE CHECK** — Home and Settings entries open policy; privacy-options action behaves for applicable consent state |
| Valid placement              | Domain/controller tests                                      | **MANUAL DEVICE CHECK** — piece lands, hand/score/timers update once                                                         |
| Invalid placement            | Domain/controller/accessibility tests                        | **MANUAL DEVICE CHECK** — rejected with feedback and no state mutation                                                       |
| Pre-clear preview            | Pure prediction, renderer, and interaction tests             | **MANUAL DEVICE CHECK** — preview matches the resulting clear                                                                |
| Line clear                   | Domain/scoring/renderer tests                                | **MANUAL DEVICE CHECK** — cells, score, audio, haptic, and animation agree                                                   |
| Multi-clear                  | Scoring and presentation tests                               | **MANUAL DEVICE CHECK** — simultaneous lines clear and score once                                                            |
| Timer warning                | Danger-state/semantic-feedback tests                         | **MANUAL DEVICE CHECK** — countdown urgency remains legible and non-blocking                                                 |
| Natural defuse               | Engine/scoring/feedback tests                                | **MANUAL DEVICE CHECK** — clearing timed cell defuses it with correct score/cue                                              |
| Explosion / rubble           | Full engine lifecycle and presentation tests                 | **MANUAL DEVICE CHECK** — expiry creates expected rubble with no recursive blast                                             |
| Freeze                       | Power-up, controller, selector, and reward-flow tests        | **MANUAL DEVICE CHECK** — eligible rewarded completion freezes exact placements                                              |
| Defuse                       | Power-up, controller, selector, and reward-flow tests        | **MANUAL DEVICE CHECK** — eligible rewarded completion selects the lowest timer once                                         |
| Rewarded ad success          | Service and integration tests, including exactly-once reward | **MANUAL DEVICE CHECK** — real production ad loads, completes, and grants once                                               |
| Rewarded ad cancellation     | Closed-outcome integration tests                             | **MANUAL DEVICE CHECK** — no reward and gameplay remains usable                                                              |
| Rewarded unavailable/error   | Fail-closed service and integration tests                    | **MANUAL DEVICE CHECK** — no reward; clear recovery state; gameplay continues                                                |
| Pause / Resume               | Navigation and lifecycle coverage                            | **MANUAL DEVICE CHECK** — pause freezes interaction and resume restores it                                                   |
| Background / resume          | Persistence and audio lifecycle tests                        | **MANUAL DEVICE CHECK** — switch apps during play and during ad lifecycle                                                    |
| Force-close restore          | Active-run storage and lifecycle tests                       | **MANUAL DEVICE CHECK** — kill from recents/process and Continue exact state                                                 |
| Game Over                    | Engine/navigation/component coverage                         | **MANUAL DEVICE CHECK** — final state transitions once; no rewarded Revive appears                                           |
| Results                      | Results navigation/component coverage                        | **MANUAL DEVICE CHECK** — score/best score and actions render correctly                                                      |
| Play Again                   | Results navigation/controller coverage                       | **MANUAL DEVICE CHECK** — clean new run without prior-board leakage                                                          |
| Best score                   | Score/persistence/component coverage                         | **MANUAL DEVICE CHECK** — survives restart and only increases                                                                |
| Sound / music / haptics      | Audio, settings, and feedback tests                          | **MANUAL DEVICE CHECK** — toggles, volume, interruption, silent/DND behavior                                                 |
| Reduced Motion               | Renderer and accessibility tests                             | **MANUAL DEVICE CHECK** — reduced animation without lost gameplay information                                                |

## Required release-device matrix

- ARM64 modern Android device on a Play internal-test install.
- Older/low-memory Android device where available, preferably exercising the
  armeabi-v7a delivery path.
- Online ad-success run and offline/no-fill run.
- Consent-required geography using an approved test-device/geography setup,
  plus a region where privacy options are not required.

The release is not physically smoke-tested until every manual row is recorded
against the exact version code delivered by Play. Do not sideload a debug APK
and call that evidence for the AAB.
