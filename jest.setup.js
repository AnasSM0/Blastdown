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
