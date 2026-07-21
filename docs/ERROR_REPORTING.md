# Error reporting & diagnostics

A structured, **privacy-safe** channel for non-fatal and fatal errors, plus an
app-level error boundary that keeps a crash recoverable instead of fatal.

## Architecture

- **`ErrorReporter`** (`src/services/diagnostics/types.ts`) — the seam the app
  reports through. `report(report)` is fire-and-forget and must never throw.
- **`ErrorReport`** carries only: a `surface` label (`ui` / `storage` / `audio`
  / `reward` / `persistence` / `unknown`), a coarse `message`, an optional
  `stack` (source locations, not user data), and a small `context` map of
  enumerated aggregates. It must **never** carry secrets, ad-unit ids, raw
  stored state, or a full `GameState`.
- **`NoopErrorReporter`** — default (no provider) and offline-safe: drops every
  report, never touches the network.
- **`createMemoryErrorReporter`** — records reports for tests (`bySurface`,
  `reset`).
- **`ErrorReporterProvider` + `useErrorReporter`** — DI provider and hook (safe
  wrapper). The provider also registers its reporter with a module bridge so
  imperative service code can report without prop-drilling.
- **`reportError` / `reportCaught`** — the module bridge. `reportCaught`
  extracts only `message` and `stack` from an unknown thrown value and **never
  serializes the value itself**, so a secret or stored payload attached to a
  thrown object can't leak. Both are safe (never throw).

## App-level boundary & recovery

`AppErrorBoundary` (`src/components/ErrorBoundary/`) wraps the screen tree in the
root layout. On a caught render/lifecycle error it:

1. Reports it (`surface: "ui"`, `message` + `stack` only — no props/state are
   serialized).
2. Renders `ErrorRecoveryView`: a **generic** "Something went wrong" screen with
   a **Try Again** action. It never shows the raw error message, game state, or
   stored data to the player. Try Again resets the boundary so the subtree
   re-renders from a clean slate.

## Captured surfaces (this phase)

| Surface             | Where                                 | Behavior                                                                  |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `ui`                | `AppErrorBoundary`                    | Render errors → recovery UI + report                                      |
| `persistence`       | `ProfileProvider`, `SettingsProvider` | Load/save failures reported; defaults kept so the player is never blocked |
| `reward`            | `useRewardedAction`                   | Ad SDK failure → treated as no-reward + reported (placement id only)      |
| `storage` / `audio` | reserved                              | Adapters may report via the `reportError` bridge                          |

No behavior changed — these failures were already swallowed; now they are also
recorded.

## Not in this phase

The production crash-reporting adapter (Crashlytics/Sentry-style) implements
`ErrorReporter` and is wired in the production phase. Nothing here sends data
off-device yet.
