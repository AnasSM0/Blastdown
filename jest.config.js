/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  // Shuffle test order within each file so no test can quietly come to depend on
  // another running first. Jest prints the seed, and `--seed=<n>` replays it.
  randomize: true,
  // A few route suites transform a large module graph on first load. With a cold
  // jest cache that alone can exceed the 5s default and fail whichever test runs
  // first — a build-time cost, not a hang. 20s still catches a real hang.
  testTimeout: 20_000,
};
