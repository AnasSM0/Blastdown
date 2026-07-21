import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Notified once when a child render throws. Must not throw. */
  onError?: (error: Error, componentStack: string) => void;
  /** Renders the recovery UI. `reset` clears the caught error so the subtree
   *  re-renders from scratch. */
  fallback: (reset: () => void) => ReactNode;
};

type ErrorBoundaryState = { error: Error | null };

/** Generic React error boundary. Catches render/lifecycle errors in its subtree,
 *  reports them via `onError`, and shows a recovery UI instead of a blank/dead
 *  screen. Holds no app logic — the surface-specific wiring lives in
 *  `AppErrorBoundary`. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info.componentStack ?? "");
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.reset);
    }
    return this.props.children;
  }
}
