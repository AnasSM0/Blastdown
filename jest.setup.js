/* global jest */
// Mocks the native gesture-handler module so components using GestureDetector
// render under jest without a native runtime.
require("react-native-gesture-handler/jestSetup");

// Official in-memory AsyncStorage mock so the storage seam imports cleanly
// under jest (tests inject the memory StorageService, but the module still
// resolves AsyncStorage at import time).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Skia has no canvas under jest. The mock's own doc comment explains what it
// deliberately does NOT do and why the renderer is designed around that;
// `__tests__/rendering/skiaMockParity.test.ts` guards it against upstream drift.
jest.mock("@shopify/react-native-skia", () => require("./test-utils/skiaMock"));

// Reanimated installs native worklet bindings the moment it is imported, so the
// real module throws under jest. This is the library's own official mock, not a
// hand-written one — shared values become plain refs and animations resolve
// immediately. Only the cinematic renderer imports Reanimated; the React Native
// renderer uses RN `Animated` and is unaffected either way.
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
