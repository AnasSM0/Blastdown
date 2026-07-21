import { render, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import { AppErrorBoundary } from "../../src/components/ErrorBoundary";
import { ErrorReporterProvider } from "../../src/services/diagnostics/ErrorReporterProvider";
import { createMemoryErrorReporter } from "../../src/services/diagnostics/MemoryErrorReporter";

// Controlled crash: flip the module flag to make the child stop throwing so a
// retry can succeed.
let shouldCrash = true;
function Boom() {
  if (shouldCrash) {
    throw new Error("render blew up");
  }
  return <Text testID="child-ok">OK</Text>;
}

describe("AppErrorBoundary", () => {
  let consoleErrorSpy: jest.SpyInstance;
  beforeEach(() => {
    shouldCrash = true;
    // React logs caught boundary errors to console.error; keep test output clean.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleErrorSpy.mockRestore());

  it("shows recovery UI and reports the error (surface ui, no state leaked)", async () => {
    const reporter = createMemoryErrorReporter();
    const result = await render(
      <ErrorReporterProvider reporter={reporter}>
        <AppErrorBoundary>
          <Boom />
        </AppErrorBoundary>
      </ErrorReporterProvider>,
    );

    expect(result.getByTestId("error-recovery")).toBeTruthy();
    expect(result.queryByTestId("child-ok")).toBeNull();

    const uiReports = reporter.bySurface("ui");
    expect(uiReports.length).toBeGreaterThanOrEqual(1);
    expect(uiReports[0].message).toBe("render blew up");
    // The recovery screen never renders the raw error message to the player.
    expect(result.queryByText("render blew up")).toBeNull();
  });

  it("recovers when Try Again is pressed after the cause is resolved", async () => {
    const reporter = createMemoryErrorReporter();
    const user = userEvent.setup();
    const result = await render(
      <ErrorReporterProvider reporter={reporter}>
        <AppErrorBoundary>
          <Boom />
        </AppErrorBoundary>
      </ErrorReporterProvider>,
    );

    // Resolve the cause, then retry.
    shouldCrash = false;
    await user.press(result.getByTestId("error-retry-button"));

    expect(result.getByTestId("child-ok")).toBeTruthy();
    expect(result.queryByTestId("error-recovery")).toBeNull();
  });
});
