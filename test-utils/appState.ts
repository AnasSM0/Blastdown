import { AppState } from "react-native";

/**
 * The React Native preset already replaces `AppState.addEventListener` with a
 * jest mock. `jest.spyOn` on an *already mocked* method returns that same mock
 * rather than wrapping it, so `mockImplementation` overwrites the preset's
 * implementation and `mockRestore` clears it outright — every later subscriber
 * then receives `undefined` and blows up on `subscription.remove()`. That leaks
 * across tests in the same file, so a suite passes or fails on ordering alone.
 *
 * Capture the handlers through this helper instead, and always call `restore`
 * in a `finally` so the preset's behaviour is put back explicitly.
 */
export function captureAppStateHandlers() {
  const handlers: ((status: string) => void)[] = [];
  const mock = AppState.addEventListener as unknown as jest.Mock;
  const original = mock.getMockImplementation();

  mock.mockImplementation((_event: string, handler: (status: string) => void) => {
    handlers.push(handler);
    return { remove: jest.fn() };
  });

  function restore() {
    // Reinstate the preset's own implementation. It is only ever absent if the
    // preset stops mocking AppState, in which case an equivalent subscription
    // keeps unmount cleanup working.
    mock.mockImplementation(original ?? (() => ({ remove: jest.fn() })));
  }

  return { handlers, restore };
}
