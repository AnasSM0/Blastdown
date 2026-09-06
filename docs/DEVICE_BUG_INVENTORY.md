# Device Bug Inventory

## A-06 qualification record — 2026-09-07

### Confirmed device bugs

None recorded. No physical Android device was connected to the A-06
qualification environment, so no device behavior is represented as a confirmed
product defect.

### Qualification blocker (not a product bug)

| ID      | Classification                | Evidence                                                                                                                                                                                                                                                                       | Status                                                                                     |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| ENV-001 | Environment gate              | `adb`, Android SDK, Java, and Gradle are unavailable; `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset; no Android device is attached.                                                                                                                                          | Open — connect a physical Android device or provision a supported local Android toolchain. |
| ENV-002 | Dependency qualification gate | Expo's live SDK 57 map now recommends seven patches beyond the A-05-qualified graph; Doctor reports 20/21 for `expo` 57.0.17, `expo-asset` 57.0.15, `expo-constants` 57.0.15, `expo-dev-client` 57.0.16, `expo-font` 57.0.1, `expo-linking` 57.0.8, and `expo-router` 57.0.17. | Open — align in a separate runtime task, then repeat native qualification.                 |
| ENV-003 | Remote-build gate             | The first OFF/ON EAS jobs both reached workers but returned `SERVER_ERROR` (“lost connection to the worker”) without an APK; replacement jobs were in progress at record time.                                                                                                 | Open — obtain successful OFF and ON APK artifacts, then install on a physical device.      |

### Required bug-record format for the next device run

For each observed defect, add the ID, P0–P3 severity, device model, Android
version, APK/build commit, renderer flag, exact reproduction steps, expected and
actual result, frequency, suspected cause, evidence (diagnostic overlay, logcat,
screenshot, or recording), and status. Do not add theoretical issues as bugs.
