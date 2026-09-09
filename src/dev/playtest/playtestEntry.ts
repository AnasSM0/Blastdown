import type { ComponentType } from "react";

/** Exact release-bundle exclusion seam for the observer. */
export function resolvePlaytestObserver(): ComponentType | null {
  if (__DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./PlaytestObserver") as { PlaytestObserver: ComponentType }).PlaytestObserver;
  }
  return null;
}
