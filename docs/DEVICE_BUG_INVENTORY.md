# Device Bug Inventory

## A-06 qualification record — 2026-09-01

### Confirmed device bugs

None recorded. No physical Android device was connected to the A-06
qualification environment, so no device behavior is represented as a confirmed
product defect.

### Qualification blocker (not a product bug)

| ID      | Classification   | Evidence                                                                                                                              | Status                                                                                     |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ENV-001 | Environment gate | `adb`, Android SDK, Java, and Gradle are unavailable; `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset; no Android device is attached. | Open — connect a physical Android device or provision a supported local Android toolchain. |

### Required bug-record format for the next device run

For each observed defect, add the ID, P0–P3 severity, device model, Android
version, APK/build commit, renderer flag, exact reproduction steps, expected and
actual result, frequency, suspected cause, evidence (diagnostic overlay, logcat,
screenshot, or recording), and status. Do not add theoretical issues as bugs.
