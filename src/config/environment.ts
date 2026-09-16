/** Whether this bundle is a development build.
 *
 *  React Native defines `__DEV__` as a real global that the bundler sets to
 *  `false` for preview and production. It is read through `globalThis` rather
 *  than as a bare identifier deliberately: a bare `__DEV__` is substituted by
 *  the bundler at build time, which is exactly what makes it useless to a test
 *  that needs to prove the production branch — the constant would already have
 *  been folded away. Reading the global keeps the branch observable, and in a
 *  release bundle the value is still the literal `false` the bundler installed.
 *
 *  Used to gate the effect harness and the diagnostics overlay. Neither may
 *  reach a player, and "renders a message instead" is not the same thing as
 *  absent — see `src/dev/effectHarnessEntry.ts`. */
export function isDevelopmentBuild(): boolean {
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}
