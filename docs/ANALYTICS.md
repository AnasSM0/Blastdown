# Analytics

BlastDown's analytics are **privacy-conscious by construction**. Every event is
a closed, typed shape (`src/services/analytics/types.ts`): a `name` literal plus
a small, fixed set of **aggregate** properties. There is deliberately nowhere to
attach free text, a device identifier, precise location, or raw game/board
state — the type system is the first line of the privacy contract.

## Architecture

- **`AnalyticsService`** (`src/services/analytics/types.ts`) — the seam every
  screen and hook talks to. `track(event)` is fire-and-forget and must never
  throw. Screens/components never call a vendor SDK directly.
- **`NoopAnalyticsService`** — the default (no provider mounted) and the safe
  offline fallback: it drops events and never touches the network, so gameplay
  is unaffected whether analytics is wired or not.
- **`createMemoryAnalyticsService`** — records events for tests, with
  `byName` / `count` / `reset` helpers. `throwOnTrack` proves a failing backend
  can't crash gameplay.
- **`AnalyticsServiceProvider` + `useAnalytics`** — DI provider and hook. The
  hook wraps `track` in a guard (swallows any thrown error) and defaults to
  no-op when no provider is mounted. A real vendor adapter (production phase)
  implements `AnalyticsService`, queues events, and drops safely when the SDK or
  network is unavailable; the app never awaits it.
- **`useGameAnalytics`** — derives turn-scoped gameplay events **once per turn**
  from the domain event stream (same dedup key as `useGameAudio`), so a remount
  or re-render can't re-log a placement.
- **`AnalyticsSessionTracker`** — a null component in the root layout that owns
  the app/session lifecycle events.

## Event taxonomy

Properties are numbers, booleans, or **enumerated ids** only (`themeId` from the
theme catalog, `setting` from the settings keys). No free text.

| Event                                        | Properties                                                                                                                                           | When                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `app_open`                                   | —                                                                                                                                                    | App tree mounts                                                     |
| `session_start`                              | —                                                                                                                                                    | Foreground session begins                                           |
| `session_end`                                | `durationMs`                                                                                                                                         | App backgrounded / tree unmounts                                    |
| `tutorial_start`                             | —                                                                                                                                                    | Tutorial route entered                                              |
| `tutorial_step`                              | `step`                                                                                                                                               | Advancing to a new step (not the first)                             |
| `tutorial_complete`                          | —                                                                                                                                                    | Tutorial finished                                                   |
| `tutorial_skip`                              | `step`                                                                                                                                               | Skipped, at which step                                              |
| `run_start`                                  | —                                                                                                                                                    | Play / Play Again                                                   |
| `piece_selected`                             | —                                                                                                                                                    | A tray piece is selected                                            |
| `piece_placed`                               | `turn`, `combo`                                                                                                                                      | A placement resolves (per turn)                                     |
| `piece_rejected`                             | —                                                                                                                                                    | An invalid placement attempt                                        |
| `line_clear`                                 | `lineCount`, `combo`                                                                                                                                 | Lines cleared this turn                                             |
| `piece_defused`                              | `bonus`                                                                                                                                              | A timed piece defused by a clear                                    |
| `explosion`                                  | —                                                                                                                                                    | A timed piece exploded                                              |
| `rubble_cleared`                             | `cellCount`                                                                                                                                          | Rubble removed                                                      |
| `freeze_offer` / `freeze_result`             | `result` on result                                                                                                                                   | Freeze ad requested / resolved                                      |
| `defuse_offer` / `defuse_result`             | `result` on result                                                                                                                                   | Defuse ad requested / resolved                                      |
| `revive_offer` / `revive_result`             | `result` on result                                                                                                                                   | Revive ad requested / resolved                                      |
| `double_bolts_offer` / `double_bolts_result` | `result` on result                                                                                                                                   | Double-Bolts ad requested / resolved                                |
| `run_end`                                    | `score`, `turn`, `bestCombo`, `linesCleared`, `piecesPlaced`, `piecesDefused`, `explosions`, `rubbleCleared`, `revived`, `durationMs`, `boltsEarned` | Run settled (once)                                                  |
| `results_view`                               | —                                                                                                                                                    | Results screen shown (once)                                         |
| `theme_view`                                 | —                                                                                                                                                    | Themes screen shown                                                 |
| `theme_select`                               | `themeId`                                                                                                                                            | A theme is selected                                                 |
| `theme_purchase`                             | `themeId`, `price`, `result`                                                                                                                         | A purchase attempt (`purchased` / `insufficient` / `already_owned`) |
| `settings_changed`                           | `setting`, `value` (0/1)                                                                                                                             | A settings toggle changes                                           |

Reward `result` ∈ `earned` / `closed` / `unavailable` / `failed`
(`rewardOutcome` maps the ad service's `error` → `failed`).

## Deduplication and safety

- **One logical action → one event.** Turn-scoped events are keyed on the turn
  counter (`useGameAnalytics`); UI moments (select/reject) are logged
  imperatively at the single call site.
- **Reward callbacks never double-log.** `*_result` is logged from the promise
  resolution, never inside the earn callback.
- **Terminal events log once.** `run_end` and `results_view` are folded into the
  same once-per-run / once-per-mount guards as settlement, so restart, Back,
  remount, and restore can't duplicate them.
- **Analytics failures never affect gameplay.** `useAnalytics().track` swallows
  errors; the Noop service drops safely offline.

## Not in this phase

Production analytics/crash SDK wiring, ad-unit ids, and consent UI are the
next phase (6B / production ads). The seam and taxonomy are ready for that
adapter to drop in behind `AnalyticsService`.
