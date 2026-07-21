import { NoopErrorReporter } from "./NoopErrorReporter";
import type { ErrorReport, ErrorReporter, ErrorSurface } from "./types";

/** Active reporter registered by the provider, so non-React code (service
 *  adapters, storage helpers) can report without prop-drilling a reporter. The
 *  DI `useErrorReporter` hook stays the path for React code; this bridge exists
 *  purely for the imperative catch sites. Defaults to Noop until a provider
 *  registers. */
let activeReporter: ErrorReporter = NoopErrorReporter;

export function setActiveErrorReporter(reporter: ErrorReporter): void {
  activeReporter = reporter;
}

export function resetActiveErrorReporter(): void {
  activeReporter = NoopErrorReporter;
}

/** Report through the active reporter. Safe: never throws (a failing reporter is
 *  swallowed) so a diagnostic can never turn a handled error into a crash. */
export function reportError(report: ErrorReport): void {
  try {
    activeReporter.report(report);
  } catch {
    // Diagnostics must never affect the app: drop and move on.
  }
}

/** Normalize an unknown caught value into a safe report. Extracts only the
 *  message and stack (source locations, not user data); never serializes the
 *  value itself, so stored state or secrets in a thrown object can't leak. */
export function reportCaught(
  surface: ErrorSurface,
  error: unknown,
  context?: Record<string, string | number | boolean>,
): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  const stack = error instanceof Error ? error.stack : undefined;
  reportError({ surface, message, stack, context });
}
