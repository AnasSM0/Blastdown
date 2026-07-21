/** Error diagnostics seam (docs/ERROR_REPORTING.md). A structured, privacy-safe
 *  channel for non-fatal and fatal errors. Like analytics, it is fire-and-
 *  forget and MUST NOT throw into the caller. What it may carry is deliberately
 *  narrow — a surface label, a coarse error message, and an optional code stack.
 *  It must NEVER carry secrets, ad unit ids, raw stored state, or a full
 *  GameState; the `context` map is limited to small enumerated aggregates. */

/** Where the failure happened. Drives triage without exposing internals. */
export type ErrorSurface = "ui" | "storage" | "audio" | "reward" | "persistence" | "unknown";

export type ErrorReport = {
  surface: ErrorSurface;
  /** A short, non-sensitive description (usually the caught error's message).
   *  Callers must not pass user input or stored values here. */
  message: string;
  /** Optional code stack / component stack. Stacks are source locations, not
   *  user data, so they are safe to include for debugging. */
  stack?: string;
  /** Small enumerated aggregates only (counts, flags, ids from our catalogs).
   *  Never raw state. */
  context?: Record<string, string | number | boolean>;
};

/** The seam the app reports through (never a vendor SDK directly). A real
 *  crash-reporting adapter (the production phase) implements this; Noop drops,
 *  Memory records for tests. */
export interface ErrorReporter {
  report(report: ErrorReport): void;
}
