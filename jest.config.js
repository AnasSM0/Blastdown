/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  // react-native-worklets resolves its `.native` implementation under
  // jest-expo's native preset and then throws, because that file installs JSI
  // bindings at import time. Reanimated imports worklets, and the cinematic
  // renderer imports Reanimated, so without this the whole game screen stops
  // loading under test. The resolver is shipped by worklets for exactly this
  // and only strips `.native` for its own package.
  resolver: "react-native-worklets/jest/resolver.js",
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  // Shuffle test order within each file so no test can quietly come to depend on
  // another running first. Jest prints the seed, and `--seed=<n>` replays it.
  randomize: true,
  // A few route suites transform a large module graph on first load. With a cold
  // jest cache that alone can exceed the default and fail whichever test runs
  // first — a build-time cost, not a hang.
  //
  // Raised from 20s to 45s when the cinematic renderer added Skia and Reanimated
  // to the game screen's graph: `gameNavigation` measured 1.8s warm and over 20s
  // cold. Raising a timeout to fix a red test deserves suspicion, so the check
  // was the warm/cold gap — a hang does not get 10x faster on a second run. 45s
  // still catches one.
  testTimeout: 45_000,
};
