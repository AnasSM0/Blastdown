import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { NoopErrorReporter } from "./NoopErrorReporter";
import { recordPlaytestError } from "../playtest/signal";
import { resetActiveErrorReporter, setActiveErrorReporter } from "./reportError";
import type { ErrorReport, ErrorReporter } from "./types";

/** Defaults to no-op so a tree without a provider still resolves a working —
 *  inert — reporter and never throws for a missing provider. */
const ErrorReporterContext = createContext<ErrorReporter>(NoopErrorReporter);

/** Supplies the app's single `ErrorReporter` and registers it with the module
 *  bridge (`reportError`) so imperative service code can report too. Defaults
 *  to no-op; the production crash-reporting phase swaps in the real adapter. */
export function ErrorReporterProvider({
  children,
  reporter,
}: {
  children: ReactNode;
  reporter?: ErrorReporter;
}) {
  const value = useMemo(() => reporter ?? NoopErrorReporter, [reporter]);

  useEffect(() => {
    setActiveErrorReporter(value);
    return () => resetActiveErrorReporter();
  }, [value]);

  return <ErrorReporterContext.Provider value={value}>{children}</ErrorReporterContext.Provider>;
}

export type ErrorReportFn = (report: ErrorReport) => void;

/** Hook for React code to report errors. The returned `report` is stable and
 *  safe: it reads the current reporter through a ref and swallows any error the
 *  reporter raises. */
export function useErrorReporter(): { report: ErrorReportFn } {
  const reporter = useContext(ErrorReporterContext);
  const reporterRef = useRef(reporter);
  useEffect(() => {
    reporterRef.current = reporter;
  });

  const report = useCallback((report: ErrorReport) => {
    recordPlaytestError();
    try {
      reporterRef.current.report(report);
    } catch {
      // Diagnostics must never affect the app.
    }
  }, []);

  return useMemo(() => ({ report }), [report]);
}
