import { renderHook } from "@testing-library/react-native";

const mockImpactAsync = jest.fn(() => Promise.resolve());
const mockNotificationAsync = jest.fn(() => Promise.resolve());

jest.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: mockNotificationAsync,
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

// Imported after the mock so the hook binds to the stubbed module.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useHaptics } = require("../../src/hooks/useHaptics");

describe("useHaptics", () => {
  beforeEach(() => {
    mockImpactAsync.mockClear();
    mockNotificationAsync.mockClear();
  });

  it("maps selection to a light impact", async () => {
    const { result } = await renderHook(() => useHaptics());
    result.current.selection();
    expect(mockImpactAsync).toHaveBeenCalledWith("light");
  });

  it("maps success and warning to notification feedback", async () => {
    const { result } = await renderHook(() => useHaptics());
    result.current.success();
    result.current.warning();
    expect(mockNotificationAsync).toHaveBeenCalledWith("success");
    expect(mockNotificationAsync).toHaveBeenCalledWith("warning");
  });

  it("never throws when the native module rejects", async () => {
    mockImpactAsync.mockImplementationOnce(() => Promise.reject(new Error("no engine")));
    const { result } = await renderHook(() => useHaptics());
    expect(() => result.current.selection()).not.toThrow();
  });
});
