import type { ErrorReporter } from "./types";

/** Drops every report. The default when no provider is mounted; also the safe
 *  offline fallback — losing a diagnostic is always allowed and never touches
 *  the network. */
export const NoopErrorReporter: ErrorReporter = {
  report() {
    // Intentionally empty — reports are dropped.
  },
};
