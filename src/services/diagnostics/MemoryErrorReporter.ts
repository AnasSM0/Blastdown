import type { ErrorReport, ErrorReporter, ErrorSurface } from "./types";

export type MemoryErrorReporter = ErrorReporter & {
  /** Every report captured, in order — for test assertions. */
  readonly reports: ErrorReport[];
  /** Reports for a given surface. */
  bySurface(surface: ErrorSurface): ErrorReport[];
  reset(): void;
};

/** In-memory `ErrorReporter` for development and tests: records every report,
 *  no network, no vendor SDK. */
export function createMemoryErrorReporter(): MemoryErrorReporter {
  const reports: ErrorReport[] = [];
  return {
    reports,
    report(report: ErrorReport) {
      reports.push(report);
    },
    bySurface(surface) {
      return reports.filter((report) => report.surface === surface);
    },
    reset() {
      reports.length = 0;
    },
  };
}
