import type { ComponentType } from "react";

/** The only way into the effect harness.
 *
 *  ## Why the require sits inside `if (__DEV__)`, in this exact shape
 *
 *  Two earlier versions of this function both looked like they excluded the
 *  harness from a release build, and both shipped it. The shape matters, and it
 *  is only checkable by grepping the exported bundle — which is what settled it.
 *
 *  1. `if (!isDevelopmentBuild()) return null;` then the require.
 *     `isDevelopmentBuild()` reads `globalThis.__DEV__` at runtime so a test can
 *     flip it. A runtime read is not a constant, so Metro folds nothing, the
 *     require stays reachable, and `collectDependencies` pulls in the harness
 *     screen and everything behind it.
 *
 *  2. `if (!__DEV__) return null;` then the require. The bare identifier IS
 *     inlined, so the test folds to `true` — and Metro replaces the `if` with
 *     its consequent, leaving the require sitting in the function body
 *     underneath. Still collected. This one is the trap: the constant is real,
 *     the folding happens, and the dependency survives anyway.
 *
 *  What works is the require being INSIDE the branch that folds away:
 *  `if (false) { require(...) }` is removed whole, and the module leaves the
 *  graph with it. Under jest nothing inlines `__DEV__`, so it is still the
 *  global a test can set, which keeps the production branch observable.
 *
 *  `__tests__/dev/effectHarness.test.tsx` pins the shape, because both wrong
 *  versions above pass every behavioural test — they return `null` correctly.
 *  Only the bundle knows the difference.
 *
 *  Returning `null` rather than a component that renders a message is the other
 *  half. A screen that shipped and said "not available" would still be a surface
 *  nobody tests in a release build. */
export function resolveEffectHarness(): ComponentType | null {
  if (__DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./EffectHarnessScreen").EffectHarnessScreen as ComponentType;
  }
  return null;
}
