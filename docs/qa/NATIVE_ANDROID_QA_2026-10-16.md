# Native Android QA — 16 October 2026

Tested the Play-installed `com.blastdown.app`, version 1.0.0 / versionCode 8,
on `emulator-5554` (Android 17 / API 37, 1080×2400 at 420 dpi). The installed
source commit is unknown; checkout HEAD is not build provenance.

The 20-scenario protocol returned **15 PASS, 1 FAIL, 1 PARTIAL, 3 NOT RUN**.
One natural 28-placement run ended at 1,233 points, with 7 lines cleared,
11 defused pieces, 11 explosions, and 22 rubble cells cleared. Independent
checks of the captured native states matched all 28 turns and 10 preservation
comparisons.

## Finding and remaining coverage

- **BD2-NATIVE-001:** Tutorial step 1 says to drag, but two measured drags left
  the board empty and Next disabled. Selecting the piece and tapping a cell
  worked. Main-game dragging worked.
- Tutorial step 2 was static, with no draggable second piece and Next already
  enabled. The repaired second-drag scenario could not run on this build.
- Main-game placement, corner previews, invalid/cancelled placement, clears,
  move timers, natural/last-move defuse, expiry/rubble, pause/resume, restart,
  Results, best score, and offline save/restore passed their recorded checks.
- Reduced Motion and the 360×640 dp / 130% font layout were checked. Full
  accessibility and physical audio/haptic qualification remain incomplete.
- Rewarded cancel/unavailable were not run because safe test-ad infrastructure
  was not established for this Play build.
- Emulator frame/memory samples were collected; they do not establish a
  physical-device or 60 fps performance pass.

The complete local report, action tape, hashes, 86 screenshots, and 12 native
recordings are under
`D:\blastdown\qa-evidence\BD2-VQL-002\2026-10-16-native`.
The local `verify-captures.py` passed for the 28 turns and 10 preservation
comparisons. No application source was changed by this QA session.

Next: obtain provenance for the build containing the existing tutorial repair,
rerun the two tutorial drag scenarios, then qualify safe rewarded-ad paths and
physical-device accessibility/performance. These findings do not resolve the
earlier unconfirmed BD2-CL-004 implementation status.
