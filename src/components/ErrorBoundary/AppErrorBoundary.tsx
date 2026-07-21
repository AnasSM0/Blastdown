import { useCallback, type ReactNode } from "react";

import { useErrorReporter } from "../../services/diagnostics/ErrorReporterProvider";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorRecoveryView } from "./ErrorRecoveryView";

/** App-level error boundary: wraps the screen tree, reports any caught render
 *  error to the diagnostics reporter (surface "ui", message + stack only — no
 *  props or state are serialized), and shows the recovery UI. Sits above the
 *  screens so a crash in any route is contained and recoverable. */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { report } = useErrorReporter();

  const onError = useCallback(
    (error: Error, componentStack: string) => {
      report({
        surface: "ui",
        message: error.message,
        stack: error.stack ?? componentStack,
      });
    },
    [report],
  );

  return (
    <ErrorBoundary onError={onError} fallback={(reset) => <ErrorRecoveryView onRetry={reset} />}>
      {children}
    </ErrorBoundary>
  );
}
